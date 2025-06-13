export const generateNewExpenseQuery = `INSERT INTO expensesrecord (name, amount, mode, employeeid, branchid, description, merchant, category, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const RECEIPTS_PATH ="/../../../public/uploads/expenses/receipts"
export const getExpensesRecordQuery = `
SELECT 
    er.name,
    er.description,
    er.merchant,
    r.username,
    er.approved,
    er.date,
    er.createdon,
    er.id,
    er.employeeid,
    er.amount
FROM expensesrecord AS er 
INNER JOIN roles AS r ON r.employeeid = er.employeeid`;

export const getExpenseImageListQuery = `SELECT * FROM expensesrecord WHERE id = ?`;

export const calculateDailyExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE DATE(date) = ? AND approved = 1`;

export const calCurrentMonthExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE`;

export const calculateYearlyExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE`;

export const updateExpenseDecisionQuery = `UPDATE expensesrecord SET approved = ?, approvedon = NOW(), approvedby = ?`;

export const getAllExpenseCategoryQuery = "SELECT * FROM `dbo.expensecategory`";

export const isExpenseExistQuery = "SELECT * FROM `dbo.expensecategory` WHERE category = ?";

export const createExpenseCategoryQuery = "INSERT INTO `dbo.expensecategory` (category, employeeid) VALUES (?, ?)";

export const updateExpenseCategoryQuery = "UPDATE `dbo.expensecategory` SET category = ? WHERE id = ?";
