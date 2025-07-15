export const QUERY_DAILY_CEO_SNAPSHOT = `CALL bl_get_billing_analytics_summary(?, ?)`;

export const QUERY_NIGHT_ADJUSTMENT_IMPACT = `
 CALL bl_get_night_adjustment_summary(?, ?)
`;

export const QUERY_TEST_TRANSACTION_SNAPSHOT = `
CALL bl_get_test_panel_summary(?, ?)
`;

export const QUERY_TOP_PERFORMING_BRANCHES = `
CALL bl_get_branch_revenue_summary(?, ?)
`;


export const QUERY_MISMATCHED_PAYMENT_HISTORY = `
CALL bl_get_billing_difference(?, ?)
`;

export const QUERY_BREAK_DOWN_PAYMENT_MODES = `
 CALL bl_get_payment_mode_summary(?, ?)
`;

export const QUERY_EMPLOYEES_COLLECTED_CASH = `
 CALL bl_get_payment_collected_by_employee_summary(?, ?)
`;

export const CLINCIAN_SALES_PAYMENT = `
CALL 	bl_clinician_daily_sales_summary(?, ?)
`