import { error } from "winston";
import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import ExpenseInvoiceRepo from "../Expenses/ExpenseInvoiceRepo";
import Expenses from "../Expenses/ExpenseService";

export class SupplierPaymentExpenseSync {
     static async markSupplierPaymentAsExpense(tenantId: number, data: {
          paymentId: string,
          employeeid: number,
          branchid: number
     }) {
          const connection = await KnexConnection(tenantId);
          const trx = await connection.transaction();

          try {
               const { paymentId, employeeid, branchid } = data;

               const paymentRecord = await trx('inv_supplier_payments')
                    .where('id', paymentId)
                    .first();

               if (!paymentRecord) {
                    throw new Error("Payment not found");
               }

               const isAlreadySynced = !!paymentRecord.expense_synced || !!paymentRecord.expense_id || !!paymentRecord.expense_invoice_id;
               if (isAlreadySynced) {
                    await trx.rollback();
                    return {
                         success: true,
                         message: "Supplier payment already synced to expense",
                         expense_id: paymentRecord.expense_id || null,
                         invoice_id: paymentRecord.expense_invoice_id || null,
                         requiresApproval: false
                    };
               }

               const supplierRecord = await trx('inv_suppliers')
                    .where('id', paymentRecord.supplier_id)
                    .first();

               if (!supplierRecord) {
                    throw new Error("Supplier not found");
               }

               const dboexpensecategoryRecord = await trx('dboexpensecategory')
                    .where({ category: "supplier_payments" })
                    .first();

               let category: number | null = null;

               if (!dboexpensecategoryRecord) {
                    const [newCategoryId] = await trx('dboexpensecategory')
                         .insert({
                              category: "supplier_payments",
                              createdon: new Date(),
                              employeeid,
                         });
                    category = newCategoryId;
               } else {
                    category = dboexpensecategoryRecord.id;
               }

               const merchantRecord = await trx('expense_merchants')
                    .where({ name: 'SUPPLIER PAYMENTS' })
                    .first();
               let merchantid: number | null = null;

               if (!merchantRecord) {
                    const [newMerchantId] = await trx('expense_merchants')
                         .insert({
                              name: 'SUPPLIER PAYMENTS',
                              email: "system-supplier-automated",
                              phone: "0000000000",
                              notes: `Auto created merchant for suppliers payments`,
                              created_at: new Date(),
                              created_by: employeeid,
                         });
                    merchantid = newMerchantId;
               } else {
                    merchantid = merchantRecord.id;
               }


               const expenseRecord = {
                    isassociatedservice: 0,
                    serviceid: null,
                    branchid,
                    category,
                    employeeid,
                    amount: paymentRecord.payment_amount,
                    merchant: merchantid,
                    date: new Date(paymentRecord.payment_date),
                    id: null,
                    createdon: new Date(),
                    approvedby: null,
                    approved: 0,
                    approvedon: null,
                    name: `Supplier Payment Expense - ${paymentRecord.payment_id}`,
                    description: `Payment to supplier ${supplierRecord.name} for purchase order ${paymentRecord.purchase_order_id} on ${paymentRecord.payment_date}`
               };



               const invoiceRepo = new ExpenseInvoiceRepo(employeeid, branchid, tenantId);


               const expense = await invoiceRepo.createExpensesAndInvoice([expenseRecord], {
                    invoice_number: 'INV-' + paymentRecord.payment_id + '-' + Date.now(),
                    invoice_date: new Date(paymentRecord.payment_date) as any,
                    due_date: new Date(paymentRecord.payment_date) as any,
                    merchant_id: merchantid!,
                    tax_amount: 0,
                    total_amount: paymentRecord.payment_amount,
                    status: 'Paid'
               }, trx);


               const expenseApproval = await new Expenses(employeeid, branchid, tenantId)
                    .updateExpenseDecision(tenantId, "approved", [{ expenseid: expense.expenseIds[0], information: "Payment Made for Supplier", employeeid }], trx);

               if (expenseApproval) {

                    await invoiceRepo.addPayment({
                         expense_id: expense.expenseIds[0],
                         invoice_id: expense.invoiceId,
                         payment_date: paymentRecord.payment_date,
                         method: paymentRecord.payment_method,
                         amount: paymentRecord.payment_amount
                    }, trx)


                    await trx('inv_supplier_payments')
                         .where('id', paymentId)
                         .update({
                              expense_synced: true,
                              expense_id: expense.expenseIds[0],
                              expense_invoice_id: expense.invoiceId,
                              updated_at: new Date() as any
                         });


                    await trx.commit();

               } else {
                    throw new Error("Failed to approve expense for supplier payment");
               }


               return {
                    success: true,
                    message: "Supplier payment successfully synced to expense",
                    expense_id: expense.expenseIds[0],
                    invoice_id: expense.invoiceId,
                    requiresApproval: expense.requiresApproval
               };

          } catch (err) {
               await trx.rollback();
               logger.error('Error in markSupplierPaymentAsExpense:', err);
               throw err;
          }
     }
}
