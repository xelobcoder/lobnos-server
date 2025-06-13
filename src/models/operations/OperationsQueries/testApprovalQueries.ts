export const q_updateTestApprovalStatus: string = `UPDATE dbotestresultapproval SET isapproved=?,approvedBy=? WHERE ascensionid = ?`;

export const q_get_print_count_for_test: string = `SELECT printCount FROM dbotestresultapproval WHERE ascensionid = ?`;


export const q_get_result_approval_details: string = `SELECT * FROM dbotestresultapproval WHERE ascensionid = ?`;