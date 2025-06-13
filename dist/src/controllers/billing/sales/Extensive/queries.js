"use strict";
// 📌 Query Definitions at Top
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLINCIAN_SALES_PAYMENT = exports.QUERY_EMPLOYEES_COLLECTED_CASH = exports.QUERY_BREAK_DOWN_PAYMENT_MODES = exports.QUERY_MISMATCHED_PAYMENT_HISTORY = exports.QUERY_AUDIT_TRAIL_ACTIONS = exports.QUERY_TOP_PERFORMING_BRANCHES = exports.QUERY_TEST_TRANSACTION_SNAPSHOT = exports.QUERY_NIGHT_ADJUSTMENT_IMPACT = exports.QUERY_DAILY_CEO_SNAPSHOT = void 0;
exports.QUERY_DAILY_CEO_SNAPSHOT = `
  SELECT * FROM daily_analytics_snapshot  
  WHERE analytics_date BETWEEN ? AND ?
`;
exports.QUERY_NIGHT_ADJUSTMENT_IMPACT = `
  SELECT * FROM daily_adjustments_impact  
  WHERE report_date BETWEEN ? AND ?
`;
exports.QUERY_TEST_TRANSACTION_SNAPSHOT = `
  SELECT * FROM daily_test_transaction_snap_shot 
  WHERE test_date BETWEEN ? AND ?
`;
exports.QUERY_TOP_PERFORMING_BRANCHES = `
  SELECT b.branchid, SUM(b.paid) AS revenue,branch.name AS  branchname
  FROM billing AS b
  INNER JOIN branch ON branch.branchid = b.branchid
  WHERE DATE(b.billedon) BETWEEN ? AND ?
  GROUP BY b.branchid
  ORDER BY revenue DESC
`;
exports.QUERY_AUDIT_TRAIL_ACTIONS = `
  SELECT action_type, COUNT(*) AS count
  FROM billing_audit
  WHERE DATE(action_timestamp) BETWEEN  ? AND ?
  GROUP BY action_type
`;
exports.QUERY_MISMATCHED_PAYMENT_HISTORY = `
  SELECT 
    b.billingid,
    b.paid AS paid_in_billing,
    IFNULL(SUM(bh.Amount), 0) AS total_in_billinghx,
    (b.paid - IFNULL(SUM(bh.Amount), 0)) AS difference
  FROM billing b
  LEFT JOIN billinghx bh ON b.billingid = bh.Billingid
  WHERE DATE(b.billedon)  BETWEEN ? AND ?
  GROUP BY b.billingid
  HAVING difference != 0
`;
exports.QUERY_BREAK_DOWN_PAYMENT_MODES = `
  SELECT 
    pm.PaymentMode AS mode,
    COUNT(*) AS total_transactions,
    SUM(bh.Amount) AS total_amount
  FROM billinghx bh
  JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
  WHERE DATE(bh.Date) BETWEEN ? AND ?
  GROUP BY pm.PaymentMode
  ORDER BY total_amount DESC
`;
exports.QUERY_EMPLOYEES_COLLECTED_CASH = `
  SELECT 
    pm.PaymentMode AS mode,
    r.username,
    COUNT(*) AS total_transactions,
    SUM(bh.Amount) AS total_amount,
    bh.Date AS payment_date
  FROM billinghx bh
  JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
  JOIN roles r ON r.employeeid = bh.employeeid
  WHERE DATE(bh.Date) BETWEEN  ? AND  ?
  GROUP BY pm.PaymentMode, bh.employeeid
  ORDER BY mode, total_amount DESC
`;
exports.CLINCIAN_SALES_PAYMENT = `
SELECT * FROM clinician_daily_sales_summary WHERE sale_date BETWEEN ? AND ?
`;
