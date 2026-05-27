"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../../hooks/logger"));
const AutomatedExpenseLifecycle_1 = __importDefault(require("../../Expenses/AutomatedExpenseLifecycle"));
const ExpenseService_1 = __importDefault(require("../../Expenses/ExpenseService"));
class OutsourcedCases {
    static async getOutsourcedCases(tenantId, pagination) {
        const { count, page, orderby = 'DESC' } = pagination;
        const conn = await (0, KnexConnections_1.default)(tenantId);
        return await conn('outsourcedtesttracking as ott')
            .select('ott.id as tracking_id', 'ott.serviceid', 'ott.testid', 'tp.name as test_name', 'tp.category', 'tp.price', 'tp.unit', 'ott.employeeid', 'er.approvedon', 'er.approvedby', 'er.approved', 'ott.status', 'ott.comments', 'ott.createdOn', 'ott.updatedOn', 'ott.outsourceid', 'ott.completedconfirmedby', 'er.id as expense_id', 'er.amount as expense_amount', 'er.date as expense_date', 'er.merchant as expense_merchant')
            .join('test_panels as tp', 'ott.testid', 'tp.id')
            .leftJoin('expensesrecord as er', 'ott.serviceid', 'er.serviceid')
            .orderBy('ott.createdOn', orderby)
            .limit(count)
            .offset((page - 1) * count);
    }
    static async createOutsourcedCase(tenantId, data, trx) {
        const connection = trx || await (0, KnexConnections_1.default)(tenantId);
        const inserted = await connection('outsourcedtesttracking')
            .insert({
            serviceid: data.serviceid,
            testid: data.testid,
            outsourceid: data.outsourceid,
            employeeid: data.employeeid
        });
        return inserted;
    }
    static async markOutsourceTrackingDone(tenantId, data) {
        const conn = await (0, KnexConnections_1.default)(tenantId);
        const updateData = {
            status: 1,
            updatedOn: new Date(),
            completedconfirmedby: data.employeeId
        };
        if (data.comments)
            updateData.comments = data.comments;
        const result = await conn('outsourcedtesttracking')
            .where({ id: data.trackingId })
            .update(updateData);
        return result > 0;
    }
    static async countUnmarkedOutsourcedCases(tenantId) {
        var _a;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection('outsourcedtesttracking as ott')
            .leftJoin('expensesrecord as er', function () {
            this.on('ott.serviceid', '=', 'er.serviceid')
                .andOn('er.isassociatedservice', '=', connection.raw('?', [1]));
        })
            .whereNull('er.id')
            .countDistinct('ott.id as count');
        return Number(((_a = result[0]) === null || _a === void 0 ? void 0 : _a.count) || 0);
    }
    static async markOutsourceCasesAsExpense(tenantId, data, trx) {
        try {
            const { branchid, employeeid, serviceid, trackingid } = data;
            const connection = trx || await (0, KnexConnections_1.default)(tenantId);
            const existingExpense = await connection('expensesrecord')
                .where({ serviceid: data.serviceid, isassociatedservice: 1 })
                .first();
            if (existingExpense) {
                throw new Error("Expense already exists for this outsourced service");
            }
            const dboexpensecategoryRecord = await connection('dboexpensecategory')
                .where({ category: "outsourcing" })
                .first();
            let category = null;
            if (!dboexpensecategoryRecord) {
                const [newCategoryId] = await connection('dboexpensecategory')
                    .insert({
                    category: "outsourcing",
                    createdon: new Date(),
                    employeeid,
                });
                category = newCategoryId;
            }
            else {
                category = dboexpensecategoryRecord.id;
            }
            const merchantRecord = await connection('expense_merchants')
                .where({ name: "outsourcing" })
                .first();
            let merchantid = null;
            if (!merchantRecord) {
                const [newMerchantId] = await connection('expense_merchants')
                    .insert({
                    name: "outsourcing",
                    email: "system",
                    phone: "0000000000",
                    notes: "Auto created merchant for outsourcing",
                    created_at: new Date(),
                    created_by: employeeid,
                });
                merchantid = newMerchantId;
            }
            else {
                merchantid = merchantRecord.id;
            }
            const serviceInformation = await connection('dboservices')
                .select('isoutsourced', 'outsourceid')
                .where({ serviceid: serviceid, isoutsourced: 1 })
                .first();
            if (!serviceInformation)
                throw new Error("Service not found");
            const { outsourceid } = serviceInformation;
            const outsourceOrganizationInformation = await connection('outsourceorganizationservices')
                .select('outsourcePrice')
                .where({ outsourceid: outsourceid })
                .first();
            if (!outsourceOrganizationInformation)
                throw new Error("Outsource organization not found");
            const { outsourcePrice } = outsourceOrganizationInformation;
            const expenseRecord = {
                isassociatedservice: 1,
                serviceid: data.serviceid,
                branchid,
                category,
                employeeid,
                amount: outsourcePrice,
                merchant: merchantid,
                date: new Date(),
                createdon: new Date(),
                approvedby: null,
                approved: 0,
                approvedon: null,
                name: 'Outsource Expense for service ' + data.serviceid,
                description: 'Outsource Expense Due to service ' + data.serviceid + ' at ' + new Date() + ' by employee with ID' + employeeid
            };
            const expenseService = new ExpenseService_1.default(employeeid, branchid, tenantId, null, connection);
            const expenseId = await expenseService.generateNewExpense(expenseRecord, undefined, connection);
            return { expenseId };
        }
        catch (err) {
            logger_1.default.error('Error in markOutsourceCasesAsExpense:', err);
            throw err;
        }
    }
    static async triggerAutomatedExpenseLifecycle(tenantId, data, trx) {
        try {
            const { branchid, employeeid, serviceid, trackingid } = data;
            const connection = trx || await (0, KnexConnections_1.default)(tenantId);
            const existingExpense = await connection('expensesrecord')
                .where({ serviceid: data.serviceid, isassociatedservice: 1 })
                .first();
            if (existingExpense) {
                return { success: false, message: "Expense already exists" };
            }
            const serviceInformation = await connection('dboservices')
                .select('isoutsourced', 'outsourceid')
                .where({ serviceid: serviceid, isoutsourced: 1 })
                .first();
            if (!serviceInformation)
                throw new Error("Service not found");
            const { outsourceid } = serviceInformation;
            const outsourceOrganizationInformation = await connection('outsourceorganizationservices')
                .select('outsourcePrice')
                .where({ outsourceid: outsourceid })
                .first();
            if (!outsourceOrganizationInformation)
                throw new Error("Outsource organization not found");
            const { outsourcePrice } = outsourceOrganizationInformation;
            const paymentMode = await connection('paymentmodes')
                .where({ PaymentMode: 'Cash' })
                .first();
            const paymentMethod = paymentMode ? paymentMode.KeyID.toString() : '2';
            const lifecycle = new AutomatedExpenseLifecycle_1.default(tenantId);
            const result = await lifecycle.process({
                amount: outsourcePrice,
                name: 'Outsource Expense for service ' + data.serviceid,
                description: 'Automated Outsource Expense for service ' + data.serviceid + ' at ' + new Date(),
                categoryName: "outsourcing",
                merchantName: "outsourcing",
                date: new Date(),
                branchid,
                employeeid,
                serviceid: data.serviceid,
                isassociatedservice: 1,
                paymentMethod: paymentMethod,
                invoicePrefix: 'OUT-EXP'
            }, connection);
            return result;
        }
        catch (err) {
            logger_1.default.error('Error in triggerAutomatedExpenseLifecycle:', err);
            throw err;
        }
    }
}
exports.default = OutsourcedCases;
