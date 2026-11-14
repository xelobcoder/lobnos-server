import KnexConnection from "../../database/KnexConnections";
import ExpenseInvoiceRepo from "./ExpenseInvoiceRepo";
import Expenses from "./ExpenseService";
import logger from "../../hooks/logger";

export interface LifecycleData {
    amount: number;
    name: string;
    description: string;
    categoryName: string;
    merchantName: string;
    merchantEmail?: string;
    merchantPhone?: string;
    date: Date | string;
    branchid: number;
    employeeid: number;
    serviceid?: number;
    isassociatedservice?: number;
    paymentMethod?: string;
    invoicePrefix?: string;
}

/**
 * AutomatedExpenseLifecycle
 * A reusable class to handle the 4-stage expense lifecycle:
 * 1. Create Expense
 * 2. Approve Expense
 * 3. Create Invoice
 * 4. Record Payment
 */
export default class AutomatedExpenseLifecycle {
    private tenantId: number;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
    }

    /**
     * Process the full expense lifecycle from creation to payment
     * @param data LifecycleData
     * @param trx Optional transaction
     */
    async process(data: LifecycleData, trx?: any) {
        const connection = await KnexConnection(this.tenantId);
        const useTransaction = trx || await connection.transaction();
        const shouldCommit = !trx;

        try {
            // 1. Get or Create Category
            let categoryId: number;
            const expenseCategoryRecord = await useTransaction('dboexpensecategory')
                .whereRaw("LOWER(REPLACE(REPLACE(category, ' ', '_'), '-', '_')) = ?", [normalizeCategoryName(data.categoryName)])
                .first();

            if (!expenseCategoryRecord) {
                throw new Error(`Expense category ${data.categoryName} is not configured`);
            }
            categoryId = expenseCategoryRecord.id;

            // 2. Get or Create Merchant
            let merchantId: number;
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
            } else {
                merchantId = merchantRecord.id;
            }

            // 3. Initialize Repos
            const invoiceRepo = new ExpenseInvoiceRepo(data.employeeid, data.branchid, this.tenantId);
            const expenseService = new Expenses(data.employeeid, data.branchid, this.tenantId);

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
            const expenseData = await invoiceRepo.createExpensesAndInvoice([expenseRecord as any], {
                invoice_number: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                invoice_date: new Date(data.date).toISOString().split('T')[0],
                merchant_id: merchantId,
                total_amount: data.amount,
                status: 'Paid'
            }, useTransaction);

            // 5. Stage 2: Approve the expense
            await expenseService.updateExpenseDecision(
                this.tenantId,
                "approved",
                [{
                    expenseid: expenseData.expenseIds[0],
                    information: `Automated approval for ${data.name}`,
                    employeeid: data.employeeid
                }],
                useTransaction
            );

            // 6. Stage 4: Record the payment for the invoice
            const paymentResult = await invoiceRepo.addPayment({
                expense_id: expenseData.expenseIds[0],
                invoice_id: expenseData.invoiceId,
                payment_date: new Date(data.date).toISOString().split('T')[0],
                method: data.paymentMethod || 'SYSTEM_AUTO',
                amount: data.amount,
                status: 'Paid'
            }, useTransaction);

            await useTransaction('expensesrecord').where({ id: expenseData.expenseIds[0] }).update({
                workflow_status: 'paid',
                workflow_version: useTransaction.raw('workflow_version + 1'),
                paid_by: data.employeeid,
                paid_at: new Date(),
            });

            if (shouldCommit) await useTransaction.commit();

            return {
                success: true,
                expenseId: expenseData.expenseIds[0],
                invoiceId: expenseData.invoiceId,
                paymentId: paymentResult?.paymentId,
                merchantId,
                categoryId
            };

        } catch (error) {
            if (shouldCommit) await useTransaction.rollback();
            logger.error('Error in AutomatedExpenseLifecycle:', error);
            throw error;
        }
    }
}

function normalizeCategoryName(category: string): string {
    return category.trim().toLowerCase().replace(/[\s-]+/g, '_');
}
