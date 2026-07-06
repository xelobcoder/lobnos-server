
import KnexConnection from '../../database/KnexConnections';
import { applyDboservicesAfterUpdate } from '../../database/appLevelTriggers';
import { promisifyQuery, rowAffected } from '../../hooks/helper';
import { OperationsFailures } from '../operations/types';
import AutomatedExpenseLifecycle from '../Expenses/AutomatedExpenseLifecycle';

export class WriteOff {
     static async writeOffTransaction(
          tenantId: number,
          billingid: number,
          employeeid: number,
          reason: string
     ): Promise<boolean | string> {
          try {
               // we going to use a transaction here to update billing and dboservices tables to ensure data integrity
               const billingQuery = `SELECT * FROM billing WHERE billingid = ?`;
               const billingResult = await promisifyQuery(tenantId, billingQuery, [billingid]);

               if (!billingResult || billingResult.length === 0) return OperationsFailures.notFound;
               const { adjustmentType, isAdjustment, paid, payable, islocked, branchid } = billingResult[0];

               if (islocked == 1) return 'Transaction is locked. Cannot write off.';
               if (isAdjustment == 1 && adjustmentType === 'written-off') return 'Transaction already written off. No further adjustments allowed.';
               if (isAdjustment == 0 || isAdjustment == null || adjustmentType == "addition") {
                    const outstanding = 0;
                    const writeOffAmount = payable - paid;
                    const status = 'written-off';
                    const updateQuery = `UPDATE billing 
                          SET isAdjustment = 1,
                          status = ?,
                          adjustmentReason = ?,
                          islocked =1,
                          adjustedBy = ?,
                          adjustmentdate = NOW(),
                          balance = 0,
                          adjustmentType = 'written-off',  
                          writeoff = ?,
                          outstanding = ? WHERE billingid = ?`;

                    const knexConnection = await KnexConnection(tenantId);
                    const conn = await knexConnection.transaction();
                    try {

                         await conn.raw(updateQuery,
                              [status, reason, employeeid, writeOffAmount, outstanding, billingid]);

                         const alloutstandingServices = await conn('dboservices')
                              .where({ billingid })
                              .andWhere('outstanding', '>', 0)
                              .select('serviceid', 'outstanding');


                         for (const service of alloutstandingServices) {
                              await conn('dboservices')
                                   .update({
                                        outstanding: 0,
                                        status: 'written-off',
                                        isLocked: 1,
                                        paymentstatus: 'partial',
                                        amountwrittenoff: service.outstanding,
                                        writtenoffby: employeeid,
                                        writtenoffat: new Date(),
                                        writeoff: service.outstanding
                                   }).where({ serviceid: service.serviceid });
                         }

                         const expenseLifecycle = new AutomatedExpenseLifecycle(tenantId);
                         await expenseLifecycle.process({
                              amount: writeOffAmount,
                              name: 'Bad Debt - Billing #' + billingid,
                              description: reason,
                              categoryName: 'Bad Debt',
                              merchantName: 'System',
                              date: new Date(),
                              branchid: branchid,
                              employeeid: employeeid,
                              serviceid: billingid,
                              isassociatedservice: 1,
                              paymentMethod: 'SYSTEM_AUTO',
                              invoicePrefix: 'BAD-DEBT'
                         }, conn);

                         await conn.commit();
                         return true;
                    } catch (err) {
                         await conn.rollback();
                         console.error('Error during write-off transaction:', err);
                         return OperationsFailures.internalServerError || 'An error occurred while processing the write-off.';
                    }


               } else {
                    return 'No outstanding amount to write off.';
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

     static async refundCompletelyTransaction(tenantId: number, employeeid: number, billingid: number, paymentmode: number, message?: string): Promise<boolean> {
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
                              amountIncurredDueTax: 0,
                              isLocked: 1,
                              isRefunded: 1,
                              outstanding: 0,
                              discount: 0,
                              paidamount: 0,
                              paymentstatus: 'refunded'
                         });

                    const updatedService = await trx('dboservices').where({ serviceid: service.serviceid }).first();
                    if (updatedService) {
                         await applyDboservicesAfterUpdate(trx, updatedService, employeeid ? employeeid.toString() : undefined);
                    }

                    const comprehensiveMessage = message || `Transaction voided and refunded by admin (employeeid: ${employeeid}) on ${new Date()}. All witnesses set to admin. Reason: Service fully refunded and voided.`;

                    await trx('dbobillingrefundtable')
                         .where('serviceid', service.serviceid)
                         .update({
                              isRefundCompleted: 1,
                              isRefundInitiated: 1,
                              isRefundApproved: 1,
                              refundedBy: employeeid,
                              amountRefunded: service.totalpayable,
                              isRefundMatterClosed: 1,
                              firstWitness: employeeid,
                              secondWitness: employeeid,
                              thirdWitness: employeeid,
                              initiatedBy: employeeid,
                              approvalDate: new Date(),
                              firstWitnessPurpose: comprehensiveMessage,
                              secondWitnessPurpose: comprehensiveMessage,
                              thirdWitnessPurpose: comprehensiveMessage,
                              firstWitnessDate: new Date(),
                              secondWitnessDate: new Date(),
                              thirdWitnessDate: new Date()
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
                         discount: 0,
                         totalrefunded: totalRefunded.paid,
                         balance: 0.0,
                         amountIncurredDueTax: 0,
                         islocked: 1,
                         adjustedBy: employeeid,
                         isAdjustment: 1,
                         adjustmentType: 'voided',
                         adjustmentReason: 'Transaction voided and refunded by admin.',
                         adjustmentdate: new Date()
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
