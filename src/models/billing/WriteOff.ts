
import KnexConnection from '../../database/KnexConnections';
import { applyDboservicesAfterUpdate } from '../../database/appLevelTriggers';
import { promisifyQuery, rowAffected } from '../../hooks/helper';
import { OperationsFailures } from '../operations/types';
import AutomatedExpenseLifecycle from '../Expenses/AutomatedExpenseLifecycle';
import { enqueueBillingWriteOff, enqueueBillingRefund } from '../../accountingModule/integrations/BillingAccounting';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';
import { BillingRefundService } from './BillingRefundService';
import { lockMutableBill } from './BillingFinancialGuard';

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

               await new FinancialFinalizationGuard(tenantId).assertRecordMutable('billing', billingid);
               await new FinancialFinalizationGuard(tenantId).assertDateOpen(Number(branchid), billingResult[0].billedon);

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
                         const source = await lockMutableBill(conn, tenantId, billingid);
                         if (Number(source.islocked) === 1) throw new Error('Transaction is locked');
                         if (Number(source.outstanding) !== Number(writeOffAmount)) throw new Error('Outstanding balance changed; reload before writing off');

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

                         await enqueueBillingWriteOff(tenantId, billingid, writeOffAmount, employeeid, conn);

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

     static async refundCompletelyTransaction(tenantId: number, employeeid: number, billingid: number, paymentmode: number, message?: string, requestKey = `refund-all-billing-${billingid}`): Promise<boolean> {
          return new BillingRefundService(tenantId).refund({ billingid, employeeid, selectedPaymentMode: paymentmode,
               request_key: requestKey, all: true, reason: message || 'Transaction refund' });
     }
}
