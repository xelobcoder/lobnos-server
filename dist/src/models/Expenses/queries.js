"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expense_between_dates_query = exports.updateExpenseCategoryQuery = exports.createExpenseCategoryQuery = exports.isExpenseExistQuery = exports.getAllExpenseCategoryQuery = exports.updateExpenseDecisionQuery = exports.calculateYearlyExpenseQuery = exports.calCurrentMonthExpenseQuery = exports.calculateDailyExpenseQuery = exports.getExpenseImageListQuery = exports.isRecordExistQuery = exports.updateExpenseQuery = exports.getExpensesRecordQuery = exports.RECEIPTS_PATH = exports.generateNewExpenseQuery = void 0;
exports.generateNewExpenseQuery = `INSERT INTO expensesrecord (name, amount, mode, employeeid, branchid, description, merchant, category, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
exports.RECEIPTS_PATH = "/../../../../public/uploads/expenses/receipts";
exports.getExpensesRecordQuery = `
SELECT 
    er.name,
    er.description,
    er.merchant,
    r.username,
    er.approved,
    er.date,
    er.createdon,
    CASE WHEN er.isassociatedservice AND er.merchant IS NOT NULL THEN
        CONCAT('Outsource - ', oo.name)
    ELSE
        em.name
    END AS merchant_name,
    er.id,
    er.employeeid,
    er.amount
FROM expensesrecord AS er 
INNER JOIN roles AS r ON r.employeeid = er.employeeid
LEFT JOIN expense_merchants AS em ON em.id = er.merchant
LEFT JOIN outsourcingorganization AS oo ON oo.outsourceid = er.merchant
`;
exports.updateExpenseQuery = `
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
exports.isRecordExistQuery = `SELECT * FROM expensesrecord WHERE id = ?  limit 1`;
exports.getExpenseImageListQuery = `SELECT * FROM expensesrecord WHERE id = ?`;
exports.calculateDailyExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE DATE(date) = ? AND approved = 1`;
exports.calCurrentMonthExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE`;
exports.calculateYearlyExpenseQuery = `SELECT SUM(amount) AS expense FROM expensesrecord WHERE`;
exports.updateExpenseDecisionQuery = `UPDATE expensesrecord SET approved = ?, approvedon = NOW(), approvedby = ?`;
exports.getAllExpenseCategoryQuery = "SELECT * FROM `dboexpensecategory`";
exports.isExpenseExistQuery = "SELECT * FROM `dboexpensecategory` WHERE category = ?";
exports.createExpenseCategoryQuery = "INSERT INTO `dboexpensecategory` (category, employeeid) VALUES (?, ?)";
exports.updateExpenseCategoryQuery = "UPDATE `dboexpensecategory` SET category = ? WHERE id = ?";
exports.expense_between_dates_query = `SELECT * FROM expensesrecord WHERE createdon BETWEEN ? AND ? ORDER BY createdon ASC`;
