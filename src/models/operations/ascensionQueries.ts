export const phelobotomistSummary = `
      SELECT r.username AS Scientist,
     COUNT(*) AS total_tests,
      SUM(ss.approvalstatus = 1) AS approved_tests,
      SUM(ss.approvalstatus = 0  AND ss.validatedby IS NULL) AS unapproved_tests,
      SUM(ss.approvalstatus = 0  AND ss.validatedby IS NOT NULL) AS rejected_tests,
        (SUM(ss.approvalstatus = 1) / COUNT(*)) * 100 AS approval_rate
    FROM test_ascension AS ta
     INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
     INNER JOIN roles AS r ON r.employeeid = ta.sampleCollectedBy`;


     export const totalAllTimePendingCollections = `
     SELECT COUNT(*) AS total_pending_collections
     FROM test_ascension
     WHERE collectionEndDate IS NULL OR collectionEndDate IS NULL`;

export const approvedTestsPerScientist = `
    SELECT r.username AS Scientist, SUM(ss.approvalStatus = 1) AS approved_tests 
    FROM test_ascension AS ta
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
     INNER JOIN roles AS r ON r.employeeid = ta.sampleCollectedBy
    GROUP BY ta.sampleCollectedBy`;

export const approvalRatePerScientist = `
    SELECT r.username AS Scientist, 
           (SUM(ss.approvalstatus = 1) / COUNT(*)) * 100 AS approval_rate 
    FROM test_ascension AS ta 
      INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
     INNER JOIN roles AS r ON r.employeeid = ta.sampleCollectedBy
    GROUP BY ta.sampleCollectedBy`;

export const totalTestsPerMonth = `
    SELECT month, year, COUNT(*) AS total_tests 
    FROM test_ascension
    GROUP BY month, year`;

export const averageProcessingTime = `
    SELECT AVG(TIMESTAMPDIFF(MINUTE, processingStartDate, processingEndDate)) AS avg_processing_time 
    FROM test_ascension`;

export const totalTestsByApprovalStatus = `
    SELECT approvalstatus, COUNT(*) AS total_tests 
    FROM  samplestatus
    GROUP BY approvalStatus`;

export const testsSamplePendingApproval = `
    SELECT COUNT(*) AS pending_tests 
    FROM samplestatus
    WHERE approvalStatus = 0`;

export const recentCollections = `
    SELECT COUNT(*) AS recent_collections 
    FROM test_ascension
    WHERE collectionEndDate >= NOW() - INTERVAL 30 DAY`;

export const averageTimeToCollection = `
    SELECT AVG(TIMESTAMPDIFF(MINUTE, collectionStartDate, collectionEndDate)) AS avg_time_to_collection 
    FROM test_ascension`;

export const totalProcessedByMonth = `
    SELECT MONTH(processingEndDate) AS month, COUNT(*) AS total_processed 
    FROM test_ascension
    GROUP BY month`;

export const testsWithDeclineMessages = `
    SELECT COUNT(*) AS tests_with_decline 
    FROM samplestatus
    WHERE rejectionmessage IS NOT NULL`;



export const testsByCollectionStatus = `
SELECT
    CASE
        WHEN collectionStartDate IS NULL AND collectionEndDate IS NULL THEN 'Uninitiated'
        WHEN collectionStartDate IS NOT NULL AND collectionEndDate IS NULL THEN 'Initiated'
        WHEN collectionEndDate IS NOT NULL THEN 'Completed'
    END AS collection_status,
    COUNT(*) AS total_tests
FROM
    test_ascension
GROUP BY
    collection_status;
`;

export const averageResultEntryTime = `
    SELECT AVG(TIMESTAMPDIFF(MINUTE, resultEntryStart, resultEntryEnd)) AS avg_result_entry_time 
    FROM test_ascension`;

export const testsByServiceType = `
    SELECT serviceid, COUNT(*) AS total_tests 
    FROM test_ascension
    GROUP BY serviceid`;

export const monthlyApprovalRate = `
 SELECT
    month,
    year,
    (SUM(CASE WHEN ss.approvalstatus = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100 AS monthly_approval_rate,
    COUNT(*) AS test_count
FROM
    test_ascension AS ta
INNER JOIN
    samplestatus AS ss
ON
    ss.ascensionid = ta.id
WHERE
    year = ?
GROUP BY
    month, year;
`;

export const testsNotProcessed = `
    SELECT COUNT(*) AS unprocessed_tests 
    FROM test_ascension
    WHERE processingEndDate IS NULL`;

export const testsCompletedVsInitiatedVrsUninitiated = ` 
SELECT
        COUNT(CASE WHEN collectionStartDate IS NOT NULL AND collectionEndDate IS NOT NULL THEN 1 END) AS completed_tests,
        COUNT(CASE WHEN collectionStartDate IS NOT NULL AND collectionEndDate IS NULL THEN 0 END) AS initiated_tests,
        COUNT(CASE WHEN collectionStartDate IS  NULL AND collectionEndDate IS NULL THEN 1 END) AS uninitiated
FROM test_ascension
`;

export const collectionToProcessingTime = `
    SELECT AVG(TIMESTAMPDIFF(MINUTE, collectionStartDate, processingStartDate)) AS avg_collection_to_processing_time 
    FROM test_ascension`;

export const testsByScientistApprovalRates = `
    SELECT
    ta.sampleCollectedBy,
    rr.username,
    (SUM(ss.approvalStatus = 1) / COUNT(*)) * 100 AS approval_rate
FROM
    test_ascension AS ta
INNER JOIN
    samplestatus AS ss ON ss.ascensionid = ta.id
INNER JOIN
    roles AS rr ON rr.employeeid = ta.sampleCollectedBy
GROUP BY
    ta.sampleCollectedBy
`;

export const testTrendsOverTime = `
    SELECT DATE(ascension_date) AS date, COUNT(*) AS total_tests 
    FROM test_ascension
    GROUP BY date`;

export const testsWithoutActionPlans = `
    SELECT COUNT(*) AS tests_without_action_plan 
    FROM samplestatus
    WHERE resolution IS NULL AND approvalstatus = 0`;

export const comparisonOfCollectionStartDates = `
    SELECT collectionStartDate, COUNT(*) AS total_tests 
    FROM test_ascension
    GROUP BY collectionStartDate`;

export const totalTestsByDeclineReason = `
    SELECT rejectionmessage, COUNT(*) AS total_tests 
    FROM samplestatus
    WHERE rejectionmessage IS NOT NULL 
    GROUP BY rejectionmessage`;

export const averageTimeBetweenCollectionAndProcessing = `
    SELECT AVG(TIMESTAMPDIFF(MINUTE, collectionEndDate, processingStartDate)) AS avg_collection_to_processing_time 
    FROM test_ascension`;

export const averageTimeBetweenCollectionStartDateAndCollectionEndDate = `
    SELECT AVG(TIMESTAMPDIFF(MINUTE, collectionStartDate, collectionEndDate)) AS avg_collectionStart_to_collectionTime 
    FROM test_ascension`;
export const minMaxAvgTimeBetweenCollectionStartAndEnd = `
SELECT
    AVG(TIMESTAMPDIFF(SECOND, collectionStartDate, collectionEndDate)) AS average_time_seconds,
    MAX(TIMESTAMPDIFF(SECOND, collectionStartDate, collectionEndDate)) AS max_time_seconds,
    MIN(TIMESTAMPDIFF(SECOND, collectionStartDate, collectionEndDate)) AS min_time_seconds,
    AVG(TIMESTAMPDIFF(MINUTE, collectionStartDate, collectionEndDate)) AS average_time_minutes,
    MAX(TIMESTAMPDIFF(MINUTE, collectionStartDate, collectionEndDate)) AS max_time_minutes,
    MIN(TIMESTAMPDIFF(MINUTE, collectionStartDate, collectionEndDate)) AS min_time_minutes,
    AVG(TIMESTAMPDIFF(HOUR, collectionStartDate, collectionEndDate)) AS average_time_hours,
    MAX(TIMESTAMPDIFF(HOUR, collectionStartDate, collectionEndDate)) AS max_time_hours,
    MIN(TIMESTAMPDIFF(HOUR, collectionStartDate, collectionEndDate)) AS min_time_hours
FROM
    test_ascension;
`;




export const countOfTestsByEachScientist = `
   SELECT
    ta.sampleCollectedBy,
    rr.username,
    COUNT(ta.sampleCollectedBy) AS total_tests
FROM
    test_ascension AS ta
INNER JOIN
    roles AS rr
ON
    rr.employeeid = ta.sampleCollectedBy
GROUP BY
    ta.sampleCollectedBy;
`;



export const testsWithProcessingDelays = (expected_time: number) => `
    SELECT COUNT(*) AS delayed_processing 
    FROM test_ascension
    WHERE TIMESTAMPDIFF(MINUTE, processingStartDate, processingEndDate) > ${expected_time}`;

export const totalTestsByYear = `
    SELECT year, COUNT(*) AS total_tests 
    FROM test_ascension
    GROUP BY year`;

export const dayToDayTotalTestSampleCollectedCompletely = `
            SELECT
                DAY(ascension_date) AS day_of_month,
                COUNT(*) AS test_count
            FROM
                  test_ascension
            WHERE
                MONTH(collectionEndDate) = ?
                AND YEAR(collectionEndDate) = ?
            GROUP BY
                day_of_month
            ORDER BY
                day_of_month
`

export const yearlyTotalTestsSampleCollected = `
    SELECT
        MONTH(collectionEndDate) AS month_of_year,
        COUNT(*) AS test_count
    FROM
        test_ascension
    WHERE
        YEAR(collectionEndDate) = ?
    GROUP BY
        month_of_year
    ORDER BY
        month_of_year;
`;


export const totalTestCollectedWithApprovalRateWithRejectionAdisputedOnMonthBasis = `
SELECT
    COUNT(*) AS test_count,
    ta.month,
    ta.year,
    ta.ascension_date,
    DAY(ta.ascension_date) AS day,
    COUNT(CASE WHEN ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL THEN 1 END) AS collected_test_count,
    COUNT(CASE WHEN ss.approvalstatus = 1 THEN 1 END) AS approval_count,
    COUNT(CASE WHEN ss.approvalstatus = 0 THEN 1 END) AS rejections_sample_count,
    COUNT(CASE WHEN ss.redraw IS NOT NULL THEN 1 END) AS redrawn_sample_count,
    COUNT(CASE WHEN ss.disputedon IS NOT NULL THEN 1 END) AS disputed_cases_count,
    COUNT(CASE WHEN ss.resolution = 0 THEN 1 END) AS resolved_disputed_cases_count
FROM
    test_ascension AS ta
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
GROUP BY
    ta.month,
    ta.year,
    DAY(ta.ascension_date)
`
export const totalTestCollectedWithApprovalRateWithRejectionAdisputedOnLast31 = `SELECT 
    COUNT(*) AS test_count,
    DAY(ta.ascension_date) AS day,
    COUNT(CASE WHEN ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL THEN 1 END) AS collected_test_count,
    COUNT(CASE WHEN ss.approvalstatus = 1 THEN 1 END) AS approval_count,
    COUNT(CASE WHEN ss.approvalstatus = 0 THEN 1 END) AS rejections_sample_count,
    COUNT(CASE WHEN ss.redraw IS NOT NULL THEN 1 END) AS redrawn_sample_count,
    COUNT(CASE WHEN ss.disputedon IS NOT NULL THEN 1 END) AS disputed_cases_count,
    COUNT(CASE WHEN ss.resolution = 0 THEN 1 END) AS resolved_disputed_cases_count
FROM 
    test_ascension AS ta 
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id 
WHERE 
    ta.ascension_date >= NOW() - INTERVAL 31 DAY
GROUP BY DAY(ta.ascension_date)
`;

export const CollectionToDisputeToApprovedToRedrawnLastOfAMonth = `
SELECT
    COUNT(*) AS test_count,
    DAY(ta.ascension_date) AS day,
    ta.ascension_date,
    COUNT(CASE WHEN ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL THEN 1 END) AS collected_test_count,
    COUNT(CASE WHEN ss.approvalstatus = 1 THEN 1 END) AS approval_count,
    COUNT(CASE WHEN ss.approvalstatus = 0 THEN 1 END) AS rejections_sample_count,
    COUNT(CASE WHEN ss.redraw IS NOT NULL THEN 1 END) AS redrawn_sample_count,
    COUNT(CASE WHEN ss.disputedon IS NOT NULL THEN 1 END) AS disputed_cases_count,
    COUNT(CASE WHEN ss.resolution = 0 THEN 1 END) AS resolved_disputed_cases_count
FROM
    test_ascension AS ta
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
WHERE
    ta.month = ?
    AND ta.year = ?
GROUP BY DAY(ta.ascension_date)
`

export const getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear = `
SELECT
    COUNT(*) AS test_count,
    ta.month,
    ta.year,
    ta.ascension_date,
    DAY(ta.ascension_date) AS day,
    COUNT(CASE WHEN ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL THEN 1 END) AS collected_test_count,
    COUNT(CASE WHEN ss.approvalstatus = 1 THEN 1 END) AS approval_count,
    COUNT(CASE WHEN ss.approvalstatus = 0 THEN 1 END) AS rejections_sample_count,
    COUNT(CASE WHEN ss.redraw IS NOT NULL THEN 1 END) AS redrawn_sample_count,
    COUNT(CASE WHEN ss.disputedon IS NOT NULL THEN 1 END) AS disputed_cases_count,
    COUNT(CASE WHEN ss.resolution = 0 THEN 1 END) AS resolved_disputed_cases_count
FROM
    test_ascension AS ta
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
    WHERE ta.year = ?
GROUP BY
    ta.month,
    ta.year,
    DAY(ta.ascension_date)
`


export const dailyTotalTestsSampleCollectedByMonth = `
    SELECT
        MONTH(collectionEndDate) AS month_of_year,
        DAY(collectionEndDate) AS day_of_month,
        COUNT(*) AS test_count
    FROM
        test_ascension
    WHERE
        collection = 0 AND 
        YEAR(collectionEndDate) = ?
    GROUP BY
        month_of_year, day_of_month
    ORDER BY
        month_of_year, day_of_month;
`;

export const totalSamplePendingCollection = `
SELECT COUNT(*) FROM test_ascension WHERE collectionStartDate IS NULL OR collectionEndDate IS NULL
`;

export const totalSamplePendingCollectionWithDateIn24Hours = `SELECT COUNT(*) AS pending FROM test_ascension  AS ta
INNER JOIN dboservices AS ds ON ds.serviceid = ta.serviceid 
INNER JOIN test_panels AS tp ON tp.id = ta.testid
LEFT JOIN departments AS d ON d.id = tp.category
WHERE d.department <> 'Ultrasound' AND (collectionStartDate IS NULL OR collectionEndDate IS NULL) AND TIMESTAMPDIFF(HOUR,ds.serviceAddedOn,CURRENT_DATE) <= 24`;

// Represent some of the analytics the phelobotomist would have access to.

export const testsCompletedIn24Hours = `
    SELECT COUNT(*) AS tests_completed_in_24h 
    FROM test_ascension
    WHERE TIMESTAMPDIFF(HOUR, collectionStartDate, processingEndDate) <= 24`;

export const testsRedrawOrdersIn24Hours = `
    SELECT COUNT(*) AS redraw_orders_in_24h 
    FROM samplestatus AS ss INNER JOIN test_ascension AS ta
    ON ss.ascensionid = ta.id 
    WHERE TIMESTAMPDIFF(HOUR, ta.collectionStartDate, CURRENT_DATE) <= 24 AND ss.isRedraw = 1 AND ss.redrawOrderDate IS NOT NULL`;


export const testsRedrawOrdersCompletedIn24Hours = `
 SELECT COUNT(*) AS redraw_orders_completed_in_24h 
    FROM samplestatus AS ss INNER JOIN test_ascension AS ta
    ON ss.ascensionid = ta.id 
    WHERE TIMESTAMPDIFF(HOUR, ta.collectionStartDate, CURRENT_DATE) <= 24 AND ss.isRedraw = 1 AND ss.redraw = 1 AND ss.redrawOrderDate IS NOT NULL`;

export const testsRejectedIn24Hours = `
    SELECT COUNT(*) AS tests_rejected_in_24h 
      FROM samplestatus AS ss INNER JOIN test_ascension AS ta
    ON ss.ascensionid = ta.id
    INNER JOIN dboservices AS ds ON ds.serviceid = ta.serviceid
    WHERE TIMESTAMPDIFF(HOUR,ds.serviceAddedOn, CURRENT_DATE) <= 24 AND ss.approvalstatus = 0`;


export const q_get_AscensionEditCount: string = `SELECT counter FROM dbogeneraltesteditcount WHERE billingid = ? AND ascensionid  = ?`;
