"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_DailyExpenseAnalytics\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            DATE(er.date) AS expense_date,
            COUNT(*) AS total_expenses,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            COUNT(DISTINCT er.category) AS unique_categories,
            COUNT(DISTINCT er.employeeid) AS unique_employees,
            GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames,
            GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        WHERE DATE(er.date) BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY DATE(er.date), b.name
        ORDER BY expense_date DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_ExpenseComparisonByPeriod\`(
        IN branch_id INT,
        IN current_start_date DATE,
        IN current_end_date DATE,
        IN previous_start_date DATE,
        IN previous_end_date DATE
    )
    BEGIN
        SELECT
            'current_period' AS period_type,
            COUNT(*) AS expense_count,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        WHERE er.date BETWEEN current_start_date AND current_end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)

        UNION ALL

        SELECT
            'previous_period' AS period_type,
            COUNT(*) AS expense_count,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        WHERE er.date BETWEEN previous_start_date AND previous_end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id);
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_ExpenseTrendsByCategory\`(
        IN category_id INT,
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            DATE_FORMAT(er.date, '%Y-%m') AS month_year,
            YEAR(er.date) AS year,
            MONTH(er.date) AS month,
            COUNT(*) AS expense_count,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            ec.category AS category_name,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN dboexpensecategory ec ON er.category = ec.id
        LEFT JOIN branch b ON er.branchid = b.branchid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (category_id IS NULL OR er.category = category_id)
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY YEAR(er.date), MONTH(er.date), ec.category, b.name
        ORDER BY year DESC, month DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_HourlyExpenseAnalytics\`(
        IN branch_id INT,
        IN target_date DATE
    )
    BEGIN
        SELECT
            DATE(er.date) AS expense_date,
            HOUR(er.date) AS expense_hour,
            CONCAT(LPAD(HOUR(er.date), 2, '0'), ':00-', LPAD(HOUR(er.date)+1, 2, '0'), ':00') AS hour_range,
            COUNT(*) AS total_expenses,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            COUNT(DISTINCT er.category) AS unique_categories,
            COUNT(DISTINCT er.employeeid) AS unique_employees,
            GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames,
            GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        WHERE DATE(er.date) = target_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY DATE(er.date), HOUR(er.date), b.name
        ORDER BY expense_hour ASC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_MonthlyExpenseAnalytics\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            YEAR(er.date) AS year,
            MONTH(er.date) AS month,
            DATE_FORMAT(er.date, '%M %Y') AS month_year,
            COUNT(*) AS total_expenses,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            COUNT(DISTINCT er.category) AS unique_categories,
            COUNT(DISTINCT er.employeeid) AS unique_employees,
            COUNT(DISTINCT er.merchant) AS unique_merchants,
            GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames,
            GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY YEAR(er.date), MONTH(er.date), b.name
        ORDER BY year DESC, month DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_QuarterlyExpenseAnalytics\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            YEAR(er.date) AS year,
            QUARTER(er.date) AS quarter,
            CONCAT('Q', QUARTER(er.date), ' ', YEAR(er.date)) AS quarter_year,
            COUNT(*) AS total_expenses,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            COUNT(DISTINCT er.category) AS unique_categories,
            COUNT(DISTINCT er.employeeid) AS unique_employees,
            GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames,
            GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY YEAR(er.date), QUARTER(er.date), b.name
        ORDER BY year DESC, quarter DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_TopExpenseCategories\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            ec.category AS category_name,
            COUNT(*) AS expense_count,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN dboexpensecategory ec ON er.category = ec.id
        LEFT JOIN branch b ON er.branchid = b.branchid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY ec.category, b.name
        ORDER BY total_amount DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_TopExpenseEmployees\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE,
        IN limit_count INT
    )
    BEGIN
        SELECT
            r.username AS employee_name,
            er.employeeid,
            COUNT(*) AS expense_count,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        LEFT JOIN branch b ON er.branchid = b.branchid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY er.employeeid, r.username, b.name
        ORDER BY total_amount DESC
        LIMIT limit_count;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_TopExpenseMerchants\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            em.name AS merchant_name,
            COUNT(*) AS expense_count,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN expense_merchants em ON em.id = er.merchant
        LEFT JOIN branch b ON er.branchid = b.branchid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND er.merchant IS NOT NULL
            AND er.merchant != ''
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY em.name, b.name
        ORDER BY total_amount DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_WeeklyExpenseAnalytics\`(
        IN branch_id INT,
        IN start_date DATE,
        IN end_date DATE
    )
    BEGIN
        SELECT
            YEAR(er.date) AS year,
            WEEK(er.date) AS week_number,
            DATE_FORMAT(MIN(er.date), '%Y-%m-%d') AS week_start,
            DATE_FORMAT(MAX(er.date), '%Y-%m-%d') AS week_end,
            COUNT(*) AS total_expenses,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            COUNT(DISTINCT er.category) AS unique_categories,
            COUNT(DISTINCT er.employeeid) AS unique_employees,
            GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames,
            GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        WHERE er.date BETWEEN start_date AND end_date
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY YEAR(er.date), WEEK(er.date), b.name
        ORDER BY year DESC, week_number DESC;
    END
  `);
    await knex.raw(`
    CREATE PROCEDURE \`lims_anal_exp_YearlyExpenseAnalytics\`(
        IN branch_id INT,
        IN start_year INT,
        IN end_year INT
    )
    BEGIN
        SELECT
            YEAR(er.date) AS year,
            COUNT(*) AS total_expenses,
            SUM(er.amount) AS total_amount,
            AVG(er.amount) AS average_amount,
            MIN(er.amount) AS min_amount,
            MAX(er.amount) AS max_amount,
            COUNT(DISTINCT er.category) AS unique_categories,
            COUNT(DISTINCT er.employeeid) AS unique_employees,
            COUNT(DISTINCT er.merchant) AS unique_merchants,
            COUNT(DISTINCT MONTH(er.date)) AS active_months,
            GROUP_CONCAT(DISTINCT r.username SEPARATOR ', ') AS employee_usernames,
            GROUP_CONCAT(DISTINCT r.role SEPARATOR ', ') AS employee_roles,
            b.name AS branch_name
        FROM expensesrecord er
        LEFT JOIN branch b ON er.branchid = b.branchid
        LEFT JOIN roles r ON er.employeeid = r.employeeid
        WHERE YEAR(er.date) BETWEEN start_year AND end_year
            AND er.approved = 1
            AND (branch_id IS NULL OR er.branchid = branch_id)
        GROUP BY YEAR(er.date), b.name
        ORDER BY year DESC;
    END
  `);
}
exports.up = up;
async function down(knex) {
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_DailyExpenseAnalytics`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_ExpenseComparisonByPeriod`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_ExpenseTrendsByCategory`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_HourlyExpenseAnalytics`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_MonthlyExpenseAnalytics`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_QuarterlyExpenseAnalytics`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_TopExpenseCategories`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_TopExpenseEmployees`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_TopExpenseMerchants`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_WeeklyExpenseAnalytics`');
    await knex.raw('DROP PROCEDURE IF EXISTS `lims_anal_exp_YearlyExpenseAnalytics`');
}
exports.down = down;
