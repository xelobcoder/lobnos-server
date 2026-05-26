"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierPaymentExpenseSync = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../hooks/logger"));
const AutomatedExpenseLifecycle_1 = __importDefault(require("../Expenses/AutomatedExpenseLifecycle"));
class SupplierPaymentExpenseSync {
    static async markSupplierPaymentAsExpense(tenantId, data) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
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
            const lifecycle = new AutomatedExpenseLifecycle_1.default(tenantId);
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
            await trx('inv_supplier_payments')
                .where('id', paymentId)
                .update({
                expense_synced: true,
                expense_id: lifecycleResult.expenseId,
                expense_invoice_id: lifecycleResult.invoiceId,
                updated_at: new Date()
            });
            await trx.commit();
            return {
                success: true,
                message: "Supplier payment successfully synced to expense",
                expense_id: lifecycleResult.expenseId,
                invoice_id: lifecycleResult.invoiceId,
                requiresApproval: false
            };
        }
        catch (err) {
            await trx.rollback();
            logger_1.default.error('Error in markSupplierPaymentAsExpense:', err);
            throw err;
        }
    }
}
exports.SupplierPaymentExpenseSync = SupplierPaymentExpenseSync;
