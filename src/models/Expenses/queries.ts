export const generateNewExpenseQuery = `INSERT INTO expensesrecord (name, amount, mode, employeeid, branchid, description, merchant, category, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const RECEIPTS_PATH ="/../../../../public/uploads/expenses/receipts"
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


export const updateExpenseQuery = `
  UPDATE expensesrecord 
  SET 
    name = ?, 
    amount = ?, 
    mode = ?, 
    employeeid = ?, 
    branchid = ?, 
    description = ?, 
    merchant = ?, 
    category = ?, 
    date = ?
  WHERE id = ?
`;

export const isRecordExistQuery =  `SELECT * FROM expensesrecord WHERE id = ?  limit 1`

export const getExpenseImageListQuery = `SELECT * FROM expensesrecord WHERE id = ?`;

export const calculateDailyExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE DATE(date) = ? AND approved = 1`;

export const calCurrentMonthExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE`;

export const calculateYearlyExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE`;

export const updateExpenseDecisionQuery = `UPDATE expensesrecord SET approved = ?, approvedon = NOW(), approvedby = ?`;

export const getAllExpenseCategoryQuery = "SELECT * FROM `dboexpensecategory`";

export const isExpenseExistQuery = "SELECT * FROM `dboexpensecategory` WHERE category = ?";

export const createExpenseCategoryQuery = "INSERT INTO `dboexpensecategory` (category, employeeid) VALUES (?, ?)";

export const updateExpenseCategoryQuery = "UPDATE `dboexpensecategory` SET category = ? WHERE id = ?";


export const expense_between_dates_query = `SELECT * FROM expensesrecord WHERE createdon BETWEEN ? AND ? ORDER BY createdon ASC`;