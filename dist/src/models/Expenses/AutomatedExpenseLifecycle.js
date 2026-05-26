"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const ExpenseInvoiceRepo_1 = __importDefault(require("./ExpenseInvoiceRepo"));
const ExpenseService_1 = __importDefault(require("./ExpenseService"));
const logger_1 = __importDefault(require("../../hooks/logger"));
/**
 * AutomatedExpenseLifecycle
 * A reusable class to handle the 4-stage expense lifecycle:
 * 1. Create Expense
 * 2. Approve Expense
 * 3. Create Invoice
 * 4. Record Payment
 */
class AutomatedExpenseLifecycle {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    /**
     * Process the full expense lifecycle from creation to payment
     * @param data LifecycleData
     * @param trx Optional transaction
     */
    async process(data, trx) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const useTransaction = trx || await connection.transaction();
        const shouldCommit = !trx;
        try {
            // 1. Get or Create Category
            let categoryId;
            const expenseCategoryRecord = await useTransaction('dboexpensecategory')
                .where({ category: data.categoryName })
                .first();
            if (!expenseCategoryRecord) {
                const [newCategoryId] = await useTransaction('dboexpensecategory')
                    .insert({
                    category: data.categoryName,
                    createdon: new Date(),
                    employeeid: data.employeeid,
                });
                categoryId = newCategoryId;
            }
            else {
                categoryId = expenseCategoryRecord.id;
            }
            // 2. Get or Create Merchant
            let merchantId;
            const merchantRecord = await useTransaction('expense_merchants')
                .where({ name: data.merchantName })
                .first();
            if (!merchantRecord) {
                const [newMerchantId] = await useTransaction('expense_merchants')
                    .insert({
                    name: data.merchantName,
                    email: data.merchantEmail || "system-automated@lobnos.com",
                    phone: data.merchantPhone || "0000000000",
                    notes: `Auto created merchant for ${data.categoryName}`,
                    created_at: new Date(),
                    created_by: data.employeeid,
                });
                merchantId = newMerchantId;
            }
            else {
                merchantId = merchantRecord.id;
            }
            // 3. Initialize Repos
            const invoiceRepo = new ExpenseInvoiceRepo_1.default(data.employeeid, data.branchid, this.tenantId);
            const expenseService = new ExpenseService_1.default(data.employeeid, data.branchid, this.tenantId);
            // 4. Stage 1 & 3: Create Expense and Invoice
            const expenseRecord = {
                name: data.name,
                amount: data.amount,
                category: categoryId,
                merchant: merchantId,
                description: data.description,
                employeeid: data.employeeid,
                branchid: data.branchid,
                date: data.date,
                createdon: new Date(),
                approved: 0,
                approvedby: null,
                approvedon: null,
                isassociatedservice: data.isassociatedservice || 0,
                serviceid: data.serviceid || null
            };
            const prefix = data.invoicePrefix || data.categoryName.toUpperCase().replace(/\s+/g, '-');
            const expenseData = await invoiceRepo.createExpensesAndInvoice([expenseRecord], {
                invoice_number: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                invoice_date: new Date(data.date).toISOString().split('T')[0],
                merchant_id: merchantId,
                total_amount: data.amount,
                status: 'Paid'
            }, useTransaction);
            // 5. Stage 2: Approve the expense
            await expenseService.updateExpenseDecision(this.tenantId, "approved", [{
                    expenseid: expenseData.expenseIds[0],
                    information: `Automated approval for ${data.name}`,
                    employeeid: data.employeeid
                }], useTransaction);
            // 6. Stage 4: Record the payment for the invoice
            const paymentResult = await invoiceRepo.addPayment({
                expense_id: expenseData.expenseIds[0],
                invoice_id: expenseData.invoiceId,
                payment_date: new Date(data.date).toISOString().split('T')[0],
                method: data.paymentMethod || 'SYSTEM_AUTO',
                amount: data.amount,
                status: 'Paid'
            }, useTransaction);
            if (shouldCommit)
                await useTransaction.commit();
            return {
                success: true,
                expenseId: expenseData.expenseIds[0],
                invoiceId: expenseData.invoiceId,
                paymentId: paymentResult === null || paymentResult === void 0 ? void 0 : paymentResult.paymentId,
                merchantId,
                categoryId
            };
        }
        catch (error) {
            if (shouldCommit)
                await useTransaction.rollback();
            logger_1.default.error('Error in AutomatedExpenseLifecycle:', error);
            throw error;
        }
    }
}
exports.default = AutomatedExpenseLifecycle;
