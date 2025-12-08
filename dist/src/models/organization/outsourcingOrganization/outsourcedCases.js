"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
const logger_1 = __importDefault(require("../../../hooks/logger"));
const ExpenseInvoiceRepo_1 = __importDefault(require("../../Expenses/ExpenseInvoiceRepo"));
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
    static async markOutsourceCasesAsExpense(tenantId, data) {
        try {
            const { branchid, employeeid, testid, serviceid, trackingid, outsourcedid } = data;
            const connection = await (0, KnexConnections_1.default)(tenantId);
            // check merchants to ensure outsource is a valid merchant, if not  create it
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
            //  ensure merchant exists or create it
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
            //  load the information from dboservices 
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
                id: null,
                createdon: new Date(),
                approvedby: null,
                approved: 0,
                approvedon: null,
                name: 'Outsource Expense for service ' + data.serviceid,
                description: 'Outsource Expense Due to service ' + data.serviceid + ' at ' + new Date() + ' by employee with ID' + employeeid
            };
            const invoiceRepo = new ExpenseInvoiceRepo_1.default(employeeid, branchid, tenantId);
            const expense = await invoiceRepo.createExpensesAndInvoice([expenseRecord], {
                invoice_number: null,
                invoice_date: new Date(),
                due_date: new Date(),
                merchant_id: merchantid,
                tax_amount: 0,
                total_amount: outsourcePrice,
                status: 'Pending'
            });
            return expense;
        }
        catch (err) {
            logger_1.default.error('Error in markOutsourceCasesAsExpense:', err);
            throw err;
        }
    }
}
exports.default = OutsourcedCases;
