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
const tenantConnections_1 = require("../../models/Tenancy/tenantConnections");
const connection_1 = require("../../database/connection");
const configuration_1 = require("../../hooks/configuration");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class Expenses {
    constructor(employeeid, branchid, tenantId, expenseId = null, trx = null) {
        this.employeeid = employeeid;
        this.branchid = branchid;
        this.tenantId = tenantId;
        this.expenseId = expenseId;
        this.trx = trx;
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
    async generateNewExpense(data, groupId, trx) {
        try {
            if (Object.keys(data).length === 0 || typeof data !== 'object') {
                throw new TypeError('object with keys required');
            }
            const { employeeid, branchid, name, date, merchant, amount, description, category, serviceid, isassociatedservice } = data;
            if (!employeeid || !branchid || !name) {
                throw new Error('name, employeeid, branchid required');
            }
            if (category === 0 || !category) {
                throw new Error('category id not provided');
            }
            const finalGroupId = groupId || this.generateGroupId();
            let insertData = {
                name,
                amount,
                employeeid,
                branchid,
                description,
                merchant,
                category,
                serviceid,
                isassociatedservice: isassociatedservice || 0,
                date,
                groupId: finalGroupId
            };
            let result;
            if (trx) {
                result = await trx('expensesrecord').insert(insertData);
            }
            else {
                const connection = await (0, KnexConnections_1.default)(this.tenantId);
                result = await connection('expensesrecord').insert(insertData);
            }
            if (result && result.length > 0) {
                return result[0];
            }
            return null;
        }
        catch (err) {
            logger_1.default.error(err === null || err === void 0 ? void 0 : err.message);
            throw new Error(err);
        }
    }
    async generateBulkExpenses(expensesData, groupId) {
        const results = {
            success: [],
            failed: [],
            groupId: groupId || this.generateGroupId()
        };
        const pool = configuration_1.configuration.isMultiTenant
            ? await (0, tenantConnections_1.primeTenancyConnector)(this.tenantId)
            : connection_1.databaseConnectionPool;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (const expenseData of expensesData) {
                try {
                    const { employeeid, branchid, name, date, merchant, amount, description, category } = expenseData;
                    if (!employeeid || !branchid || !name) {
                        throw new Error('name, employeeid, branchid required');
                    }
                    if (category === 0 || !category) {
                        throw new Error('category id not provided');
                    }
                    const [result] = await connection.query(queries_1.generateNewExpenseQuery, [name, amount, employeeid, branchid, description, merchant, category, date, results.groupId]);
                    if (result.insertId) {
                        results.success.push(result.insertId);
                    }
                    else {
                        throw new Error('Failed to create expense - no ID returned');
                    }
                }
                catch (err) {
                    results.failed.push({
                        data: expenseData,
                        error: err.message || 'Unknown error'
                    });
                    await connection.rollback();
                    return results;
                }
            }
            await connection.commit();
            return results;
        }
        catch (err) {
            await connection.rollback();
            logger_1.default.error('Transaction error in bulk expenses:', err);
            throw new Error('Transaction failed: ' + err.message);
        }
        finally {
            connection.release();
        }
    }
    async getExpensesRecord(tenantId, employeeid, branchid, status, pageQuery = { count: 10, page: 1 }, from, to, state) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(employeeid, tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        let query = queries_1.getExpensesRecordQuery;
        let values = [];
        let hasWhereClause = false;
        const role = record[0]['role'];
        const isAdmin = (role === 'admin' || role === 'manager');
        if (!isAdmin) {
            query += ` WHERE er.employeeid = ?`;
            values = [employeeid];
            hasWhereClause = true;
        }
        const addCondition = (condition, params = []) => {
            query += ` ${hasWhereClause ? 'AND' : 'WHERE'} ${condition}`;
            values.push(...params);
            hasWhereClause = true;
        };
        if (status === 'approved') {
            addCondition('er.approved = 1');
        }
        else if (status === 'rejected') {
            addCondition('er.approved = 2');
        }
        else if (status === 'pending') {
            addCondition('er.approved = 0');
        }
        if (from && to) {
            addCondition('er.date BETWEEN ? AND ?', [from, to]);
        }
        if (state) {
            addCondition('er.state = ?', [state]);
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
    async hasApprovedPayments() {
        const checkQuery = `
               SELECT COUNT(ep.id) as payment_count
               FROM expense_payments ep
               WHERE ep.expense_id = ?
          `;
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, checkQuery, [this.expenseId]);
        return result && result.length > 0 && result[0].payment_count > 0;
    }
    async updateExpenseRecord(expenseData) {
        try {
            const isValidExpenseRecord = await this.isExpenseRecordAvailable();
            if (!isValidExpenseRecord)
                return "such id not found" /* OperationsFailures.unfoundID */;
            const approvalQuery = `SELECT approved FROM expensesrecord WHERE id = ?`;
            const approvalResult = await (0, helper_1.promisifyQuery)(this.tenantId, approvalQuery, [this.expenseId]);
            if (approvalResult && approvalResult.length > 0 && approvalResult[0].approved) {
                const hasPayments = await this.hasApprovedPayments();
                if (hasPayments) {
                    return "Cannot edit approved expense that has payments already made. Please reverse the payment first.";
                }
            }
            const { id, name, amount, category, branchid, description, merchant, employeeid, date, } = expenseData;
            const queryParams = [
                name,
                amount,
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
    async updateExpenseDecision(tenantId, status, decisions, tTransaction) {
        if (!decisions || decisions.length === 0 || !status) {
            throw new Error('status and decisions must be provided');
        }
        const connection = tTransaction ? tTransaction : await (0, KnexConnections_1.default)(tenantId);
        const conn = tTransaction ? tTransaction : await connection.transaction();
        const shouldManageTransaction = !tTransaction;
        try {
            for (const decision of decisions) {
                const { expenseid, information, employeeid } = decision;
                let statusNumber = undefined;
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
                if (statusNumber === undefined) {
                    throw new Error('Invalid status provided');
                }
                let query = queries_1.updateExpenseDecisionQuery;
                let values = [];
                values.push(statusNumber);
                values.push(employeeid);
                if (statusNumber === 2) {
                    query += `, rejectionMessage = ?`;
                    values.push(information);
                }
                query += ` WHERE id = ?`;
                values.push(expenseid);
                const [result] = await conn.raw(query, values);
                if (result.affectedRows === 0) {
                    throw new Error(`Failed to update expense ${expenseid}`);
                }
            }
            if (shouldManageTransaction) {
                await conn.commit();
            }
            return true;
        }
        catch (err) {
            if (shouldManageTransaction) {
                await conn.rollback();
            }
            logger_1.default.error('Transaction error in bulk expense decisions:', err);
            throw new Error('Transaction failed: ' + err.message);
        }
        finally {
            if (shouldManageTransaction) {
                conn.destroy();
            }
        }
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
    async createExpenseCategory(tenantId, category, employeeid, trx) {
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
        let result;
        if (trx) {
            result = await trx('dboexpensecategory').insert({
                category,
                employeeid,
                createdon: new Date()
            });
        }
        else {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            result = await connection('dboexpensecategory').insert({
                category,
                employeeid,
                createdon: new Date()
            });
        }
        return result && result.length > 0;
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
    async getExpensesByGroup(tenantId, groupId) {
        try {
            const query = `
                    SELECT * FROM expensesrecord
                    WHERE groupId = ?
                    ORDER BY date DESC
               `;
            const expenses = await (0, helper_1.promisifyQuery)(tenantId, query, [groupId]);
            return expenses;
        }
        catch (err) {
            logger_1.default.error(err === null || err === void 0 ? void 0 : err.message);
            throw new Error(err);
        }
    }
    generateGroupId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const employeePart = this.employeeid.toString().padStart(4, '0');
        return `EXP-${timestamp}-${employeePart}-${random}`.toUpperCase();
    }
}
exports.default = Expenses;
