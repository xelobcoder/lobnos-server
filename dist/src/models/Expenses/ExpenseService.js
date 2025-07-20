"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../hooks/helper");
const logger_1 = __importDefault(require("../../hooks/logger"));
const promises_1 = require("fs/promises");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const queries_1 = require("./queries");
const path_1 = __importDefault(require("path"));
class Expenses {
    constructor(employeeid, branchid, tenantId, expenseId = null) {
        this.employeeid = employeeid;
        this.branchid = branchid;
        this.tenantId = tenantId;
        this.expenseId = expenseId;
    }
    isExpenseApproved() {
        return;
    }
    getAdminRequest() { }
    getRequest() {
        if (!this.employeeid || !this.branchid) {
            throw new Error('branchid or employeeid not provided');
        }
    }
    async generateNewExpense(data) {
        try {
            if (Object.keys(data).length === 0 || typeof data !== 'object') {
                throw new TypeError('object with keys required');
            }
            const { employeeid, branchid, name, date, merchant, amount, mode, description, category } = data;
            if (!employeeid || !branchid || !name) {
                throw new Error('name, employeeid, branchid required');
            }
            if (category === 0 || !category) {
                throw new Error('category id not provided');
            }
            let inserted = await (0, helper_1.promisifyQuery)(this.tenantId, queries_1.generateNewExpenseQuery, [name, amount, mode, employeeid, branchid, description, merchant, category, date]);
            inserted = (0, helper_1.rowAffected)(inserted);
            return inserted;
        }
        catch (err) {
            console.log(err);
            logger_1.default.error(err === null || err === void 0 ? void 0 : err.message);
            throw new Error(err);
        }
    }
    async getExpensesRecord(tenantId, employeeid, branchid, status, pageQuery = { count: 10, page: 1 }, from, to, state) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(employeeid, tenantId);
        let role;
        let query = queries_1.getExpensesRecordQuery;
        let values = [];
        if (record.length > 0) {
            role = record[0]['role'];
        }
        if (!['admin', 'manager'].includes(role || '')) {
            query += ` WHERE er.employeeid = ? AND er.branchid = ?`;
            values = [employeeid, branchid];
        }
        else {
            query += ` WHERE er.employeeid = ?`;
            values = [employeeid];
        }
        if (status === 'approved') {
            query += ` AND er.approved = 1`;
        }
        else if (status === 'rejected') {
            query += ` AND er.approved = 2`;
        }
        else if (status === 'pending') {
            query += ` AND er.approved = 0`;
        }
        if (from && to) {
            query += ` AND er.date BETWEEN ? AND ?`;
            values.push(from, to);
        }
        if (state) {
            query += ` AND er.state = ?`;
            values.push(state);
        }
        query += ` ORDER BY er.id DESC LIMIT ? OFFSET ?`;
        return await (0, helper_1.paginationQuery)(pageQuery, query, values, tenantId);
    }
    async getExpenseImageList(expenseid) {
        try {
            let images = await (0, promises_1.readdir)(path_1.default.join(__dirname, queries_1.RECEIPTS_PATH));
            if (images.length > 0) {
                images = images.filter((item) => item.split("-")[0] === expenseid);
            }
            return images;
        }
        catch (err) {
            throw (err === null || err === void 0 ? void 0 : err.message) || err;
        }
    }
    async getSingleExpense(tenantId, expenseid) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.getExpenseImageListQuery, [parseInt(expenseid)]);
        if (result.length > 0) {
            const images = await this.getExpenseImageList(expenseid);
            result[0]['images'] = images;
            return result;
        }
        return result;
    }
    async isExpenseRecordAvailable() {
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, queries_1.isRecordExistQuery, [this.expenseId]);
        return Array.isArray(result) && result.length > 0;
    }
    async updateExpenseRecord(expenseData) {
        try {
            const isValidExpenseRecord = await this.isExpenseRecordAvailable();
            if (!isValidExpenseRecord)
                return "such id not found" /* OperationsFailures.unfoundID */;
            const { id, name, mode, date, amount, category, branchid, description, merchant, employeeid, } = expenseData;
            const queryParams = [
                name,
                amount,
                mode,
                employeeid,
                branchid,
                description,
                merchant,
                category,
                date,
                id,
            ];
            const insertionStatus = await (0, helper_1.promisifyQuery)(this.tenantId, queries_1.updateExpenseQuery, queryParams);
            return (0, helper_1.rowAffected)(insertionStatus);
        }
        catch (error) {
            console.error('Error updating expense record:', error);
            return false;
        }
    }
    async deleteReceiptsList(data) {
        if (!data) {
            throw new Error('data not provided');
        }
        if (!Array.isArray(data)) {
            throw new TypeError('Array required');
        }
        if (data.length === 0)
            return true;
        const status = await Promise.all(data.map(async (item) => {
            try {
                const filepath = path_1.default.join(__dirname, '../../../../', `/public/uploads/expenses/receipts/${item}`);
                await (0, promises_1.unlink)(filepath);
                return true;
            }
            catch (_a) {
                return false;
            }
        }));
        return !status.includes(false);
    }
    async calculateDailyExpense(tenantId, branchid, requireddate) {
        let query = queries_1.calculateDailyExpenseQuery;
        query += branchid && typeof branchid === "number" ? ` AND branchid = ${branchid}` : query;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [requireddate ? requireddate : 'CURRENT_DATE']);
        if (result.length > 0) {
            return result[0]['expense'];
        }
        return null;
    }
    async calCurrentMonthExpense(tenantId, month) {
        if (month && typeof month !== 'number') {
            throw new TypeError('Argument must be empty if current month required or an integer of the month interested provided');
        }
        let query = queries_1.calCurrentMonthExpenseQuery;
        if (month) {
            query += ` MONTH(date) = ? AND approved = 1`;
        }
        else {
            query += ` MONTH(date) = MONTH(CURRENT_DATE) AND approved = 1`;
        }
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [month]);
        if (result.length > 0) {
            return result[0]['expense'];
        }
        return null;
    }
    async calculateYearlyExpense(tenantId, year) {
        let query = queries_1.calculateYearlyExpenseQuery;
        if (year) {
            query += ` YEAR(date) = ? AND approved = 1`;
        }
        else {
            query += ` YEAR(date) = YEAR(CURRENT_DATE) AND approved = 1`;
        }
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [year]);
        if (result.length > 0) {
            return result[0]['expense'];
        }
        return null;
    }
    async getMonthlySummary(tenantId) {
        let report = {};
        let current = 0;
        while (current <= 12) {
            const result = await this.calCurrentMonthExpense(tenantId, current);
            report[current] = result;
            current++;
        }
        return report;
    }
    async updateExpenseDecision(tenantId, status, expenseid, information, employeeid) {
        if (!expenseid || !status || !employeeid) {
            throw new Error('status, employeeid, and expenseid must be provided');
        }
        let statusNumber = undefined;
        let values = [];
        if (status === "pending") {
            statusNumber = 0;
        }
        else if (status === "rejected") {
            statusNumber = 2;
        }
        else if (status === "approved") {
            statusNumber = 1;
        }
        else {
            statusNumber = undefined;
        }
        let query = queries_1.updateExpenseDecisionQuery;
        values.push(statusNumber);
        values.push(employeeid);
        if (statusNumber === 2) {
            query += `, rejectionMessage = ?`;
            values.push(information);
        }
        query += ` WHERE id = ?`;
        values.push(expenseid);
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, query, values));
    }
    async getAllExpenseCategory() {
        return await (0, helper_1.promisifyQuery)(this.tenantId, queries_1.getAllExpenseCategoryQuery);
    }
    async isExpenseExist(tenantId, category) {
        if (!category)
            throw new TypeError('category not needed');
        const row = await (0, helper_1.promisifyQuery)(tenantId, queries_1.isExpenseExistQuery, [category]);
        return row.length > 0;
    }
    async createExpenseCategory(tenantId, category, employeeid) {
        if (!category)
            throw new ReferenceError('category not provided');
        if (typeof category !== 'string')
            throw new TypeError('category must be type string');
        if (isNaN(employeeid)) {
            throw new TypeError(employeeid + " must be type number");
        }
        if (await this.isExpenseExist(tenantId, category)) {
            return `category exist`;
        }
        const isInserted = await (0, helper_1.promisifyQuery)(tenantId, queries_1.createExpenseCategoryQuery, [category, employeeid]);
        return (0, helper_1.rowAffected)(isInserted);
    }
    async updateExpenseCategory(tenantId, editid, category) {
        if (!editid || !category) {
            throw new Error('category and editid not provided');
        }
        return (0, helper_1.rowAffected)(await (0, helper_1.promisifyQuery)(tenantId, queries_1.updateExpenseCategoryQuery, [category, editid]));
    }
    static async getExpensesByCreatedOnRange(tenantId, from, to) {
        if (!from || !to)
            throw new Error('Both from and to timestamps are required');
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.expense_between_dates_query, [from, to]);
    }
}
exports.default = Expenses;
