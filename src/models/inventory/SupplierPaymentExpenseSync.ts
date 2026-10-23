import KnexConnection from "../../database/KnexConnections";
import logger from "../../hooks/logger";
import AutomatedExpenseLifecycle from "../Expenses/AutomatedExpenseLifecycle";

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

               const lifecycle = new AutomatedExpenseLifecycle(tenantId);
               const lifecycleResult = await lifecycle.process({
                    amount: paymentRecord.payment_amount,
                    name: `Supplier Payment Expense - ${paymentRecord.payment_id}`,
                    description: `Payment to supplier ${supplierRecord.name} for purchase order ${paymentRecord.purchase_order_id} on ${paymentRecord.payment_date}`,
                    categoryName: "supplier_payments",
                    merchantName: "SUPPLIER PAYMENTS",
                    merchantEmail: "system-supplier-automated",
                    date: new Date(paymentRecord.payment_date),
                    branchid,
                    employeeid,
                    paymentMethod: paymentRecord.payment_method,
                    invoicePrefix: "SUPP-INV"
               }, trx);

               if (lifecycleResult.paymentId && paymentRecord.payment_account_id) {
                    await trx('expense_payments').where({ id: lifecycleResult.paymentId }).update({
                         payment_account_id: paymentRecord.payment_account_id,
                         branchid: paymentRecord.branchid || branchid,
                         currency: 'GHS',
                    });
               }

               await trx('inv_supplier_payments')
                    .where('id', paymentId)
                    .update({
                         expense_synced: true,
                         expense_id: lifecycleResult.expenseId,
                         expense_invoice_id: lifecycleResult.invoiceId,
                         updated_at: new Date() as any
                    });

               await trx.commit();

               return {
                    success: true,
                    message: "Supplier payment successfully synced to expense",
                    expense_id: lifecycleResult.expenseId,
                    invoice_id: lifecycleResult.invoiceId,
                    requiresApproval: false
               };

          } catch (err) {
               await trx.rollback();
               logger.error('Error in markSupplierPaymentAsExpense:', err);
               throw err;
          }
     }
}
