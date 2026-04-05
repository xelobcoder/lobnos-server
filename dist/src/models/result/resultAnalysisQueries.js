"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_test_day_case_count_by_hour = exports.q_test_month_case_count_year = exports.q_test_month_case_count = exports.q_test_month_case_count_by_day = void 0;
exports.q_test_month_case_count_by_day = `SELECT COUNT(*) AS caseCount FROM test_ascension AS ta INNER JOIN billing AS b ON ta.billingid = b.billingid WHERE ta.testid = ? AND ta.month  = ? AND DAY(b.billedon) = ?`;
exports.q_test_month_case_count = `SELECT COUNT(*) AS caseCount FROM test_ascension WHERE testid = ? AND month = ?`;
exports.q_test_month_case_count_year = `SELECT COUNT(*) AS caseCount FROM test_ascension  WHERE testid = ? AND year = ?`;
exports.q_test_day_case_count_by_hour = `
SELECT HOUR(b.billedon) AS hour, COUNT(*) AS caseCount
FROM test_ascension AS ta
INNER JOIN billing AS b ON ta.billingid = b.billingid
WHERE ta.testid = ?
	AND MONTH(b.billedon) = ?
	AND DAY(b.billedon) = ?
	AND YEAR(b.billedon) = ?
GROUP BY HOUR(b.billedon)
ORDER BY HOUR(b.billedon)
`;
