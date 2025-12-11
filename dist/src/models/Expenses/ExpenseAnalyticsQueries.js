"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseAnalyticsQueries = void 0;
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class ExpenseAnalyticsQueries {
    constructor(tenantId) {
        this.tenantId = tenantId;
    }
    async getDailyExpenseAnalytics(startDate, endDate) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        DATE(er.date) AS expense_date,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees,
        COUNT(DISTINCT er.merchant) AS unique_merchants
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(er.date) BETWEEN ? AND ?
      GROUP BY DATE(er.date)
      ORDER BY expense_date DESC
    `, [startDate, endDate]);
    }
    async getExpenseComparisonByPeriod(currentStart, currentEnd, previousStart, previousEnd, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        'current' AS period,
       COALESCE(SUM(er.amount), 0) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        COALESCE(AVG(er.amount), 0) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(er.date) BETWEEN ? AND ?
        ${branchid ? 'AND er.branchid = ?' : ''}

      UNION ALL

      SELECT
        'previous' AS period,
        COALESCE(SUM(er.amount), 0) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        COALESCE(AVG(er.amount), 0) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(er.date) BETWEEN ? AND ?
        ${branchid ? 'AND er.branchid = ?' : ''}
    `, branchid ? [currentStart, currentEnd, branchid, previousStart, previousEnd, branchid] : [currentStart, currentEnd, previousStart, previousEnd]);
    }
    async getExpenseTrendsByCategory(startDate, endDate) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        er.category,
        SUM(er.amount) AS total_amount,
        COUNT(*) AS expense_count
      FROM expensesrecord er
      WHERE er.approved = 1
        AND er.date >= ?
        AND er.date <= ?
      GROUP BY er.category
      ORDER BY total_amount DESC
    `, [startDate, endDate]);
    }
    async getExpenseTrendsByEmployee(startDate, endDate, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        r.username AS employee_name,
        SUM(er.amount) AS total_amount,
        COUNT(*) AS expense_count
      FROM expensesrecord er
      LEFT JOIN roles r ON er.employeeid = r.employeeid
      WHERE er.approved = 1
        AND er.date >= ?
        AND er.date <= ?
        ${branchid ? 'AND er.branchid = ?' : ''}
      GROUP BY r.username
      ORDER BY total_amount DESC
    `, branchid ? [startDate, endDate, branchid] : [startDate, endDate]);
    }
    async getExpenseTrendsByMerchant(startDate, endDate) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        em.name AS merchant_name,
        DATE(er.date) AS expense_date,
        SUM(er.amount) AS total_amount,
        COUNT(DISTINCT er.id) AS expense_count
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      LEFT JOIN expense_merchants em ON er.merchant = em.id
      WHERE ep.status = 'Paid'
        AND DATE(er.date) BETWEEN ? AND ?
      GROUP BY em.name, DATE(er.date)
      ORDER BY expense_date DESC, total_amount DESC
    `, [startDate, endDate]);
    }
    async getHourlyExpenseAnalytics(date) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        HOUR(er.date) AS expense_hour,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(er.date) = ?
      GROUP BY HOUR(er.date)
      ORDER BY expense_hour ASC
    `, [date]);
    }
    async getMonthlyExpenseAnalytics(year) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        MONTH(er.date) AS expense_month,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(er.date) = ?
      GROUP BY MONTH(er.date)
      ORDER BY expense_month ASC
    `, [year]);
    }
    async getWeeklyExpenseAnalytics(year) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        WEEK(er.date) AS expense_week,
        YEAR(er.date) AS expense_year,
        MIN(DATE(er.date)) AS week_start_date,
        MAX(DATE(er.date)) AS week_end_date,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(er.date) = ?
      GROUP BY YEAR(er.date), WEEK(er.date)
      ORDER BY expense_year ASC, expense_week ASC
    `, [year]);
    }
    async getQuarterlyExpenseAnalytics(year) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        QUARTER(er.date) AS expense_quarter,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(er.date) = ?
      GROUP BY QUARTER(er.date)
      ORDER BY expense_quarter ASC
    `, [year]);
    }
    async getYearlyExpenseAnalytics(startYear, endYear) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        YEAR(er.date) AS expense_year,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees,
        COUNT(DISTINCT er.merchant) AS unique_merchants
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(er.date) BETWEEN ? AND ?
      GROUP BY YEAR(er.date)
      ORDER BY expense_year ASC
    `, [startYear, endYear]);
    }
    async getExpenseAnalyticsByBranch(startDate, endDate) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        b.name AS branch_name,
        SUM(er.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      LEFT JOIN branch b ON er.branchid = b.branchid
      WHERE ep.status = 'Paid'
        AND DATE(er.date) BETWEEN ? AND ?
      GROUP BY b.name
      ORDER BY total_expenses DESC
    `, [startDate, endDate]);
    }
    async getTopExpenseCategories(startDate, endDate, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        ec.category AS category_name,
        SUM(er.amount) AS total_amount,
        COUNT(*) AS expense_count,
        AVG(er.amount) AS avg_amount
      FROM expensesrecord er
      LEFT JOIN dboexpensecategory ec ON er.category = ec.id
      WHERE er.approved = 1
        AND er.date >= ?
        AND er.date <= ?
        ${branchid ? 'AND er.branchid = ?' : ''}
      GROUP BY ec.category
      ORDER BY total_amount DESC
    `, branchid ? [startDate, endDate, branchid] : [startDate, endDate]);
    }
    async getExpensePaymentStatusAnalytics(startDate, endDate) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        COALESCE(ep.status, 'Unpaid') AS payment_status,
        SUM(er.amount) AS total_amount,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(er.amount) AS avg_amount
      FROM expensesrecord er
      LEFT JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE er.approved = 1
        AND DATE(er.date) BETWEEN ? AND ?
      GROUP BY COALESCE(ep.status, 'Unpaid')
      ORDER BY total_amount DESC
    `, [startDate, endDate]);
    }
    async getExpenseBuckets(startDate, endDate, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        CASE
          WHEN er.amount < 100 THEN 'Small'
          WHEN er.amount >= 100 AND er.amount < 1000 THEN 'Medium'
          WHEN er.amount >= 1000 AND er.amount < 10000 THEN 'Large'
          ELSE 'Extra Large'
        END AS bucket,
        COUNT(*) AS expense_count,
        SUM(er.amount) AS total_amount,
        AVG(er.amount) AS avg_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(er.date) BETWEEN ? AND ?
        ${branchid ? 'AND er.branchid = ?' : ''}
      GROUP BY bucket
      ORDER BY total_amount DESC
    `, branchid ? [startDate, endDate, branchid] : [startDate, endDate]);
    }
    async getExpenseGrowthRateAnalytics(year, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        current_month.month,
        current_month.total_expenses AS current_amount,
        previous_month.total_expenses AS previous_amount,
        CASE
          WHEN previous_month.total_expenses > 0 THEN
            ROUND(((current_month.total_expenses - previous_month.total_expenses) / previous_month.total_expenses) * 100, 2)
          ELSE NULL
        END AS growth_percentage
      FROM (
        SELECT
          MONTH(er.date) AS month,
          SUM(er.amount) AS total_expenses
        FROM expensesrecord er
        INNER JOIN expense_payments ep ON er.id = ep.expense_id
        WHERE ep.status = 'Paid'
          AND YEAR(er.date) = ?
          ${branchid ? 'AND er.branchid = ?' : ''}
        GROUP BY MONTH(er.date)
      ) current_month
      LEFT JOIN (
        SELECT
          MONTH(er.date) AS month,
          SUM(er.amount) AS total_expenses
        FROM expensesrecord er
        INNER JOIN expense_payments ep ON er.id = ep.expense_id
        WHERE ep.status = 'Paid'
          AND YEAR(er.date) = ?
          ${branchid ? 'AND er.branchid = ?' : ''}
        GROUP BY MONTH(er.date)
      ) previous_month ON current_month.month = previous_month.month + 1
      ORDER BY current_month.month ASC
    `, branchid ? [year, branchid, year, branchid] : [year, year]);
    }
    async getExpenseApprovalTimelineAnalytics(startDate, endDate, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        COALESCE(AVG(TIMESTAMPDIFF(HOUR, er.date, er.approvedon)), 0) AS avg_approval_hours,
        COALESCE(AVG(TIMESTAMPDIFF(DAY, er.date, er.approvedon)), 0) AS avg_approval_days,
        COUNT(*) AS total_expenses,
        COUNT(CASE WHEN TIMESTAMPDIFF(DAY, er.date, er.approvedon) <= 1 THEN 1 END) AS approved_within_1_day,
        COUNT(CASE WHEN TIMESTAMPDIFF(DAY, er.date, er.approvedon) <= 7 THEN 1 END) AS approved_within_1_week,
        COUNT(CASE WHEN TIMESTAMPDIFF(DAY, er.date, er.approvedon) > 7 THEN 1 END) AS approved_after_1_week
      FROM expensesrecord er
      WHERE er.approved = 1
        AND er.approvedon IS NOT NULL
        AND DATE(er.date) BETWEEN ? AND ?
        ${branchid ? 'AND er.branchid = ?' : ''}
    `, branchid ? [startDate, endDate, branchid] : [startDate, endDate]);
    }
}
exports.ExpenseAnalyticsQueries = ExpenseAnalyticsQueries;
