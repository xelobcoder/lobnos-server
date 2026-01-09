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
        DATE(ep.payment_date) AS expense_date,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT ep.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees,
        COUNT(DISTINCT er.merchant) AS unique_merchants
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid' AND DATE(ep.payment_date) BETWEEN ? AND ?
      GROUP BY DATE(ep.payment_date)
      ORDER BY expense_date DESC
    `, [startDate, endDate]);
    }
    async getExpenseComparisonByPeriod(currentStart, currentEnd, previousStart, previousEnd, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        'current' AS period,
       COALESCE(SUM(ep.amount), 0) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        COALESCE(AVG(ep.amount), 0) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(ep.payment_date) BETWEEN ? AND ?
        ${branchid ? 'AND er.branchid = ?' : ''}

      UNION ALL

      SELECT
        'previous' AS period,
        COALESCE(SUM(ep.amount), 0) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        COALESCE(AVG(ep.amount), 0) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(ep.payment_date) BETWEEN ? AND ?
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
        DATE(ep.payment_date) AS expense_date,
        em.id AS merchant_id,
        SUM(ep.amount) AS total_amount,
        COUNT(DISTINCT ep.id) AS expense_count
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      LEFT JOIN expense_merchants em ON er.merchant = em.id
      WHERE ep.status = 'Paid'
        AND DATE(ep.payment_date) BETWEEN ? AND ?
      GROUP BY em.name
      ORDER BY expense_date DESC, total_amount DESC
    `, [startDate, endDate]);
    }
    async getHourlyExpenseAnalytics(date) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        HOUR(ep.payment_date) AS expense_hour,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(ep.payment_date) = ?
      GROUP BY HOUR(ep.payment_date)
      ORDER BY expense_hour ASC
    `, [date]);
    }
    async getMonthlyExpenseAnalytics(year) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        MONTH(ep.payment_date) AS expense_month,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(ep.payment_date) = ?
      GROUP BY MONTH(ep.payment_date)
      ORDER BY expense_month ASC
    `, [year]);
    }
    async getWeeklyExpenseAnalytics(year) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        WEEK(ep.payment_date) AS expense_week,
        YEAR(ep.payment_date) AS expense_year,
        MIN(DATE(ep.payment_date)) AS week_start_date,
        MAX(DATE(ep.payment_date)) AS week_end_date,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(ep.payment_date) = ?
      GROUP BY YEAR(ep.payment_date), WEEK(ep.payment_date)
      ORDER BY expense_year ASC, expense_week ASC
    `, [year]);
    }
    async getQuarterlyExpenseAnalytics(year) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        QUARTER(ep.payment_date) AS expense_quarter,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(ep.payment_date) = ?
      GROUP BY QUARTER(ep.payment_date)
      ORDER BY expense_quarter ASC
    `, [year]);
    }
    async getYearlyExpenseAnalytics(startYear, endYear) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        YEAR(ep.payment_date) AS expense_year,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount,
        COUNT(DISTINCT er.employeeid) AS unique_employees,
        COUNT(DISTINCT er.merchant) AS unique_merchants
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND YEAR(ep.payment_date) BETWEEN ? AND ?
      GROUP BY YEAR(ep.payment_date)
      ORDER BY expense_year ASC
    `, [startYear, endYear]);
    }
    async getExpenseAnalyticsByBranch(startDate, endDate) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        b.name AS branch_name,
        SUM(ep.amount) AS total_expenses,
        COUNT(DISTINCT er.id) AS expense_count,
        AVG(ep.amount) AS avg_expense_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      LEFT JOIN branch b ON er.branchid = b.branchid
      WHERE ep.status = 'Paid'
        AND DATE(ep.payment_date) BETWEEN ? AND ?
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
          WHEN ep.amount < 100 THEN 'Small'
          WHEN ep.amount >= 100 AND ep.amount < 1000 THEN 'Medium'
          WHEN ep.amount >= 1000 AND ep.amount < 10000 THEN 'Large'
          ELSE 'Extra Large'
        END AS bucket,
        COUNT(*) AS expense_count,
        SUM(ep.amount) AS total_amount,
        AVG(ep.amount) AS avg_amount
      FROM expensesrecord er
      INNER JOIN expense_payments ep ON er.id = ep.expense_id
      WHERE ep.status = 'Paid'
        AND DATE(ep.payment_date) BETWEEN ? AND ?
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
          MONTH(ep.payment_date) AS month,
          SUM(ep.amount) AS total_expenses
        FROM expensesrecord er
        INNER JOIN expense_payments ep ON er.id = ep.expense_id
        WHERE ep.status = 'Paid'
          AND YEAR(ep.payment_date) = ?
          ${branchid ? 'AND er.branchid = ?' : ''}
        GROUP BY MONTH(ep.payment_date)
      ) current_month
      LEFT JOIN (
        SELECT
          MONTH(ep.payment_date) AS month,
          SUM(ep.amount) AS total_expenses
        FROM expensesrecord er
        INNER JOIN expense_payments ep ON er.id = ep.expense_id
        WHERE ep.status = 'Paid'
          AND YEAR(ep.payment_date) = ?
          ${branchid ? 'AND er.branchid = ?' : ''}
        GROUP BY MONTH(ep.payment_date)
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
    async getExpenseBreakdownWithPayments(startDate, endDate, branchid) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        return connection.raw(`
      SELECT
        er.id AS expense_id,
        er.name AS expense_name,
        er.date AS expense_date,
        er.amount AS expense_amount,
        er.category AS expense_category,
        er.description AS expense_description,
        er.approved AS is_approved,
        er.approvedon AS approved_date,
        er.approvedby AS approved_by_id,
        rr.username AS approved_by_username,
        er.employeeid,
        r.username AS employee_name,
        er.branchid,
        er.merchant AS merchant_id,
        em.name AS merchant_name,
        em.email AS merchant_email,
        em.phone AS merchant_phone,
        em.address AS merchant_address,
        ep.id AS payment_id,
        ep.payment_date,
        ep.amount AS payment_amount,
        ep.method AS payment_method,
        ep.status AS payment_status,
        ec.category AS category_name,
        ep.created_by AS payment_created_by,
        epc.username AS payment_created_by_username,
        ep.created_on AS payment_created_on,
        i.id AS invoice_id,
        b.name AS branch_name,
        i.invoice_number,
        i.invoice_date,
        i.due_date,
        i.status AS invoice_status,
        i.total_amount AS invoice_total,
        i.tax_amount AS invoice_tax
      FROM expensesrecord er
      LEFT JOIN roles r ON er.employeeid = r.employeeid
      LEFT JOIN roles rr ON er.approvedby = rr.employeeid
      LEFT JOIN dboexpensecategory ec ON er.category = ec.id
      LEFT JOIN expense_merchants em ON er.merchant = em.id
      LEFT JOIN branch b ON er.branchid = b.branchid
      LEFT JOIN expense_payments ep ON er.id = ep.expense_id
      LEFT JOIN roles epc ON ep.created_by = epc.employeeid
      LEFT JOIN invoice_expenses ie ON er.id = ie.expense_id
      LEFT JOIN invoices i ON ie.invoice_id = i.id
      WHERE DATE(ep.payment_date) BETWEEN ? AND ?
        ${branchid ? 'AND er.branchid = ?' : ''}
      ORDER BY er.date DESC, er.id DESC
    `, branchid ? [startDate, endDate, branchid] : [startDate, endDate]);
    }
    async getPaymentsByMerchant(merchantId, page, count) {
        const connection = await (0, KnexConnections_1.default)(this.tenantId);
        const offset = (page - 1) * count;
        // Get total count
        const totalResult = await connection.raw(`
      SELECT COUNT(*) as total
      FROM expense_payments ep
      INNER JOIN expensesrecord er ON ep.expense_id = er.id
      WHERE er.merchant = ? AND ep.status = 'Paid'
    `, [merchantId]);
        const total = totalResult[0][0].total;
        // Get paginated data
        const dataResult = await connection.raw(`
      SELECT
        ep.id AS payment_id,
        ep.payment_date,
        ep.amount AS payment_amount,
        ep.method AS payment_method,
        ep.status AS payment_status,
        ep.created_on AS payment_created_on,
        ep.created_by AS payment_created_by,
        epc.username AS payment_created_by_username,
        er.id AS expense_id,
        er.date AS expense_date,
        er.amount AS expense_amount,
        er.description AS expense_description,
        er.category AS expense_category,
        ec.category AS category_name,
        r.username AS employee_name,
        b.name AS branch_name
      FROM expense_payments ep
      INNER JOIN expensesrecord er ON ep.expense_id = er.id
      LEFT JOIN roles r ON er.employeeid = r.employeeid
      LEFT JOIN dboexpensecategory ec ON er.category = ec.id
      LEFT JOIN branch b ON er.branchid = b.branchid
      LEFT JOIN roles epc ON ep.created_by = epc.employeeid
      WHERE er.merchant = ? AND ep.status = 'Paid'
      ORDER BY ep.payment_date DESC
      LIMIT ? OFFSET ?
    `, [merchantId, count, offset]);
        return {
            data: dataResult[0],
            total: parseInt(total),
            page: page,
            pageSize: count,
            totalPages: Math.ceil(total / count)
        };
    }
}
exports.ExpenseAnalyticsQueries = ExpenseAnalyticsQueries;
