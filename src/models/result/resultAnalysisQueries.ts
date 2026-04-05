export const q_test_month_case_count_by_day = `SELECT COUNT(*) AS caseCount FROM test_ascension AS ta INNER JOIN billing AS b ON ta.billingid = b.billingid WHERE ta.testid = ? AND ta.month  = ? AND DAY(b.billedon) = ?`;

export const q_test_month_case_count = `SELECT COUNT(*) AS caseCount FROM test_ascension WHERE testid = ? AND month = ?`;

export const q_test_month_case_count_year = `SELECT COUNT(*) AS caseCount FROM test_ascension  WHERE testid = ? AND year = ?`;

export const q_test_day_case_count_by_hour = `
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