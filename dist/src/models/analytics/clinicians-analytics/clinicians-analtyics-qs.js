"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_get_clinicians_commission_by_date = exports.q_get_clinician_commission = exports.q_can_overallChange = exports.q_can_caseSummaryDaily = exports.q_can_topOutsourcedTests = exports.q_can_monthlyTestBreakdown = exports.q_can_yearlyGrowthStats = exports.q_can_casesByOutsourced = exports.q_can_casesByShift = exports.q_can_paymentTypeSummary = exports.q_can_clinicianRevenueVsTotal = exports.q_can_casesByDayOfWeek = exports.q_can_yearlyCaseComparison = exports.q_can_yearlyCaseChange = exports.q_can_monthlyCaseChange = exports.q_can_dailyCaseChange = exports.q_can_caseSummaryDailyAll = exports.q_can_caseSummaryDailyRecent = exports.q_can_caseSummaryYearly = exports.q_can_caseSummaryMonthly = exports.q_can_caseSummaryOverall = exports.q_can_yearlyTotals = exports.q_can_monthlyTotals = exports.q_can_overallTotals = void 0;
exports.q_can_overallTotals = `
SELECT COUNT(*) AS total_rows, SUM(cost) AS total_cost, SUM(totalpayable)AS payable, SUM(amountIncurredDueTax) AS amountIncurredDueTax
FROM \`dboservices\` AS RF
WHERE clinicianId = ?;
`;
exports.q_can_monthlyTotals = `
SELECT 
    MONTH(serviceAddedOn) AS month, 
    COUNT(*) AS total_rows, 
    SUM(cost) AS total_cost, 
    SUM(totalpayable) AS total_payable, 
    SUM(amountIncurredDueTax) AS total_tax 
FROM \`dboservices\` AS RF 
WHERE clinicianId = ? 
AND YEAR(serviceAddedOn) = ?
GROUP BY MONTH(serviceAddedOn)
ORDER BY MONTH(serviceAddedOn);
`;
exports.q_can_yearlyTotals = `
SELECT 
    YEAR(serviceAddedOn) AS year, 
    COUNT(*) AS total_rows, 
    SUM(cost) AS total_cost, 
    SUM(totalpayable) AS total_payable, 
    SUM(amountIncurredDueTax) AS total_tax 
FROM \`dboservices\` AS RF 
WHERE clinicianId = ?
GROUP BY YEAR(serviceAddedOn)
ORDER BY YEAR(serviceAddedOn);
`;
exports.q_can_caseSummaryOverall = `
SELECT 
    COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS clinician_cases,
    COUNT(*) AS total_cases,
    (COUNT(CASE WHEN clinicianId = ? THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases,
    SUM(CASE WHEN clinicianId = ? THEN cost END) AS clinician_total_cost,
    SUM(CASE WHEN clinicianId = ? THEN totalpayable END) AS clinician_total_payable,
    SUM(CASE WHEN clinicianId = ? THEN amountIncurredDueTax END) AS clinician_total_tax,
    SUM(cost) AS total_cost,
    SUM(totalpayable) AS total_payable,
    SUM(amountIncurredDueTax) AS total_tax,
    (SUM(CASE WHEN clinicianId = ? THEN totalpayable END) / NULLIF(SUM(totalpayable), 0)) * 100 AS percentage_revenue
FROM \`dboservices\`;
`;
exports.q_can_caseSummaryMonthly = `
    SELECT 
        DATE_FORMAT(serviceAddedOn, '%Y-%m') AS period,
        COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS total_clinician_cases,
        COUNT(*) AS clinicians_total_cases,
        SUM(totalpayable) AS clinicians_revenue_generated,
        SUM(CASE WHEN clinicianId = ? THEN totalpayable ELSE 0 END) AS clinician_revenue_generated
    FROM dboservices
    WHERE  YEAR(serviceAddedOn) = ? 
    AND serviceAddedOn IS NOT NULL AND clinicianId IS NOT NULL
    GROUP BY DATE_FORMAT(serviceAddedOn, '%Y-%m')
    ORDER BY period; 
`;
exports.q_can_caseSummaryYearly = `
SELECT 
    YEAR(createdAt) AS year,
    COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS clinician_cases,
    COUNT(*) AS total_cases,
    (COUNT(CASE WHEN clinicianId = ? THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases,
    SUM(CASE WHEN clinicianId = ? THEN cost END) AS clinician_total_cost,
    SUM(CASE WHEN clinicianId = ? THEN totalpayable END) AS clinician_total_payable,
    SUM(CASE WHEN clinicianId = ? THEN amountIncurredDueTax END) AS clinician_total_tax,
    SUM(cost) AS total_cost,
    SUM(totalpayable) AS total_payable,
    SUM(amountIncurredDueTax) AS total_tax,
    (SUM(CASE WHEN clinicianId = ? THEN totalpayable END) / NULLIF(SUM(totalpayable), 0)) * 100 AS percentage_revenue
FROM \`dboservices\`
WHERE YEAR(createdAt) = YEAR(?)
GROUP BY YEAR(createdAt);
`;
exports.q_can_caseSummaryDailyRecent = `
SELECT 
    DATE(serviceAddedOn) AS date,
    YEAR(serviceAddedOn) AS year,
    COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS clinician_cases,
    COUNT(*) AS total_cases,
    SUM(CASE WHEN (serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND clinicianId > 0)  THEN totalpayable ELSE 0 END) AS clinician_revenue_generated,
    SUM(totalpayable) AS clinicians_revenue_generated
FROM dboservices
WHERE YEAR(serviceAddedOn) = ? AND clinicianId IS NOT NULL
GROUP BY YEAR(serviceAddedOn), DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn);

`;
exports.q_can_caseSummaryDailyAll = `
SELECT 
    DATE(serviceAddedOn) AS date,
    COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS clinician_cases,
    COUNT(*) AS total_cases,
    (COUNT(CASE WHEN clinicianId = ? THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases
FROM \`dboservices\`
GROUP BY DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn);
`;
exports.q_can_dailyCaseChange = `

WITH DailyCases AS (
    SELECT 
        DATE(serviceAddedOn) AS date,
        COUNT(CASE WHEN serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND clinicianId > 0 THEN 1 END) AS clinician_cases,
        SUM(CASE WHEN clinicianId = ? THEN totalpayable ELSE 0 END) AS clinician_revenue_generated,
        SUM(CASE WHEN serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND clinicianId > 0 THEN totalpayable ELSE 0 END) AS clinicians_revenue_generated
    FROM dboservices
    GROUP BY DATE(serviceAddedOn)
),
DailyChange AS (
    SELECT 
        date,
        clinician_cases,
        clinician_revenue_generated,
        clinicians_revenue_generated,
        LAG(clinician_cases) OVER (ORDER BY date) AS previous_day_cases,
        LAG(clinician_revenue_generated) OVER (ORDER BY date) AS previous_day_revenue,
        ((clinician_cases - LAG(clinician_cases) OVER (ORDER BY date)) / NULLIF(LAG(clinician_cases) OVER (ORDER BY date), 0)) * 100 AS percentage_change,
        ((clinician_revenue_generated - LAG(clinician_revenue_generated) OVER (ORDER BY date)) / NULLIF(LAG(clinician_revenue_generated) OVER (ORDER BY date), 0)) * 100 AS percentage_revenue_change
    FROM DailyCases
)
SELECT 
    date, 
    clinician_cases, 
    clinician_revenue_generated,
    clinicians_revenue_generated,
    previous_day_cases, 
    previous_day_revenue,
    COALESCE(percentage_change, 0) AS percentage_change,
    COALESCE(percentage_revenue_change, 0) AS percentage_revenue_change
FROM DailyChange
ORDER BY date


`;
exports.q_can_monthlyCaseChange = `
WITH MonthlyCases AS(
    SELECT 
        YEAR(serviceAddedOn) AS year,
    MONTH(serviceAddedOn) AS month,
    COUNT(*) AS clinician_cases,
    SUM(CASE WHEN clinicianId = ? THEN totalpayable ELSE 0 END) AS clinician_revenue_generated
    FROM dboservices
    GROUP BY YEAR(serviceAddedOn), MONTH(serviceAddedOn)
),
    MonthlyChange AS(
        SELECT 
        year,
        month,
        clinician_cases,
        clinician_revenue_generated,
        LAG(clinician_cases) OVER(ORDER BY year, month) AS previous_month_cases,
        LAG(clinician_revenue_generated) OVER(ORDER BY year, month) AS previous_month_revenue,
        ((clinician_cases - LAG(clinician_cases) OVER(ORDER BY year, month)) / NULLIF(LAG(clinician_cases) OVER(ORDER BY year, month), 0)) * 100 AS percentage_change,
            ((clinician_revenue_generated - LAG(clinician_revenue_generated) OVER(ORDER BY year, month)) / NULLIF(LAG(clinician_revenue_generated) OVER (ORDER BY year, month), 0)) * 100 AS percentage_revenue_change
    FROM MonthlyCases
)
SELECT
year,
    month,
    clinician_cases,
    clinician_revenue_generated,
    previous_month_cases,
    previous_month_revenue,
    COALESCE(percentage_change, 0) AS percentage_change,
        COALESCE(percentage_revenue_change, 0) AS percentage_revenue_change
FROM MonthlyChange
ORDER BY year, month;
`;
exports.q_can_yearlyCaseChange = `
WITH YearlyCases AS(
    SELECT 
        YEAR(serviceAddedOn) AS year,
    COUNT(*) AS clinician_cases
    FROM dboservices
    WHERE clinicianId = ?
    GROUP BY YEAR(serviceAddedOn)
),
    YearlyChange AS(
        SELECT 
        year,
        clinician_cases,
        LAG(clinician_cases) OVER(ORDER BY year) AS previous_year_cases,
        ((clinician_cases - LAG(clinician_cases) OVER(ORDER BY year)) /
        NULLIF(LAG(clinician_cases) OVER(ORDER BY year), 0) ) * 100 AS percentage_change
    FROM YearlyCases
)
SELECT
year,
    clinician_cases,
    previous_year_cases,
    COALESCE(percentage_change, 0) AS percentage_change
FROM YearlyChange
ORDER BY year;
`;
exports.q_can_yearlyCaseComparison = `
WITH YearlyCases AS(
    SELECT 
        YEAR(serviceAddedOn) AS year,
    COUNT(*) AS clinician_cases
    FROM \`dboservices\`
    WHERE clinicianId = ?
    GROUP BY YEAR(serviceAddedOn)
),
YearlyComparison AS (
    SELECT 
        yc1.year AS current_year,
        yc1.clinician_cases AS current_year_cases,
        yc2.year AS previous_year,
        yc2.clinician_cases AS previous_year_cases,
        CASE 
            WHEN yc2.clinician_cases IS NULL THEN 0 
            ELSE ((yc1.clinician_cases - yc2.clinician_cases) / yc2.clinician_cases) * 100 
        END AS percentage_change
    FROM YearlyCases yc1
    LEFT JOIN YearlyCases yc2 
    ON yc1.year = yc2.year + 1
)
SELECT 
    current_year, 
    current_year_cases, 
    previous_year, 
    previous_year_cases, 
    percentage_change
FROM YearlyComparison
ORDER BY current_year DESC;
`;
exports.q_can_casesByDayOfWeek = `
SELECT 
    DAYNAME(serviceAddedOn) AS day_of_week,
    COUNT(*) AS total_cases,
    ROUND(AVG(COUNT(*)) OVER(), 2) AS avg_cases_per_day
FROM dboservices
WHERE clinicianId = ?
GROUP BY DAYNAME(serviceAddedOn)
ORDER BY FIELD(DAYNAME(serviceAddedOn), 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
`;
exports.q_can_clinicianRevenueVsTotal = `
WITH ClinicianRevenue AS (
    SELECT 
        clinicianId,
        SUM(totalpayable) AS clinician_revenue
    FROM dboservices
    WHERE clinicianId = ?
    GROUP BY clinicianId
),
TotalRevenue AS (
    SELECT SUM(totalpayable) AS hospital_total_revenue FROM dboservices
)
SELECT 
    cr.clinicianId,
    cr.clinician_revenue,
    tr.hospital_total_revenue,
    ROUND((cr.clinician_revenue / tr.hospital_total_revenue) * 100, 2) AS revenue_percentage
FROM ClinicianRevenue cr
CROSS JOIN TotalRevenue tr;
`;
exports.q_can_paymentTypeSummary = `
SELECT 
    CASE 
        WHEN isNHIS = 1 OR isPHIS = 1 THEN 'Insurance'
        ELSE 'Out-of-Pocket'
    END AS payment_type,
    COUNT(*) AS total_cases,
    SUM(totalpayable) AS total_revenue
FROM dboservices
WHERE clinicianId = ?
GROUP BY payment_type;
`;
exports.q_can_casesByShift = `
SELECT 
    CASE 
        WHEN HOUR(serviceAddedOn) BETWEEN 20 AND 23 OR HOUR(serviceAddedOn) BETWEEN 0 AND 6 THEN 'Night Shift'
        ELSE 'Day Shift'
    END AS shift_type,
    COUNT(*) AS total_cases
FROM dboservices
WHERE clinicianId = ?
GROUP BY shift_type;
`;
exports.q_can_casesByOutsourced = `
SELECT 
    isoutsourced, 
    COUNT(*) AS total_cases,
    SUM(totalpayable) AS total_revenue
FROM dboservices
WHERE clinicianId = ?
GROUP BY isoutsourced;
`;
exports.q_can_yearlyGrowthStats = `
WITH YearlyStats AS (
    SELECT 
        YEAR(serviceAddedOn) AS year,
        COUNT(*) AS total_cases,
        SUM(totalpayable) AS total_revenue
    FROM dboservices
    WHERE clinicianId = ?
    GROUP BY YEAR(serviceAddedOn)
)
SELECT 
    year,
    total_cases,
    LAG(total_cases) OVER (ORDER BY year) AS previous_year_cases,
    ROUND((total_cases - LAG(total_cases) OVER (ORDER BY year)) / NULLIF(LAG(total_cases) OVER (ORDER BY year), 0) * 100, 2) AS case_growth_percentage,
    total_revenue,
    LAG(total_revenue) OVER (ORDER BY year) AS previous_year_revenue,
    ROUND((total_revenue - LAG(total_revenue) OVER (ORDER BY year)) / NULLIF(LAG(total_revenue) OVER (ORDER BY year), 0) * 100, 2) AS revenue_growth_percentage
FROM YearlyStats;
`;
exports.q_can_monthlyTestBreakdown = `
SELECT 
    tp.name AS test_name, 
    tp.id AS testid,
    YEAR(ss.serviceAddedOn) AS year,
    MONTH(ss.serviceAddedOn) AS month,
    COUNT(DISTINCT ss.trackId) AS total_tests,
    SUM(ss.cost) AS total_cost,
    SUM(ss.totalpayable) AS total_payable,
    SUM(ss.amountIncurredDueTax) AS total_tax,
    SUM(ss.discount) AS total_discount,
    COUNT(CASE WHEN ss.hasNightAdjustment = 1 THEN 1 END) as night_adjustments_count,
    SUM(CASE WHEN ss.hasNightAdjustment = 1 THEN ss.nightAdjustmentValue ELSE 0 END) as total_night_adjustment
FROM dboservices AS ss 
INNER JOIN test_panels AS tp ON tp.id = ss.trackId
WHERE ss.clinicianId = ?
GROUP BY tp.name, tp.id, YEAR(ss.serviceAddedOn), MONTH(ss.serviceAddedOn)
ORDER BY year DESC, month DESC;
`;
exports.q_can_topOutsourcedTests = `
SELECT 
    tp.name AS test_name, 
    ss.trackId, 
    COUNT(*) AS outsourced_test_count
FROM dboservices AS ss
INNER JOIN test_panels AS tp ON tp.id = ss.trackId
WHERE ss.clinicianId = ? AND ss.isoutsourced = 1
GROUP BY tp.name, ss.trackId
ORDER BY outsourced_test_count DESC
LIMIT 5;
`;
exports.q_can_caseSummaryDaily = `
SELECT 
    DATE(createdAt) AS date,
    COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS clinician_cases,
    COUNT(*) AS total_cases,
    (COUNT(CASE WHEN clinicianId = ? THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases,
    SUM(CASE WHEN clinicianId = ? THEN cost END) AS clinician_total_cost,
    SUM(CASE WHEN clinicianId = ? THEN totalpayable END) AS clinician_total_payable,
    SUM(CASE WHEN clinicianId = ? THEN amountIncurredDueTax END) AS clinician_total_tax,
    SUM(cost) AS total_cost,
    SUM(totalpayable) AS total_payable,
    SUM(amountIncurredDueTax) AS total_tax,
    (SUM(CASE WHEN clinicianId = ? THEN totalpayable END) / NULLIF(SUM(totalpayable), 0)) * 100 AS percentage_revenue
FROM \`dboservices\`
WHERE DATE(createdAt) = DATE(?)
GROUP BY DATE(createdAt);
`;
exports.q_can_overallChange = `
WITH previous AS (
    SELECT 
        COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS prev_clinician_cases,
        COUNT(*) AS prev_total_cases,
        SUM(CASE WHEN clinicianId = ? THEN cost END) AS prev_clinician_cost,
        SUM(CASE WHEN clinicianId = ? THEN totalpayable END) AS prev_clinician_payable,
        SUM(CASE WHEN clinicianId = ? THEN amountIncurredDueTax END) AS prev_clinician_tax,
        SUM(cost) AS prev_total_cost,
        SUM(totalpayable) AS prev_total_payable,
        SUM(amountIncurredDueTax) AS prev_total_tax
    FROM \`dboservices\`
    WHERE createdAt < ?
),
current AS (
    SELECT 
        COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS curr_clinician_cases,
        COUNT(*) AS curr_total_cases,
        SUM(CASE WHEN clinicianId = ? THEN cost END) AS curr_clinician_cost,
        SUM(CASE WHEN clinicianId = ? THEN totalpayable END) AS curr_clinician_payable,
        SUM(CASE WHEN clinicianId = ? THEN amountIncurredDueTax END) AS curr_clinician_tax,
        SUM(cost) AS curr_total_cost,
        SUM(totalpayable) AS curr_total_payable,
        SUM(amountIncurredDueTax) AS curr_total_tax
    FROM \`dboservices\`
    WHERE createdAt >= ?
)
SELECT 
    curr_clinician_cases - prev_clinician_cases AS clinician_cases_change,
    curr_total_cases - prev_total_cases AS total_cases_change,
    curr_clinician_cost - prev_clinician_cost AS clinician_cost_change,
    curr_clinician_payable - prev_clinician_payable AS clinician_payable_change,
    curr_clinician_tax - prev_clinician_tax AS clinician_tax_change,
    curr_total_cost - prev_total_cost AS total_cost_change,
    curr_total_payable - prev_total_payable AS total_payable_change,
    curr_total_tax - prev_total_tax AS total_tax_change,
    CASE 
        WHEN prev_clinician_cases = 0 THEN 100
        ELSE ((curr_clinician_cases - prev_clinician_cases) / prev_clinician_cases) * 100 
    END AS clinician_cases_change_percentage,
    CASE 
        WHEN prev_total_cases = 0 THEN 100
        ELSE ((curr_total_cases - prev_total_cases) / prev_total_cases) * 100 
    END AS total_cases_change_percentage,
    CASE 
        WHEN prev_clinician_payable = 0 THEN 100
        ELSE ((curr_clinician_payable - prev_clinician_payable) / prev_clinician_payable) * 100 
    END AS clinician_revenue_change_percentage
FROM previous, current;
`;
exports.q_get_clinician_commission = `
CALL cl_get_single_clinician_commission(?, ?, ?)`;
exports.q_get_clinicians_commission_by_date = `
CALL cl_get_clinician_commission(?, ?)`;
