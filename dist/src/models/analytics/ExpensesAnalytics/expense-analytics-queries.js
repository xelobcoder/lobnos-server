"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../../database/KnexConnections"));
class ExpenseAnalyticsQueries {
    constructor(tenantId) {
        this.tenantId = tenantId;
        this.connection = (0, KnexConnections_1.default)(this.tenantId);
    }
    async getDailyExpenseAnalytics(branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .select(connection.raw('DATE(er.date) AS expense_date'), connection.raw('COUNT(*) AS total_expenses'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), connection.raw('COUNT(DISTINCT er.category) AS unique_categories'), connection.raw('COUNT(DISTINCT er.employeeid) AS unique_employees'), connection.raw("GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames"), connection.raw("GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles"), 'b.name as branch_name')
            .whereRaw('DATE(er.date) BETWEEN ? AND ?', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('DATE(er.date), b.name')
            .orderBy('expense_date', 'desc');
    }
    async getExpenseComparisonByPeriod(branchId, currentStartDate, currentEndDate, previousStartDate, previousEndDate) {
        const connection = await this.connection;
        const currentPeriodQuery = connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .select(connection.raw("'current_period' AS period_type"), connection.raw('COUNT(*) AS expense_count'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), 'b.name as branch_name')
            .whereBetween('er.date', [currentStartDate, currentEndDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupBy('b.name');
        const previousPeriodQuery = connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .select(connection.raw("'previous_period' AS period_type"), connection.raw('COUNT(*) AS expense_count'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), 'b.name as branch_name')
            .whereBetween('er.date', [previousStartDate, previousEndDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupBy('b.name');
        const [currentResults, previousResults] = await Promise.all([
            currentPeriodQuery,
            previousPeriodQuery
        ]);
        return [...currentResults, ...previousResults];
    }
    async getExpenseTrendsByCategory(categoryId, branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('dboexpensecategory as ec', 'er.category', 'ec.id')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .select(connection.raw("DATE_FORMAT(er.date, '%Y-%m') AS month_year"), connection.raw('YEAR(er.date) AS year'), connection.raw('MONTH(er.date) AS month'), connection.raw('COUNT(*) AS expense_count'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), 'ec.category as category_name', 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (categoryId !== null) {
                this.where('er.category', categoryId);
            }
        })
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('YEAR(er.date), MONTH(er.date), ec.category, b.name')
            .orderBy('year', 'desc')
            .orderBy('month', 'desc');
    }
    async getHourlyExpenseAnalytics(branchId, targetDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .select(connection.raw('DATE(er.date) AS expense_date'), connection.raw('HOUR(er.date) AS expense_hour'), connection.raw("CONCAT(LPAD(HOUR(er.date), 2, '0'), ':00-', LPAD(HOUR(er.date)+1, 2, '0'), ':00') AS hour_range"), connection.raw('COUNT(*) AS total_expenses'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), connection.raw('COUNT(DISTINCT er.category) AS unique_categories'), connection.raw('COUNT(DISTINCT er.employeeid) AS unique_employees'), connection.raw("GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames"), connection.raw("GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles"), 'b.name as branch_name')
            .whereRaw('DATE(er.date) = ?', [targetDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('DATE(er.date), HOUR(er.date), b.name')
            .orderBy('expense_hour', 'asc');
    }
    async getMonthlyExpenseAnalytics(branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .select(connection.raw('YEAR(er.date) AS year'), connection.raw('MONTH(er.date) AS month'), connection.raw("DATE_FORMAT(er.date, '%M %Y') AS month_year"), connection.raw('COUNT(*) AS total_expenses'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), connection.raw('COUNT(DISTINCT er.category) AS unique_categories'), connection.raw('COUNT(DISTINCT er.employeeid) AS unique_employees'), connection.raw('COUNT(DISTINCT er.merchant) AS unique_merchants'), connection.raw("GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames"), connection.raw("GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles"), 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('YEAR(er.date), MONTH(er.date), b.name')
            .orderBy('year', 'desc')
            .orderBy('month', 'desc');
    }
    async getQuarterlyExpenseAnalytics(branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .select(connection.raw('YEAR(er.date) AS year'), connection.raw('QUARTER(er.date) AS quarter'), connection.raw("CONCAT('Q', QUARTER(er.date), ' ', YEAR(er.date)) AS quarter_year"), connection.raw('COUNT(*) AS total_expenses'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), connection.raw('COUNT(DISTINCT er.category) AS unique_categories'), connection.raw('COUNT(DISTINCT er.employeeid) AS unique_employees'), connection.raw("GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames"), connection.raw("GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles"), 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('YEAR(er.date), QUARTER(er.date), b.name')
            .orderBy('year', 'desc')
            .orderBy('quarter', 'desc');
    }
    async getTopExpenseCategories(branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('dboexpensecategory as ec', 'er.category', 'ec.id')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .select('ec.category as category_name', connection.raw('COUNT(*) AS expense_count'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupBy('ec.category', 'b.name')
            .orderBy('total_amount', 'desc');
    }
    async getTopExpenseEmployees(branchId, startDate, endDate, limitCount) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .select('r.username as employee_name', 'er.employeeid', connection.raw('COUNT(*) AS expense_count'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupBy('er.employeeid', 'r.username', 'b.name')
            .orderBy('total_amount', 'desc')
            .limit(limitCount);
    }
    async getTopExpenseMerchants(branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('expense_merchants as em', 'em.id', 'er.merchant')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .select('em.name as merchant_name', connection.raw('COUNT(*) AS expense_count'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .whereNotNull('er.merchant')
            .where('er.merchant', '!=', '')
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupBy('em.name', 'b.name')
            .orderBy('total_amount', 'desc');
    }
    async getWeeklyExpenseAnalytics(branchId, startDate, endDate) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .select(connection.raw('YEAR(er.date) AS year'), connection.raw('WEEK(er.date) AS week_number'), connection.raw("DATE_FORMAT(MIN(er.date), '%Y-%m-%d') AS week_start"), connection.raw("DATE_FORMAT(MAX(er.date), '%Y-%m-%d') AS week_end"), connection.raw('COUNT(*) AS total_expenses'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('COUNT(DISTINCT er.category) AS unique_categories'), connection.raw('COUNT(DISTINCT er.employeeid) AS unique_employees'), connection.raw("GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames"), connection.raw("GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles"), 'b.name as branch_name')
            .whereBetween('er.date', [startDate, endDate])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('YEAR(er.date), WEEK(er.date), b.name')
            .orderBy('year', 'desc')
            .orderBy('week_number', 'desc');
    }
    async getYearlyExpenseAnalytics(branchId, startYear, endYear) {
        const connection = await this.connection;
        return connection('expensesrecord as er')
            .leftJoin('branch as b', 'er.branchid', 'b.branchid')
            .leftJoin('roles as r', 'er.employeeid', 'r.employeeid')
            .select(connection.raw('YEAR(er.date) AS year'), connection.raw('COUNT(*) AS total_expenses'), connection.raw('SUM(er.amount) AS total_amount'), connection.raw('AVG(er.amount) AS average_amount'), connection.raw('MIN(er.amount) AS min_amount'), connection.raw('MAX(er.amount) AS max_amount'), connection.raw('COUNT(DISTINCT er.category) AS unique_categories'), connection.raw('COUNT(DISTINCT er.employeeid) AS unique_employees'), connection.raw('COUNT(DISTINCT er.merchant) AS unique_merchants'), connection.raw('COUNT(DISTINCT MONTH(er.date)) AS active_months'), connection.raw("GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames"), connection.raw("GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles"), 'b.name as branch_name')
            .whereRaw('YEAR(er.date) BETWEEN ? AND ?', [startYear, endYear])
            .andWhere('er.approved', 1)
            .andWhere(function () {
            if (branchId !== null) {
                this.where('er.branchid', branchId);
            }
        })
            .groupByRaw('YEAR(er.date), b.name')
            .orderBy('year', 'desc');
    }
}
exports.default = ExpenseAnalyticsQueries;
