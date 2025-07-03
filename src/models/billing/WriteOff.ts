
import { PrimeLimsTabledbobillingrefundtable } from '../../database/DatabaseTableSchema';
import KnexConnection from '../../database/KnexConnections';
import { promisifyQuery, rowAffected } from '../../hooks/helper';
import { OperationsFailures } from '../operations/types';

export class WriteOff {
     static async writeOffTransaction(
          tenantId: number,
          billingid: number,
          employeeid: number,
          reason: string
     ): Promise<boolean | string> {
          try {
               const billingQuery = `SELECT * FROM billing WHERE billingid = ?`;
               const billingResult = await promisifyQuery(tenantId, billingQuery, [billingid]);

               if (!billingResult || billingResult.length === 0) return OperationsFailures.notFound;
               const { writeOff, paid, payable, islocked } = billingResult[0];

               if (islocked == 1) return 'Transaction is locked. Cannot write off.';
               if (writeOff == 1) return 'Transaction already written off. No further adjustments allowed.';

               if (writeOff == 0) {
                    if (payable > paid) {
                         const outstanding = payable - paid;
                         const status = 'written-off';
                         const updateQuery = `UPDATE billing SET writeOff = 1,status = ?, writeOffReason = ?,islocked =1,
                          writeOffBy = ?, writeOffDate = NOW(), outstanding = ? WHERE billingid = ?`;
                         const result = await promisifyQuery(tenantId, updateQuery, [status, reason, employeeid, outstanding, billingid]);
                         if (rowAffected(result)) return true;
                         return OperationsFailures.notFound;
                    } else {
                         return 'No outstanding amount to write off.';
                    }
               }
               return false;
          } catch (err) {
               console.error('Error writing off transaction:', err);
               return OperationsFailures.internalServerError;
          }
     }

     static async isTransactionWrittenOff(tenantId: number, billingid: number): Promise<boolean> {
          const query = `SELECT isWriteOff FROM billing WHERE billingid = ?`;
          const result = await promisifyQuery(tenantId, query, [billingid]);
          return Array.isArray(result) && result.length > 0 && result[0].isWriteOff === 1;
     }

     static async refundCompletelyTransaction(tenantId: number, employeeid: number, billingid: number, paymentmode: number): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const trx = await connection.transaction();
          try {
               const services = await trx('dboservices as s')
                    .leftJoin('dbobillingrefundtable as r', 's.serviceid', 'r.serviceid')
                    .where('s.billingid', billingid)
                    .select('s.*', 'r.*');
               if (!services || services.length === 0) {
                    await trx.rollback();
                    return false;
               }

               for (const service of services) {
                    await trx('dboservices')
                         .where({ serviceid: service.serviceid })
                         .update({
                              totalpayable: 0,
                              totalcost: 0,
                              cost: 0,
                              amountIncurredDueTax: 0,
                              isLocked: 1,
                              isRefunded: 1,
                              discount: 0,
                         });

                    await trx('dbobillingrefundtable')
                         .where('serviceid', service.serviceid)
                         .update({
                              isRefundCompleted: 1,
                              isRefundInitiated: 1,
                              isRefundApproved: 1,
                              refundedBy: employeeid,
                              amountRefunded: service.totalpayable,
                              isRefundMatterClosed: 1
                         });
               }

               const totalRefunded = await trx('billing').where({ billingid }).select('paid').first();

               await trx('billing')
                    .where({ billingid })
                    .update({
                         status: 'voided',
                         paid: 0.0,
                         payable: 0.0,
                         outstanding: 0.0,
                         totalcost: 0.0,
                         discount: 0,
                         totalrefunded: totalRefunded.paid,
                         balance: 0.0,
                         islocked: 1
                    });

               await trx.raw(
                    'INSERT INTO billinghx(billingid, paymentmode, amount, employeeid, type) VALUES (?, ?, ?, ?, ?)',
                    [billingid, paymentmode, totalRefunded.paid, employeeid, 'debit']
               );

               await trx.commit();
               return true;
          } catch (err) {
               console.error('Error refunding transaction:', err);
               await trx.rollback();
               return false;
          }
     }
}
