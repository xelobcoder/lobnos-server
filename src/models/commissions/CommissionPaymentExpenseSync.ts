import logger from "../../hooks/logger";
import KnexConnection from "../../database/KnexConnections";
import ExpenseInvoiceRepo from "../Expenses/ExpenseInvoiceRepo";
import Expenses from "../Expenses/ExpenseService";
import { any } from "zod";

/**
 * CommissionPaymentExpenseSync
 * Automatically converts commission batch payments into expenses with invoices
 * Similar to supplier and payroll payment to expense conversion
 */
export class CommissionPaymentExpenseSync {
     /**
      * Convert a commission batch payment to an expense
      * @param tenantId - Tenant ID
      * @param data - Payment data containing batch payment ID, employee ID, and branch ID
      * @param trx - Optional transaction to use (for atomic operations)
      */
     static async markCommissionPaymentAsExpense(tenantId: number, data: {
          batchPaymentId: number;
          employeeid: number;
          branchid: number;
     }, trx?: any) {
          const connection = await KnexConnection(tenantId);
          const useTransaction = trx || await connection.transaction();
          const shouldCommit = !trx; // Only commit if we created our own transaction

          try {
               const { batchPaymentId, employeeid, branchid } = data;

               // Fetch the commission batch payment record
               const batchPayment = await useTransaction('commission_batch_payments')
                    .where('id', batchPaymentId)
                    .first();

               if (!batchPayment) {
                    throw new Error("Commission batch payment not found");
               }

               // Check if already synced to expense
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

               // Get recipient information (clinician or organization)
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

               // Get or create expense category for commissions
               let category: number | null = null;
               const expenseCategoryRecord = await useTransaction('dboexpensecategory')
                    .where({ category: "commission_payments" })
                    .first();

               if (!expenseCategoryRecord) {
                    const [newCategoryId] = await useTransaction('dboexpensecategory')
                         .insert({
                              category: "commission_payments",
                              createdon: new Date(),
                              employeeid,
                         });
                    category = newCategoryId;
               } else {
                    category = expenseCategoryRecord.id;
               }

               // Get or create expense merchant for commissions
               let merchantid: number | null = null;
               const merchantRecord = await useTransaction('expense_merchants')
                    .where({ name: 'COMMISSION PAYMENTS' })
                    .first();

               if (!merchantRecord) {
                    const [newMerchantId] = await useTransaction('expense_merchants')
                         .insert({
                              name: 'COMMISSION PAYMENTS',
                              email: "system-commission-automated",
                              phone: "0000000000",
                              notes: `Auto created merchant for commission payments`,
                              created_at: new Date(),
                              created_by: employeeid,
                         });
                    merchantid = newMerchantId;
               } else {
                    merchantid = merchantRecord.id;
               }

               // Create expense record for the commission batch payment
               const expenseRecord = {
                    isassociatedservice: 0,
                    serviceid: null,
                    branchid,
                    category,
                    employeeid,
                    amount: batchPayment.payment_amount,
                    merchant: merchantid,
                    date: new Date(batchPayment.payment_date || batchPayment.created_at),
                    id: null,
                    createdon: new Date(),
                    approvedby: null,
                    approved: 0,
                    approvedon: null,
                    name: `Commission Payment - ${batchPayment.batch_reference}`,
                    description: `Commission payment to ${batchPayment.recipient_type} - ${recipientName} for period ${batchPayment.start_date} to ${batchPayment.end_date}. Batch Reference: ${batchPayment.batch_reference}`
               };

               // Create expense and invoice
               const invoiceRepo = new ExpenseInvoiceRepo(employeeid, branchid, tenantId);

               const expenseData = await invoiceRepo.createExpensesAndInvoice([expenseRecord] as any, {
                    invoice_number: `COMM-${batchPaymentId}-${Math.floor(Date.now() / 1000)}`,
                    invoice_date: new Date(batchPayment.payment_date || batchPayment.created_at) as any,
                    due_date: new Date(batchPayment.payment_date || batchPayment.created_at) as any,
                    merchant_id: merchantid!,
                    tax_amount: 0,
                    total_amount: batchPayment.payment_amount,
                    status: 'Paid'
               }, useTransaction);

               // Auto-approve the expense
               const expenseService = new Expenses(employeeid, branchid, tenantId);
               const expenseApproval = await expenseService.updateExpenseDecision(
                    tenantId,
                    "approved",
                    [{
                         expenseid: expenseData.expenseIds[0],
                         information: `Commission payment for ${recipientName}`,
                         employeeid
                    }],
                    useTransaction
               );

               if (!expenseApproval) {
                    throw new Error("Failed to approve commission payment expense");
               }

               // Record the payment
               const paymentResult = await invoiceRepo.addPayment({
                    expense_id: expenseData.expenseIds[0],
                    invoice_id: expenseData.invoiceId,
                    payment_date: batchPayment.payment_date || new Date(),
                    method: batchPayment.payment_method || 'SYSTEM_AUTO',
                    amount: batchPayment.payment_amount
               }, useTransaction);

               // Update commission batch payment with expense sync info
               await useTransaction('commission_batch_payments')
                    .where('id', batchPaymentId)
                    .update({
                         expense_synced: true,
                         expense_id: expenseData.expenseIds[0],
                         expense_invoice_id: expenseData.invoiceId,
                         expense_payment_id: paymentResult?.paymentId || null,
                         updated_at: new Date() as any
                    });

               // Get the services in this batch and update them too (optional - for tracking)
               const batchServices = await useTransaction('commission_batch_payment_services')
                    .where('batch_payment_id', batchPaymentId);

               for (const service of batchServices) {
                    await useTransaction('commission_batch_payment_services')
                         .where('id', service.id)
                         .update({
                              expense_synced: true,
                              expense_id: expenseData.expenseIds[0]
                         });
               }

               if (shouldCommit) await useTransaction.commit();

               return {
                    success: true,
                    message: "Commission payment successfully converted to expense",
                    expense_id: expenseData.expenseIds[0],
                    invoice_id: expenseData.invoiceId,
                    expense_payment_id: paymentResult?.paymentId || null,
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

     /**
      * Convert multiple commission batch payments to expenses
      * Useful for batch processing
      */
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
