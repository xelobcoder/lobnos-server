import logger from "../../hooks/logger";
import KnexConnection from "../../database/KnexConnections";
import ExpenseInvoiceRepo from '../Expenses/ExpenseInvoiceRepo';

export class CommissionPaymentExpenseSync {
     static async markCommissionPaymentAsExpense(tenantId: number, data: {
          batchPaymentId: number;
          employeeid: number;
          branchid: number;
     }, trx?: any) {
          const connection = await KnexConnection(tenantId);
          const useTransaction = trx || await connection.transaction();
          const shouldCommit = !trx;

          try {
               const { batchPaymentId, employeeid, branchid } = data;

               const batchPayment = await useTransaction('commission_batch_payments')
                    .where('id', batchPaymentId)
                    .forUpdate()
                    .first();

               if (!batchPayment) {
                    throw new Error("Commission batch payment not found");
               }

               const isAlreadySynced = !!batchPayment.expense_synced ||
                    !!batchPayment.expense_id ||
                    !!batchPayment.expense_invoice_id;
               if (isAlreadySynced) {
                    if (shouldCommit) await useTransaction.rollback();
                    return {
                         success: true,
                         message: "Commission payment already synced to expense",
                         expense_id: batchPayment.expense_id || null,
                         invoice_id: batchPayment.expense_invoice_id || null,
                         expense_payment_id: batchPayment.expense_payment_id || null,
                         requiresApproval: false
                    };
               }

               let recipientName = "Unknown";
               if (batchPayment.recipient_type === 'clinician') {
                    const clinician = await useTransaction('clinicianbasicinfo')
                         .where('id', batchPayment.recipient_id)
                         .first();
                    recipientName = clinician?.name || `Clinician ${batchPayment.recipient_id}`;
               } else if (batchPayment.recipient_type === 'organization') {
                    const org = await useTransaction('organization')
                         .where('id', batchPayment.recipient_id)
                         .first();
                    recipientName = org?.name || `Organization ${batchPayment.recipient_id}`;
               }

               const amount = Number(batchPayment.total_commission_amount) - Number(batchPayment.waived_amount || 0);
               if (!(amount > 0)) throw new Error('A payment request must have a positive payable balance');
               const category = await useTransaction('dboexpensecategory').whereRaw("LOWER(REPLACE(REPLACE(category, ' ', '_'), '-', '_')) = ?", ['commission_payments']).first();
               if (!category) throw new Error('Commission payments expense category is not configured');
               let merchant = await useTransaction('expense_merchants').where({ name: 'COMMISSION PAYMENTS' }).first();
               if (!merchant) {
                    const [id] = await useTransaction('expense_merchants').insert({ name: 'COMMISSION PAYMENTS', created_by: employeeid });
                    merchant = { id };
               }
               let requestNotes: any = {};
               try { requestNotes = JSON.parse(batchPayment.notes || '{}'); } catch { /* Legacy notes remain descriptive text. */ }
               const lifecycleResult = await new ExpenseInvoiceRepo(employeeid, branchid, tenantId).createExpensesAndInvoice([{
                    amount,
                    name: `Commission Request - ${batchPayment.batch_reference}`,
                    description: `Commission request for ${recipientName}. Batch: ${batchPayment.batch_reference}. Payable obligation: GHS ${amount.toFixed(2)}. Requested initial payment: GHS ${Number(requestNotes.requested_payment || amount).toFixed(2)}. Approval and account-authorized payment are separate. ${requestNotes.waiver_reason ? 'Waiver reason: ' + requestNotes.waiver_reason : 'Unpaid amounts remain outstanding.'}`,
                    category: category.id,
                    merchant: merchant.id,
                    date: new Date(batchPayment.payment_date || batchPayment.created_at),
                    branchid,
                    employeeid,
               } as any], { invoice_number: `COMM-${batchPayment.batch_reference}`, invoice_date: new Date().toISOString().slice(0, 10), merchant_id: merchant.id, total_amount: amount, status: 'Pending' }, useTransaction);
               const expenseId = lifecycleResult.expenseIds[0];

               await useTransaction('commission_batch_payments')
                    .where('id', batchPaymentId)
                    .update({
                         expense_synced: true,
                         expense_id: expenseId,
                         expense_invoice_id: lifecycleResult.invoiceId,
                         expense_payment_id: null,
                         updated_at: new Date() as any
                    });

               const batchServices = await useTransaction('commission_batch_payment_services')
                    .where('batch_payment_id', batchPaymentId);

               for (const service of batchServices) {
                    await useTransaction('commission_batch_payment_services')
                         .where('id', service.id)
                         .update({
                              expense_synced: true,
                              expense_id: expenseId
                         });
               }

               if (shouldCommit) await useTransaction.commit();

               return {
                    success: true,
                    message: "Commission payment successfully converted to expense",
                    expense_id: expenseId,
                    invoice_id: lifecycleResult.invoiceId,
                    expense_payment_id: null,
                    requiresApproval: true
               };

          } catch (error: any) {
               if (shouldCommit) await useTransaction.rollback();
               logger.error('Error in markCommissionPaymentAsExpense:', error);
               return {
                    success: false,
                    message: error?.message || 'Failed to convert commission payment to expense',
                    error
               };
          }
     }

     static async markMultipleCommissionPaymentsAsExpense(
          tenantId: number,
          payments: Array<{
               batchPaymentId: number;
               employeeid: number;
               branchid: number;
          }>
     ) {
          const results = [];

          for (const payment of payments) {
               try {
                    const result = await this.markCommissionPaymentAsExpense(tenantId, payment);
                    results.push({
                         batchPaymentId: payment.batchPaymentId,
                         ...result
                    });
               } catch (error: any) {
                    results.push({
                         batchPaymentId: payment.batchPaymentId,
                         success: false,
                         message: error?.message || 'Failed to process payment'
                    });
               }
          }

          return results;
     }
}

export default CommissionPaymentExpenseSync;
