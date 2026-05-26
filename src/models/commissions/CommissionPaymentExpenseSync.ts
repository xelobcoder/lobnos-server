import logger from "../../hooks/logger";
import KnexConnection from "../../database/KnexConnections";
import AutomatedExpenseLifecycle from "../Expenses/AutomatedExpenseLifecycle";

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

               const lifecycle = new AutomatedExpenseLifecycle(tenantId);
               const lifecycleResult = await lifecycle.process({
                    amount: batchPayment.payment_amount,
                    name: `Commission Payment - ${batchPayment.batch_reference}`,
                    description: `Commission payment to ${batchPayment.recipient_type} - ${recipientName} for period ${batchPayment.start_date} to ${batchPayment.end_date}. Batch Reference: ${batchPayment.batch_reference}`,
                    categoryName: "commission_payments",
                    merchantName: "COMMISSION PAYMENTS",
                    merchantEmail: "system-commission-automated",
                    date: new Date(batchPayment.payment_date || batchPayment.created_at),
                    branchid,
                    employeeid,
                    paymentMethod: batchPayment.payment_method || 'SYSTEM_AUTO',
                    invoicePrefix: "COMM"
               }, useTransaction);

               await useTransaction('commission_batch_payments')
                    .where('id', batchPaymentId)
                    .update({
                         expense_synced: true,
                         expense_id: lifecycleResult.expenseId,
                         expense_invoice_id: lifecycleResult.invoiceId,
                         expense_payment_id: lifecycleResult.paymentId || null,
                         updated_at: new Date() as any
                    });

               const batchServices = await useTransaction('commission_batch_payment_services')
                    .where('batch_payment_id', batchPaymentId);

               for (const service of batchServices) {
                    await useTransaction('commission_batch_payment_services')
                         .where('id', service.id)
                         .update({
                              expense_synced: true,
                              expense_id: lifecycleResult.expenseId
                         });
               }

               if (shouldCommit) await useTransaction.commit();

               return {
                    success: true,
                    message: "Commission payment successfully converted to expense",
                    expense_id: lifecycleResult.expenseId,
                    invoice_id: lifecycleResult.invoiceId,
                    expense_payment_id: lifecycleResult.paymentId || null,
                    requiresApproval: false
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
