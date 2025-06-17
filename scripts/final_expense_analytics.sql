DELIMITER //

-- Drop all procedures first
DROP PROCEDURE IF EXISTS BranchMonthlyExpenses //
DROP PROCEDURE IF EXISTS EmployeeCategoryExpenses //
DROP PROCEDURE IF EXISTS ApprovalStatusByBranchExpenses //
DROP PROCEDURE IF EXISTS ServiceLinkedExpenses //
DROP PROCEDURE IF EXISTS GetExpenseDetailsExpenses //
DROP PROCEDURE IF EXISTS MonthlyExpenseSummaryExpenses //
DROP PROCEDURE IF EXISTS TotalExpensesByCategory //
DROP PROCEDURE IF EXISTS DailyExpenseSummaryExpenses //
DROP PROCEDURE IF EXISTS WeeklyExpenseSummaryExpenses //
DROP PROCEDURE IF EXISTS YearlyExpenseSummaryExpenses //
DROP PROCEDURE IF EXISTS HourlyExpenseSummaryForDateExpenses //
DROP PROCEDURE IF EXISTS TopExpenseCategoriesExpenses //
DROP PROCEDURE IF EXISTS EmployeeTopExpenses //
DROP PROCEDURE IF EXISTS ExpenseTrendByCategoryExpenses //
DROP PROCEDURE IF EXISTS PendingExpensesList //
DROP PROCEDURE IF EXISTS ExpenseCountByStatusExpenses //

-- Create procedures with "Expenses" in names
CREATE PROCEDURE BranchMonthlyExpenses(
  IN branch_id INT,
  IN start_date DATETIME,
  IN end_date DATETIME
)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE_FORMAT(ex.date, '%Y-%m') AS month,
    SUM(ex.amount) AS total_spent
  FROM expensesrecord AS ex 
  LEFT JOIN branch AS b ON ex.branchid = b.branchid
  WHERE ex.date BETWEEN start_date AND end_date
    AND ex.branchid = branch_id
  GROUP BY b.name, DATE_FORMAT(ex.date, '%Y-%m')
  ORDER BY b.name, month;
END //

CREATE PROCEDURE EmployeeCategoryExpenses(
  IN emp_id INT,
  IN branch_id INT,
  IN start_date DATETIME,
  IN end_date DATETIME
)
BEGIN
  SELECT 
    ec.category AS category_name,
    b.name AS branch_name,
    r.username AS employee_username,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN branch b ON er.branchid = b.branchid
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  WHERE er.employeeid = emp_id
    AND er.branchid = branch_id
    AND er.date BETWEEN start_date AND end_date
  GROUP BY ec.category, b.name, r.username;
END //

CREATE PROCEDURE ApprovalStatusByBranchExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    b.name AS branch_name,
    SUM(CASE WHEN approved = 1 THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN approved = 0 AND approvedby != 0 THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN approved = 0 AND approvedby = 0 THEN 1 ELSE 0 END) AS pending_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name;
END //

CREATE PROCEDURE ServiceLinkedExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    serviceid,
    b.name AS branch_name,
    COUNT(*) AS total_records,
    SUM(amount) AS total_spent
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE isassociatedservice = 1
    AND er.branchid = branch_id
  GROUP BY serviceid, b.name;
END //

CREATE PROCEDURE GetExpenseDetailsExpenses(
  IN expense_id INT,
  IN branch_id INT
)
BEGIN
  SELECT 
    er.id,
    er.name,
    er.date,
    er.merchant,
    er.amount,
    ec.category AS category_name,
    er.description,
    r.username AS employee_username,
    b.name AS branch_name,
    er.approved,
    er.approvedby,
    er.approvedon,
    er.rejectionmessage
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.id = expense_id AND er.branchid = branch_id;
END //

CREATE PROCEDURE MonthlyExpenseSummaryExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE_FORMAT(er.date, '%Y-%m') AS month,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS record_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, DATE_FORMAT(er.date, '%Y-%m')
  ORDER BY month DESC;
END //

CREATE PROCEDURE TotalExpensesByCategory(
  IN branch_id INT
)
BEGIN
  SELECT 
    ec.category,
    b.name AS branch_name,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY ec.category, b.name;
END //

CREATE PROCEDURE DailyExpenseSummaryExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    b.name AS branch_name,
    DATE(er.date) AS day,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, DATE(er.date)
  ORDER BY day DESC;
END //

CREATE PROCEDURE WeeklyExpenseSummaryExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    b.name AS branch_name,
    YEAR(er.date) AS year,
    WEEK(er.date, 1) AS week_number,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, YEAR(er.date), WEEK(er.date, 1)
  ORDER BY year DESC, week_number DESC;
END //

CREATE PROCEDURE YearlyExpenseSummaryExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    b.name AS branch_name,
    YEAR(er.date) AS year,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS record_count
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE er.branchid = branch_id
  GROUP BY b.name, YEAR(er.date)
  ORDER BY year DESC;
END //

CREATE PROCEDURE HourlyExpenseSummaryForDateExpenses(
  IN branch_id INT,
  IN target_date DATE
)
BEGIN
  SELECT 
    b.name AS branch_name,
    HOUR(er.date) AS hour_of_day,
    SUM(er.amount) AS total_spent,
    COUNT(*) AS total_records
  FROM expensesrecord er
  LEFT JOIN branch b ON er.branchid = b.branchid
  WHERE DATE(er.date) = target_date
    AND er.branchid = branch_id
  GROUP BY b.name, HOUR(er.date)
  ORDER BY hour_of_day;
END //

CREATE PROCEDURE TopExpenseCategoriesExpenses(
  IN branch_id INT,
  IN limit_count INT
)
BEGIN
  SELECT 
    ec.category AS category_name,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  JOIN dboexpensecategory ec ON ec.id = er.category
  WHERE er.branchid = branch_id
  GROUP BY ec.category
  ORDER BY total_spent DESC
  LIMIT limit_count;
END //

CREATE PROCEDURE EmployeeTopExpenses(
  IN branch_id INT,
  IN limit_count INT
)
BEGIN
  SELECT 
    r.username AS employee_username,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  WHERE er.branchid = branch_id
  GROUP BY r.username
  ORDER BY total_spent DESC
  LIMIT limit_count;
END //

CREATE PROCEDURE ExpenseTrendByCategoryExpenses(
  IN branch_id INT,
  IN category_id INT,
  IN start_date DATETIME,
  IN end_date DATETIME
)
BEGIN
  SELECT 
    DATE(er.date) AS day,
    SUM(er.amount) AS total_spent
  FROM expensesrecord er
  WHERE er.branchid = branch_id
    AND er.category = category_id
    AND er.date BETWEEN start_date AND end_date
  GROUP BY DATE(er.date)
  ORDER BY day;
END //

CREATE PROCEDURE PendingExpensesList(
  IN branch_id INT
)
BEGIN
  SELECT 
    er.id,
    er.name,
    er.date,
    er.amount,
    r.username AS employee_username,
    ec.category AS category_name
  FROM expensesrecord er
  LEFT JOIN roles r ON er.employeeid = r.employeeid
  LEFT JOIN dboexpensecategory ec ON ec.id = er.category
  WHERE er.branchid = branch_id
    AND er.approved = 0
    AND er.approvedby = 0
  ORDER BY er.date DESC;
END //

CREATE PROCEDURE ExpenseCountByStatusExpenses(
  IN branch_id INT
)
BEGIN
  SELECT 
    SUM(CASE WHEN er.approved = 1 THEN 1 ELSE 0 END) AS approved_count,
    SUM(CASE WHEN er.approved = 0 AND er.approvedby != 0 THEN 1 ELSE 0 END) AS rejected_count,
    SUM(CASE WHEN er.approved = 0 AND er.approvedby = 0 THEN 1 ELSE 0 END) AS pending_count
  FROM expensesrecord er
  WHERE er.branchid = branch_id;
END //

DELIMITER ;