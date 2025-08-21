"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
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
            const { branchid, employeeid, testid, serviceid, trackingid } = data;
            const connection = await (0, KnexConnections_1.default)(tenantId);
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
                category: outsourceid,
                employeeid,
                amount: outsourcePrice,
                mode: 1,
                merchant: outsourceid,
                date: new Date(),
                name: 'Outsource Expense',
                description: 'Outsource Expense Due to service ' + data.serviceid + ' at ' + new Date() + ' by employee with ID' + employeeid
            };
            // Check for existing expense record with same serviceid
            const existingExpense = await connection('expensesrecord')
                .where({ serviceid: data.serviceid })
                .first();
            let result;
            if (existingExpense) {
                // Update the existing expense record
                result = await connection('expensesrecord')
                    .where({ serviceid: data.serviceid })
                    .update(expenseRecord);
                return result > 0;
            }
            else {
                // Insert the expense record
                result = await connection('expensesrecord').insert(expenseRecord);
                return Array.isArray(result) && result.length > 0;
            }
        }
        catch (err) {
            console.error("Error fetching service information: ", err);
        }
    }
}
exports.default = OutsourcedCases;
