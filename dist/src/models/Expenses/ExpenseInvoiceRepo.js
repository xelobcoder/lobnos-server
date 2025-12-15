"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../hooks/helper");
const user_1 = __importDefault(require("../../LobnosAuth/user"));
const ExpenseService_1 = __importDefault(require("./ExpenseService"));
class ExpenseInvoiceRepo {
    constructor(employeeid, branchid, tenantId) {
        this.employeeid = employeeid;
        this.branchid = branchid;
        this.tenantId = tenantId;
    }
    async calculateTotalFromExpenses(expenseIds) {
        var _a;
        if (!expenseIds || expenseIds.length === 0) {
            return 0;
        }
        const placeholders = expenseIds.map(() => '?').join(',');
        const query = `SELECT SUM(amount) as total FROM expensesrecord WHERE id IN (${placeholders}) AND approved = 1`;
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, query, expenseIds);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    }
    async getMerchantFromExpenses(expenseIds) {
        if (!expenseIds || expenseIds.length === 0) {
            return null;
        }
        const placeholders = expenseIds.map(() => '?').join(',');
        const query = `SELECT DISTINCT merchant FROM expensesrecord WHERE id IN (${placeholders}) AND approved = 1`;
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, query, expenseIds);
        if (result.length === 0) {
            return null;
        }
        if (result.length === 1) {
            return result[0].merchant;
        }
        const merchantCounts = {};
        result.forEach((row) => {
            const merchant = row.merchant;
            merchantCounts[merchant] = (merchantCounts[merchant] || 0) + 1;
        });
        const mostCommonMerchant = Object.keys(merchantCounts).reduce((a, b) => merchantCounts[parseInt(a)] > merchantCounts[parseInt(b)] ? a : b);
        return parseInt(mostCommonMerchant);
    }
    async createInvoice(invoiceData) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        const { invoice_date, expense_ids } = invoiceData;
        if (!invoice_date || !expense_ids || expense_ids.length === 0) {
            throw new Error('Required fields are missing');
        }
        let merchant_id = invoiceData.merchant_id;
        if (!merchant_id) {
            merchant_id = await this.getMerchantFromExpenses(expense_ids);
            if (!merchant_id) {
                throw new Error('Could not determine merchant from approved expenses');
            }
        }
        let total_amount = invoiceData.total_amount;
        if (!total_amount || total_amount === 0) {
            total_amount = await this.calculateTotalFromExpenses(expense_ids);
        }
        let invoice_number = invoiceData.invoice_number;
        if (!invoice_number) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            invoice_number = `INV-${timestamp}-${random}`;
        }
        else {
            const checkQuery = 'SELECT id FROM invoices WHERE invoice_number = ?';
            const existing = await (0, helper_1.promisifyQuery)(this.tenantId, checkQuery, [invoice_number]);
            if (existing.length > 0) {
                throw new Error('Invoice number must be unique');
            }
        }
        const merchantQuery = 'SELECT id FROM expense_merchants WHERE id = ?';
        const merchant = await (0, helper_1.promisifyQuery)(this.tenantId, merchantQuery, [merchant_id]);
        if (merchant.length === 0) {
            throw new Error('Merchant not found');
        }
        for (const expenseId of expense_ids) {
            const expenseQuery = 'SELECT id, employeeid, approved FROM expensesrecord WHERE id = ?';
            const expense = await (0, helper_1.promisifyQuery)(this.tenantId, expenseQuery, [expenseId]);
            if (expense.length === 0) {
                throw new Error(`Expense with ID ${expenseId} not found`);
            }
            if (!isAdminOrManager && expense[0].employeeid !== this.employeeid) {
                throw new Error(`Unauthorized to include expense ${expenseId}`);
            }
            if (expense[0].approved !== 1) {
                throw new Error(`Expense ${expenseId} must be approved before it can be invoiced`);
            }
        }
        const insertQuery = `
            INSERT INTO invoices (invoice_number, invoice_date, due_date, merchant_id, employee_id, branch_id, total_amount, tax_amount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            invoice_number,
            invoice_date,
            invoiceData.due_date || null,
            merchant_id,
            this.employeeid,
            this.branchid,
            total_amount,
            invoiceData.tax_amount || 0.00,
            invoiceData.status || 'Pending'
        ];
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, insertQuery, values);
        const invoiceId = result.insertId;
        for (const expenseId of expense_ids) {
            const linkQuery = 'INSERT INTO invoice_expenses (invoice_id, expense_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE invoice_id = invoice_id';
            await (0, helper_1.promisifyQuery)(this.tenantId, linkQuery, [invoiceId, expenseId]);
        }
        return { invoiceId, invoice_number };
    }
    async getInvoices(filters = {}) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        let query = `
            SELECT i.*,er.id AS expense_id, em.name as merchant_name, COUNT(ie.expense_id) as expense_count, MIN(er.groupId) as groupId
            FROM invoices i
            LEFT JOIN expense_merchants em ON i.merchant_id = em.id
            LEFT JOIN invoice_expenses ie ON i.id = ie.invoice_id
            LEFT JOIN expensesrecord er ON ie.expense_id = er.id
        `;
        let values = [];
        let hasWhere = false;
        const addCondition = (condition, params = []) => {
            query += ` ${hasWhere ? 'AND' : 'WHERE'} ${condition}`;
            values.push(...params);
            hasWhere = true;
        };
        if (!isAdminOrManager) {
            addCondition('i.employee_id = ?', [this.employeeid]);
        }
        if (filters.status) {
            addCondition('i.status = ?', [filters.status]);
        }
        if (filters.from && filters.to) {
            addCondition('i.invoice_date BETWEEN ? AND ?', [filters.from, filters.to]);
        }
        if (filters.search) {
            addCondition('(i.invoice_number LIKE ? OR em.name LIKE ?)', [`%${filters.search}%`, `%${filters.search}%`]);
        }
        query += ' GROUP BY i.id ORDER BY i.created_on DESC';
        const pageQuery = { count: filters.count || 10, page: filters.page || 1 };
        return await (0, helper_1.paginationQuery)(pageQuery, query, values, this.tenantId);
    }
    async getInvoiceById(invoiceId) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        const query = `
            SELECT i.*, em.name as merchant_name
            FROM invoices i
            LEFT JOIN expense_merchants em ON i.merchant_id = em.id
            WHERE i.id = ?
        `;
        const invoice = await (0, helper_1.promisifyQuery)(this.tenantId, query, [invoiceId]);
        if (invoice.length === 0) {
            throw new Error('Invoice not found');
        }
        if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
            throw new Error('Unauthorized');
        }
        const expensesQuery = `
            SELECT er.*, ie.invoice_id
            FROM expensesrecord er
            JOIN invoice_expenses ie ON er.id = ie.expense_id
            WHERE ie.invoice_id = ?
        `;
        const expenses = await (0, helper_1.promisifyQuery)(this.tenantId, expensesQuery, [invoiceId]);
        return Object.assign(Object.assign({}, invoice[0]), { expenses });
    }
    async updateInvoiceStatus(invoiceId, status) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        const invoiceQuery = 'SELECT employee_id FROM invoices WHERE id = ?';
        const invoice = await (0, helper_1.promisifyQuery)(this.tenantId, invoiceQuery, [invoiceId]);
        if (invoice.length === 0) {
            throw new Error('Invoice not found');
        }
        if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
            throw new Error('Unauthorized');
        }
        const updateQuery = 'UPDATE invoices SET status = ?, updated_on = NOW() WHERE id = ?';
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, updateQuery, [status, invoiceId]);
        return (0, helper_1.rowAffected)(result);
    }
    async updateInvoiceStatusIfFullyPaid(invoiceId) {
        var _a;
        const invoiceQuery = 'SELECT total_amount FROM invoices WHERE id = ?';
        const invoice = await (0, helper_1.promisifyQuery)(this.tenantId, invoiceQuery, [invoiceId]);
        if (invoice.length === 0) {
            return; // Invoice not found, nothing to do
        }
        const invoiceTotal = parseFloat(invoice[0].total_amount);
        const paymentsQuery = `
               SELECT SUM(amount) as total_paid
               FROM expense_payments
               WHERE invoice_id = ? AND status = 'Paid'
          `;
        const payments = await (0, helper_1.promisifyQuery)(this.tenantId, paymentsQuery, [invoiceId]);
        const totalPaid = parseFloat(((_a = payments[0]) === null || _a === void 0 ? void 0 : _a.total_paid) || 0);
        if (totalPaid >= invoiceTotal) {
            const updateQuery = 'UPDATE invoices SET status = ?, updated_on = NOW() WHERE id = ?';
            await (0, helper_1.promisifyQuery)(this.tenantId, updateQuery, ['Paid', invoiceId]);
        }
    }
    async addPayment(paymentData) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        const { expense_id, payment_date, amount, method } = paymentData;
        if (!expense_id || !payment_date || !amount || !method) {
            throw new Error('Required fields are missing');
        }
        const expenseQuery = 'SELECT id, employeeid, approved FROM expensesrecord WHERE id = ?';
        const expense = await (0, helper_1.promisifyQuery)(this.tenantId, expenseQuery, [expense_id]);
        if (expense.length === 0) {
            throw new Error(`Expense with ID ${expense_id} not found in the system`);
        }
        if (expense[0].approved !== 1) {
            throw new Error(`Cannot add payment for expense ${expense_id} - expense must be approved first`);
        }
        if (!isAdminOrManager && expense[0].employeeid !== this.employeeid) {
            throw new Error('Unauthorized');
        }
        if (paymentData.invoice_id) {
            const invoiceQuery = 'SELECT id, employee_id FROM invoices WHERE id = ?';
            const invoice = await (0, helper_1.promisifyQuery)(this.tenantId, invoiceQuery, [paymentData.invoice_id]);
            if (invoice.length === 0) {
                throw new Error('Invoice not found');
            }
            if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
                throw new Error('Unauthorized');
            }
        }
        const existingPaymentQuery = `
               SELECT id FROM expense_payments
               WHERE expense_id = ? AND invoice_id = ? AND status = 'Paid'
          `;
        const existingPayment = await (0, helper_1.promisifyQuery)(this.tenantId, existingPaymentQuery, [expense_id, paymentData.invoice_id || null]);
        if (existingPayment.length > 0) {
            throw new Error(`Payment already exists for expense ${expense_id}${paymentData.invoice_id ? ` and invoice ${paymentData.invoice_id}` : ''}. Duplicate payments are not allowed.`);
        }
        const insertQuery = `
            INSERT INTO expense_payments (expense_id, invoice_id, payment_date, amount, method, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const values = [
            expense_id,
            paymentData.invoice_id || null,
            payment_date,
            amount,
            method,
            paymentData.status || 'Paid',
            this.employeeid
        ];
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, insertQuery, values);
        const paymentId = result.insertId;
        if (paymentData.invoice_id) {
            await this.updateInvoiceStatusIfFullyPaid(paymentData.invoice_id);
        }
        return { paymentId };
    }
    async getPayments(filters = {}) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        let query = 'SELECT * FROM expense_payments';
        let values = [];
        let hasWhere = false;
        const addCondition = (condition, params = []) => {
            query += ` ${hasWhere ? 'AND' : 'WHERE'} ${condition}`;
            values.push(...params);
            hasWhere = true;
        };
        if (!isAdminOrManager) {
            const subQuery = `
                SELECT id FROM expensesrecord WHERE employeeid = ?
                UNION
                SELECT ie.expense_id FROM invoice_expenses ie
                JOIN invoices i ON ie.invoice_id = i.id
                WHERE i.employee_id = ?
            `;
            addCondition(`expense_id IN (${subQuery})`, [this.employeeid, this.employeeid]);
        }
        if (filters.expense_id) {
            addCondition('expense_id = ?', [filters.expense_id]);
        }
        if (filters.invoice_id) {
            console.log('Filtering by invoice_id:', filters.invoice_id);
            addCondition('invoice_id = ?', [filters.invoice_id]);
        }
        if (filters.status) {
            addCondition('status = ?', [filters.status]);
        }
        query += ' ORDER BY created_on DESC';
        const pageQuery = { count: filters.count || 10, page: filters.page || 1 };
        return await (0, helper_1.paginationQuery)(pageQuery, query, values, this.tenantId);
    }
    async createExpensesAndInvoice(expensesData, invoiceData) {
        const expenseService = new ExpenseService_1.default(this.employeeid, this.branchid, this.tenantId);
        const groupId = expenseService['generateGroupId']();
        const expenseIds = [];
        for (const expense of expensesData) {
            const expenseId = await expenseService.generateNewExpense(expense, groupId);
            if (expenseId) {
                expenseIds.push(expenseId);
            }
            else {
                throw new Error('Failed to create expense');
            }
        }
        return {
            message: 'Expenses created successfully. Invoice can be created after expenses are approved.',
            expenseIds,
            groupId,
            requiresApproval: true
        };
    }
    async addExpensesToInvoice(invoiceId, newExpenseIds) {
        const record = await new user_1.default(null, null, null, null, null).userExistWithId(this.employeeid, this.tenantId);
        if (!record || record.length === 0) {
            throw new Error('User not found');
        }
        const role = record[0]['role'];
        const isAdminOrManager = role === 'admin' || role === 'manager';
        const invoiceQuery = 'SELECT id, employee_id, merchant_id FROM invoices WHERE id = ?';
        const invoice = await (0, helper_1.promisifyQuery)(this.tenantId, invoiceQuery, [invoiceId]);
        if (invoice.length === 0) {
            throw new Error('Invoice not found');
        }
        if (!isAdminOrManager && invoice[0].employee_id !== this.employeeid) {
            throw new Error('Unauthorized');
        }
        for (const expenseId of newExpenseIds) {
            const expenseQuery = 'SELECT id, employeeid, approved FROM expensesrecord WHERE id = ?';
            const expense = await (0, helper_1.promisifyQuery)(this.tenantId, expenseQuery, [expenseId]);
            if (expense.length === 0) {
                throw new Error(`Expense with ID ${expenseId} not found`);
            }
            if (!isAdminOrManager && expense[0].employeeid !== this.employeeid) {
                throw new Error(`Unauthorized to include expense ${expenseId}`);
            }
            if (expense[0].approved !== 1) {
                throw new Error(`Expense ${expenseId} must be approved before it can be added to an invoice`);
            }
            const existingLinkQuery = 'SELECT invoice_id FROM invoice_expenses WHERE expense_id = ?';
            const existingLink = await (0, helper_1.promisifyQuery)(this.tenantId, existingLinkQuery, [expenseId]);
            if (existingLink.length > 0) {
                throw new Error(`Expense ${expenseId} is already linked to an invoice`);
            }
        }
        for (const expenseId of newExpenseIds) {
            const linkQuery = 'INSERT INTO invoice_expenses (invoice_id, expense_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE invoice_id = invoice_id';
            await (0, helper_1.promisifyQuery)(this.tenantId, linkQuery, [invoiceId, expenseId]);
        }
        const allExpenseIdsQuery = 'SELECT expense_id FROM invoice_expenses WHERE invoice_id = ?';
        const allExpenseLinks = await (0, helper_1.promisifyQuery)(this.tenantId, allExpenseIdsQuery, [invoiceId]);
        const allExpenseIds = allExpenseLinks.map(link => link.expense_id);
        const newTotalAmount = await this.calculateTotalFromExpenses(allExpenseIds);
        const updateQuery = 'UPDATE invoices SET total_amount = ?, updated_on = NOW() WHERE id = ?';
        await (0, helper_1.promisifyQuery)(this.tenantId, updateQuery, [newTotalAmount, invoiceId]);
        return { invoiceId, totalAmount: newTotalAmount, addedExpenses: newExpenseIds };
    }
    async calculateTotalAmount(expenseIds) {
        var _a;
        if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
            throw new Error('Invalid expense IDs');
        }
        const query = `
            SELECT SUM(total_amount) as total_amount
            FROM expensesrecord
            WHERE id IN (?)
        `;
        const result = await (0, helper_1.promisifyQuery)(this.tenantId, query, [expenseIds]);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total_amount) || 0;
    }
    async getPaymentsBetweenDates(tenantId, from, to) {
        const query = `
               SELECT 
               expense_payments.*,
               expensesrecord.*,
               expense_merchants.*,
               roles.username AS paid_by
               FROM expense_payments
               LEFT JOIN expensesrecord ON expense_payments.expense_id = expensesrecord.id
               LEFT JOIN expense_merchants ON expensesrecord.merchant = expense_merchants.id
               LEFT JOIN roles ON expense_payments.created_by = roles.employeeid

               WHERE payment_date BETWEEN ? AND ?
          `;
        return (0, helper_1.promisifyQuery)(tenantId, query, [from, to]);
    }
    async getSumOfPayments(tenantId, start, end) {
        var _a;
        const query = `
               SELECT SUM(amount) as total_payments FROM expense_payments
               WHERE payment_date BETWEEN ? AND ?
          `;
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [start, end]);
        return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.total_payments) || 0;
    }
}
exports.default = ExpenseInvoiceRepo;
