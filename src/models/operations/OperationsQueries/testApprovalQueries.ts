export const q_updateTestApprovalStatus: string = `UPDATE dbotestresultapproval SET isapproved=?,approvedBy=?,lastupdatedon = NOW() WHERE ascensionid = ?`;
export const q_get_print_count_for_test: string = `SELECT printCount FROM dbotestresultapproval WHERE ascensionid = ?`;
export const q_get_result_approval_details: string = `SELECT * FROM dbotestresultapproval WHERE ascensionid = ?`;
export const q_update_result_print_count: string = `UPDATE dbotestresultapproval SET printCount = printCount + 1 WHERE ascensionid = ?`;