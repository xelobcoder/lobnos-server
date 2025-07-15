"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLINCIAN_SALES_PAYMENT = exports.QUERY_EMPLOYEES_COLLECTED_CASH = exports.QUERY_BREAK_DOWN_PAYMENT_MODES = exports.QUERY_MISMATCHED_PAYMENT_HISTORY = exports.QUERY_TOP_PERFORMING_BRANCHES = exports.QUERY_TEST_TRANSACTION_SNAPSHOT = exports.QUERY_NIGHT_ADJUSTMENT_IMPACT = exports.QUERY_DAILY_CEO_SNAPSHOT = void 0;
exports.QUERY_DAILY_CEO_SNAPSHOT = `CALL bl_get_billing_analytics_summary(?, ?)`;
exports.QUERY_NIGHT_ADJUSTMENT_IMPACT = `
 CALL bl_get_night_adjustment_summary(?, ?)
`;
exports.QUERY_TEST_TRANSACTION_SNAPSHOT = `
CALL bl_get_test_panel_summary(?, ?)
`;
exports.QUERY_TOP_PERFORMING_BRANCHES = `
CALL bl_get_branch_revenue_summary(?, ?)
`;
exports.QUERY_MISMATCHED_PAYMENT_HISTORY = `
CALL bl_get_billing_difference(?, ?)
`;
exports.QUERY_BREAK_DOWN_PAYMENT_MODES = `
 CALL bl_get_payment_mode_summary(?, ?)
`;
exports.QUERY_EMPLOYEES_COLLECTED_CASH = `
 CALL bl_get_payment_collected_by_employee_summary(?, ?)
`;
exports.CLINCIAN_SALES_PAYMENT = `
CALL 	bl_clinician_daily_sales_summary(?, ?)
`;
