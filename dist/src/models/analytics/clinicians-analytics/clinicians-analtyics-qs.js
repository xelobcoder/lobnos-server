"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_get_clinicians_commission_by_date = exports.q_get_clinician_commission = exports.q_can_overallChange = exports.q_can_caseSummaryDaily = exports.q_can_topOutsourcedTests = exports.q_can_monthlyTestBreakdown = exports.q_can_yearlyGrowthStats = exports.q_can_casesByOutsourced = exports.q_can_casesByShift = exports.q_can_paymentTypeSummary = exports.q_can_clinicianRevenueVsTotal = exports.q_can_casesByDayOfWeek = exports.q_can_yearlyCaseComparison = exports.q_can_yearlyCaseChange = exports.q_can_monthlyCaseChange = exports.q_can_dailyCaseChange = exports.q_can_caseSummaryDailyAll = exports.q_can_caseSummaryDailyRecent = exports.q_can_caseSummaryYearly = exports.q_can_caseSummaryMonthly = exports.q_can_yearlyTotals = exports.q_can_monthlyTotals = exports.q_can_overallTotals = void 0;
const constraints = ` (dboservices.status='active' AND dboservices.isRefunded = 0 AND dboservices.clinicianId IS NOT NULL AND dboservices.serviceCategory='CLINICIAN_SPECIAL_BILLING' AND dboservices.categoryTrackId= 6 AND ( dboservices.paymentstatus ='partial' OR dboservices.paymentstatus = 'paid') )`;
exports.q_can_overallTotals = `
SELECT COUNT(*) AS total_rows, SUM(cost) AS total_cost, SUM(totalpayable)AS payable, SUM(amountIncurredDueTax) AS amountIncurredDueTax
FROM \`dboservices\` AS RF
WHERE clinicianId = ? AND ${constraints}
`;
exports.q_can_monthlyTotals = `
SELECT 
    MONTH(dboservices.serviceAddedOn) AS month, 
    COUNT(*) AS total_rows, 
    SUM(dboservices.cost) AS total_cost, 
    SUM(dboservices.totalpayable) AS total_payable, 
    SUM(dboservices.amountIncurredDueTax) AS total_tax 
FROM \`dboservices\` 
WHERE dboservices.clinicianId = ? AND ${constraints}
AND YEAR(dboservices.serviceAddedOn) = ?
GROUP BY MONTH(dboservices.serviceAddedOn)
ORDER BY MONTH(dboservices.serviceAddedOn);
`;
exports.q_can_yearlyTotals = `
SELECT 
    YEAR(dboservices.serviceAddedOn) AS year, 
    COUNT(*) AS total_rows, 
    SUM(dboservices.cost) AS total_cost, 
    SUM(dboservices.totalpayable) AS total_payable, 
    SUM(dboservices.amountIncurredDueTax) AS total_tax 
FROM \`dboservices\`
WHERE dboservices.clinicianId = ? AND ${constraints}
GROUP BY YEAR(dboservices.serviceAddedOn)
ORDER BY YEAR(dboservices.serviceAddedOn) DESC;
`;
exports.q_can_caseSummaryMonthly = `
    SELECT 
        DATE_FORMAT(serviceAddedOn, '%Y-%m') AS period,
        COUNT(CASE WHEN clinicianId = ? THEN 1 END) AS total_clinician_cases,
        COUNT(*) AS clinicians_total_cases,
        SUM(totalpayable) AS clinicians_revenue_generated,
        SUM(CASE WHEN clinicianId = ? THEN totalpayable ELSE 0 END) AS clinician_revenue_generated
    FROM dboservices
    WHERE  YEAR(serviceAddedOn) = ? AND ${constraints}
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
WHERE YEAR(createdAt) = YEAR(?) AND ${constraints}
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
        DATE(dboservices.serviceAddedOn) AS date,
        COUNT(CASE WHEN dboservices.serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND dboservices.clinicianId > 0 THEN 1 END) AS clinician_cases,
        SUM(CASE WHEN dboservices.clinicianId = ? THEN dboservices.totalpayable ELSE 0 END) AS clinician_accrual_revenue,
        SUM(CASE WHEN dboservices.clinicianId = ? THEN dboservices.paidamount ELSE 0 END) AS clinician_actual_revenue,
        SUM(CASE WHEN dboservices.clinicianId = ? THEN (dboservices.totalpayable - dboservices.paidamount) ELSE 0 END) AS clinician_outstanding_debt,
        SUM(CASE WHEN dboservices.serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND dboservices.clinicianId > 0 THEN dboservices.totalpayable ELSE 0 END) AS clinicians_accrual_revenue,
        SUM(CASE WHEN dboservices.serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND dboservices.clinicianId > 0 THEN dboservices.paidamount ELSE 0 END) AS clinicians_actual_revenue,
        SUM(CASE WHEN dboservices.serviceCategory = 'CLINICIAN_SPECIAL_BILLING' AND dboservices.clinicianId > 0 THEN (dboservices.totalpayable - dboservices.paidamount) ELSE 0 END) AS clinicians_outstanding_debt
    FROM dboservices
    WHERE ${constraints} AND YEAR(dboservices.serviceAddedOn) = ?
    GROUP BY DATE(dboservices.serviceAddedOn)
),
DailyChange AS (
    SELECT
        date,
        clinician_cases,
        clinician_accrual_revenue,
        clinician_actual_revenue,
        clinician_outstanding_debt,
        clinicians_accrual_revenue,
        clinicians_actual_revenue,
        clinicians_outstanding_debt,
        LAG(clinician_cases) OVER (ORDER BY date) AS previous_day_cases,
        LAG(clinician_accrual_revenue) OVER (ORDER BY date) AS previous_day_accrual_revenue,
        LAG(clinician_actual_revenue) OVER (ORDER BY date) AS previous_day_actual_revenue,
        LAG(clinician_outstanding_debt) OVER (ORDER BY date) AS previous_day_outstanding_debt,
        ((clinician_cases - LAG(clinician_cases) OVER (ORDER BY date)) / NULLIF(LAG(clinician_cases) OVER (ORDER BY date), 0)) * 100 AS percentage_change,
        ((clinician_accrual_revenue - LAG(clinician_accrual_revenue) OVER (ORDER BY date)) / NULLIF(LAG(clinician_accrual_revenue) OVER (ORDER BY date), 0)) * 100 AS percentage_accrual_revenue_change,
        ((clinician_actual_revenue - LAG(clinician_actual_revenue) OVER (ORDER BY date)) / NULLIF(LAG(clinician_actual_revenue) OVER (ORDER BY date), 0)) * 100 AS percentage_actual_revenue_change,
        ((clinician_outstanding_debt - LAG(clinician_outstanding_debt) OVER (ORDER BY date)) / NULLIF(LAG(clinician_outstanding_debt) OVER (ORDER BY date), 0)) * 100 AS percentage_outstanding_debt_change
    FROM DailyCases
)
SELECT
    date,
    clinician_cases,
    clinician_accrual_revenue,
    clinician_actual_revenue,
    clinician_outstanding_debt,
    clinicians_accrual_revenue,
    clinicians_actual_revenue,
    clinicians_outstanding_debt,
    previous_day_cases,
    previous_day_accrual_revenue,
    previous_day_actual_revenue,
    previous_day_outstanding_debt,
    COALESCE(percentage_change, 0) AS percentage_change,
    COALESCE(percentage_accrual_revenue_change, 0) AS percentage_accrual_revenue_change,
    COALESCE(percentage_actual_revenue_change, 0) AS percentage_actual_revenue_change,
    COALESCE(percentage_outstanding_debt_change, 0) AS percentage_outstanding_debt_change
FROM DailyChange
ORDER BY date
`;
exports.q_can_monthlyCaseChange = `
WITH MonthlyCases AS(
    SELECT
        YEAR(serviceAddedOn) AS year,
    MONTH(serviceAddedOn) AS month,
    COUNT(*) AS clinician_cases,
    SUM(CASE WHEN clinicianId = ? THEN totalpayable ELSE 0 END) AS clinician_accrual_revenue,
    SUM(CASE WHEN clinicianId = ? THEN paidamount ELSE 0 END) AS clinician_actual_revenue,
    SUM(CASE WHEN clinicianId = ? THEN (totalpayable - paidamount) ELSE 0 END) AS clinician_outstanding_debt
    FROM dboservices
    WHERE ${constraints} AND  YEAR(serviceAddedOn) = ?
    GROUP BY YEAR(serviceAddedOn), MONTH(serviceAddedOn)
),
    MonthlyChange AS(
        SELECT
        year,
        month,
        clinician_cases,
        clinician_accrual_revenue,
        clinician_actual_revenue,
        clinician_outstanding_debt,
        LAG(clinician_cases) OVER(ORDER BY year, month) AS previous_month_cases,
        LAG(clinician_accrual_revenue) OVER(ORDER BY year, month) AS previous_month_accrual_revenue,
        LAG(clinician_actual_revenue) OVER(ORDER BY year, month) AS previous_month_actual_revenue,
        LAG(clinician_outstanding_debt) OVER(ORDER BY year, month) AS previous_month_outstanding_debt,
        ((clinician_cases - LAG(clinician_cases) OVER(ORDER BY year, month)) / NULLIF(LAG(clinician_cases) OVER(ORDER BY year, month), 0)) * 100 AS percentage_change,
        ((clinician_accrual_revenue - LAG(clinician_accrual_revenue) OVER(ORDER BY year, month)) / NULLIF(LAG(clinician_accrual_revenue) OVER(ORDER BY year, month), 0)) * 100 AS percentage_accrual_revenue_change,
        ((clinician_actual_revenue - LAG(clinician_actual_revenue) OVER(ORDER BY year, month)) / NULLIF(LAG(clinician_actual_revenue) OVER(ORDER BY year, month), 0)) * 100 AS percentage_actual_revenue_change,
        ((clinician_outstanding_debt - LAG(clinician_outstanding_debt) OVER(ORDER BY year, month)) / NULLIF(LAG(clinician_outstanding_debt) OVER(ORDER BY year, month), 0)) * 100 AS percentage_outstanding_debt_change
    FROM MonthlyCases
)
SELECT
year,
    month,
    clinician_cases,
    clinician_accrual_revenue,
    clinician_actual_revenue,
    clinician_outstanding_debt,
    previous_month_cases,
    previous_month_accrual_revenue,
    previous_month_actual_revenue,
    previous_month_outstanding_debt,
    COALESCE(percentage_change, 0) AS percentage_change,
    COALESCE(percentage_accrual_revenue_change, 0) AS percentage_accrual_revenue_change,
    COALESCE(percentage_actual_revenue_change, 0) AS percentage_actual_revenue_change,
    COALESCE(percentage_outstanding_debt_change, 0) AS percentage_outstanding_debt_change
FROM MonthlyChange
ORDER BY year, month;
`;
exports.q_can_yearlyCaseChange = `
WITH YearlyCases AS(
    SELECT
        YEAR(serviceAddedOn) AS year,
    COUNT(*) AS clinician_cases
    FROM dboservices
    WHERE clinicianId = ? AND ${constraints}
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
    WHERE clinicianId = ? AND ${constraints}
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
WHERE clinicianId = ? AND ${constraints}
GROUP BY DAYNAME(serviceAddedOn)
ORDER BY FIELD(DAYNAME(serviceAddedOn), 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
`;
exports.q_can_clinicianRevenueVsTotal = `
WITH ClinicianRevenue AS (
    SELECT
        clinicianId,
        SUM(totalpayable) AS clinician_revenue
    FROM dboservices
    WHERE clinicianId = ? AND ${constraints}
    GROUP BY clinicianId
),
TotalRevenue AS (
    SELECT SUM(totalpayable) AS hospital_total_revenue FROM dboservices WHERE ${constraints}
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
WHERE clinicianId = ? AND ${constraints}
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
WHERE clinicianId = ? AND ${constraints}
GROUP BY shift_type;
`;
exports.q_can_casesByOutsourced = `
SELECT 
    isoutsourced, 
    COUNT(*) AS total_cases,
    SUM(totalpayable) AS total_revenue
FROM dboservices
WHERE clinicianId = ? AND ${constraints}
GROUP BY isoutsourced;
`;
exports.q_can_yearlyGrowthStats = `
WITH YearlyStats AS (
    SELECT
        YEAR(serviceAddedOn) AS year,
        COUNT(*) AS total_cases,
        SUM(totalpayable) AS total_revenue
    FROM dboservices
    WHERE clinicianId = ? AND ${constraints}
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
WHERE ss.clinicianId = ? AND ${constraints}
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
    SELECT
        DATE(s.serviceAddedOn) AS service_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        s.serviceid,
        c.phone AS clinician_phone,
        c.occupation,
        c.organization,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_payable,
        SUM(s.paidamount) AS total_paid,
        COALESCE(ct.commission_due, 0) AS commission_earned
    FROM dboservices s
    INNER JOIN clinicianbasicinfo c
        ON s.clinicianId = c.id
    LEFT JOIN commission_tracking ct
        ON ct.service_id = s.serviceid AND ct.recipient_type = 'clinician' AND ct.recipient_id = c.id
    LEFT JOIN commission_batch_payment_services AS cbps
        ON cbps.serviceid = s.serviceid
    WHERE
        s.clinicianId = ?
        AND s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
        AND s.status = 'active'
        AND s.isAdjustment = 0
        AND DATE(s.serviceAddedOn) >= ?
        AND s.isRefunded=0
        AND s.paymentstatus !='pending'
        AND DATE(s.serviceAddedOn) <= ?
        AND cbps.serviceid IS NULL
    GROUP BY 
       s.serviceid
    ORDER BY 
        service_date DESC
`;
exports.q_get_clinicians_commission_by_date = `
    SELECT
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        DATE(s.serviceAddedOn) AS service_date,
        c.organization,
        COUNT(*) AS total_services,
        SUM(s.totalpayable) AS total_payable,
        SUM(s.paidamount) AS total_paid,
        SUM(COALESCE(ct.commission_due, 0)) AS commission_earned_total
    FROM dboservices s
    INNER JOIN clinicianbasicinfo c
        ON s.clinicianId = c.id
    LEFT JOIN commission_tracking ct
        ON ct.service_id = s.serviceid AND ct.recipient_type = 'clinician' AND ct.recipient_id = c.id
    LEFT JOIN commission_batch_payment_services AS cbps
        ON cbps.serviceid = s.serviceid
    WHERE
        s.serviceCategory = 'CLINICIAN_SPECIAL_BILLING'
        AND s.status = 'active'
        AND s.isRefunded=0
        AND s.paymentstatus !='pending'
        AND DATE(s.serviceAddedOn) >= ?
        AND DATE(s.serviceAddedOn) <= ?
        AND s.clinicianId IS NOT NULL
        AND cbps.serviceid IS NULL
    GROUP BY 
        c.id
    ORDER BY ?
    LIMIT ? OFFSET ?;
`;
