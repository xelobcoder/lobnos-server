export const PENDING_RESULT_TAT_THRESHOLDS = [6, 12, 24, 32, 64] as const;

const PENDING_RESULT_FROM_WHERE = `
     FROM test_ascension AS ta
     INNER JOIN dboservices AS ss ON ss.serviceid = ta.serviceid
     INNER JOIN billing AS bb ON bb.billingid = ss.billingid
     INNER JOIN new_patients AS np ON np.patientid = bb.patientid
     INNER JOIN test_panels AS tp ON tp.id = ta.testid
     LEFT JOIN departments AS d ON d.id = tp.category
     LEFT JOIN testdetails AS td ON td.testid = tp.id
     WHERE ta.resultEntryEnd IS NULL
       AND ta.ascension_date IS NOT NULL
       AND (ss.isDeleted = 0 OR ss.isDeleted IS NULL)
     AND LOWER(COALESCE(ss.status, 'active')) NOT IN ('voided', 'refunded', 'cancelled', 'written-off')
`;

export function buildPendingResultTATSummaryQuery(): { query: string; params: number[] } {
     const columns = PENDING_RESULT_TAT_THRESHOLDS.map((hours) =>
          `COALESCE(SUM(TIMESTAMPDIFF(MINUTE, ta.ascension_date, NOW()) >= ?), 0) AS over_${hours}_hours`
     ).join(',\n');

     return {
          query: `SELECT ${columns} ${PENDING_RESULT_FROM_WHERE}`,
          params: PENDING_RESULT_TAT_THRESHOLDS.map((hours) => hours * 60),
     };
}

export function buildPendingResultTATCountQuery(thresholdHours: number): { query: string; params: number[] } {
     const thresholdMinutes = thresholdHours * 60;
     return {
          query: `SELECT COUNT(*) AS total ${PENDING_RESULT_FROM_WHERE} AND TIMESTAMPDIFF(MINUTE, ta.ascension_date, NOW()) >= ?`,
          params: [thresholdMinutes],
     };
}

export function buildPendingResultTATPageQuery(
     thresholdHours: number,
     count: number,
     offset: number
): { query: string; params: number[] } {
     const thresholdMinutes = thresholdHours * 60;
     return {
          query: `SELECT
               ta.id AS ascensionId,
               ta.billingid AS billingId,
               ta.testid AS testId,
               ta.ascension_date AS clockStartedAt,
               ta.collectionEndDate AS collectedAt,
               ta.processingStartDate,
               ta.processingEndDate,
               TIMESTAMPDIFF(MINUTE, ta.ascension_date, NOW()) AS elapsedMinutes,
               bb.branchid,
               np.fullpatientid AS patientNumber,
               CONCAT_WS(' ', np.firstname, np.middlename, np.lastname) AS patientName,
               tp.name AS testName,
               d.department,
               CASE WHEN td.tat > 0 THEN CEIL(td.tat * CASE LOWER(COALESCE(td.tatEvaluation, 'min')) WHEN 'hour' THEN 60 WHEN 'hours' THEN 60 WHEN 'day' THEN 1440 WHEN 'days' THEN 1440 WHEN 'seconds' THEN 1/60 ELSE 1 END) ELSE NULL END AS configuredTat
               ${PENDING_RESULT_FROM_WHERE}
               AND TIMESTAMPDIFF(MINUTE, ta.ascension_date, NOW()) >= ?
               ORDER BY elapsedMinutes DESC, ta.id ASC
               LIMIT ? OFFSET ?`,
          params: [thresholdMinutes, count, offset],
     };
}
