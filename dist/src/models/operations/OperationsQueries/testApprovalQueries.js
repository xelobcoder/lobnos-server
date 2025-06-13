"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_get_result_approval_details = exports.q_get_print_count_for_test = exports.q_updateTestApprovalStatus = void 0;
exports.q_updateTestApprovalStatus = `UPDATE dbotestresultapproval SET isapproved=?,approvedBy=? WHERE ascensionid = ?`;
exports.q_get_print_count_for_test = `SELECT printCount FROM dbotestresultapproval WHERE ascensionid = ?`;
exports.q_get_result_approval_details = `SELECT * FROM dbotestresultapproval WHERE ascensionid = ?`;
