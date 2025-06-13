-- SELECT COUNT(*) AS total_rows, SUM(cost) AS total_cost,SUM(totalpayable),SUM(amountIncurredDueTax)
-- FROM `dboservices` AS RF
-- WHERE clinicianId = 2;




-- SELECT 
--     MONTH(serviceAddedOn) AS month, 
--     COUNT(*) AS total_rows, 
--     SUM(cost) AS total_cost, 
--     SUM(totalpayable) AS total_payable, 
--     SUM(amountIncurredDueTax) AS total_tax 
-- FROM `dboservices` AS RF 
-- WHERE clinicianId = 2 
-- AND YEAR(serviceAddedOn) = 2025
-- GROUP BY MONTH(serviceAddedOn)
-- ORDER BY MONTH(serviceAddedOn);




-- SELECT 
--     YEAR(serviceAddedOn) AS year, 
--     COUNT(*) AS total_rows, 
--     SUM(cost) AS total_cost, 
--     SUM(totalpayable) AS total_payable, 
--     SUM(amountIncurredDueTax) AS total_tax 
-- FROM `dboservices` AS RF 
-- WHERE clinicianId = 2 
-- GROUP BY YEAR(serviceAddedOn)
-- ORDER BY YEAR(serviceAddedOn);




-- SELECT 
--     COUNT(CASE WHEN clinicianId = 2 THEN 1 END) AS clinician_cases,
--     COUNT(*) AS total_cases,
--     (COUNT(CASE WHEN clinicianId = 2 THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases
-- FROM `dboservices`;



-- SELECT 
--     YEAR(serviceAddedOn) AS year,
--     MONTH(serviceAddedOn) AS month,
--     COUNT(CASE WHEN clinicianId = 2 THEN 1 END) AS clinician_cases,
--     COUNT(*) AS total_cases,
--     (COUNT(CASE WHEN clinicianId = 2 THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases
-- FROM `dboservices`
-- WHERE YEAR(serviceAddedOn) = 2025
-- GROUP BY YEAR(serviceAddedOn), MONTH(serviceAddedOn)
-- ORDER BY YEAR(serviceAddedOn), MONTH(serviceAddedOn);



-- SELECT 
--     YEAR(serviceAddedOn) AS year,
--     COUNT(CASE WHEN clinicianId = 2 THEN 1 END) AS clinician_cases,
--     COUNT(*) AS total_cases,
--     (COUNT(CASE WHEN clinicianId = 2 THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases
-- FROM `dboservices`
-- GROUP BY YEAR(serviceAddedOn)
-- ORDER BY YEAR(serviceAddedOn);




-- SELECT 
--     DATE(serviceAddedOn) AS date,
--     COUNT(CASE WHEN clinicianId = 2 THEN 1 END) AS clinician_cases,
--     COUNT(*) AS total_cases,
--     (COUNT(CASE WHEN clinicianId = 2 THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases
-- FROM `dboservices`
-- WHERE DATE(serviceAddedOn) >= CURDATE() - INTERVAL 30 DAY  -- Adjust the interval as needed
-- GROUP BY DATE(serviceAddedOn)
-- ORDER BY DATE(serviceAddedOn);



-- SELECT 
--     DATE(serviceAddedOn) AS date,
--     COUNT(CASE WHEN clinicianId = 2 THEN 1 END) AS clinician_cases,
--     COUNT(*) AS total_cases,
--     (COUNT(CASE WHEN clinicianId = 2 THEN 1 END) / COUNT(*)) * 100 AS percentage_clinician_cases
-- FROM `dboservices`
-- GROUP BY DATE(serviceAddedOn)
-- ORDER BY DATE(serviceAddedOn);




-- WITH DailyCases AS (
--     SELECT 
--         DATE(serviceAddedOn) AS date,
--         COUNT(*) AS clinician_cases
--     FROM `dboservices`
--     WHERE clinicianId = 2
--     GROUP BY DATE(serviceAddedOn)
-- ),
-- DailyChange AS (
--     SELECT 
--         date,
--         clinician_cases,
--         LAG(clinician_cases) OVER (ORDER BY date) AS previous_day_cases,
--         ( (clinician_cases - LAG(clinician_cases) OVER (ORDER BY date)) / 
--             NULLIF(LAG(clinician_cases) OVER (ORDER BY date), 0) ) * 100 AS percentage_change
--     FROM DailyCases
-- )
-- SELECT 
--     date, 
--     clinician_cases, 
--     previous_day_cases, 
--     COALESCE(percentage_change, 0) AS percentage_change
-- FROM DailyChange
-- ORDER BY date;





-- WITH MonthlyCases AS (
--     SELECT 
--         YEAR(serviceAddedOn) AS year,
--         MONTH(serviceAddedOn) AS month,
--         COUNT(*) AS clinician_cases
--     FROM `dboservices`
--     WHERE clinicianId = 2
--     GROUP BY YEAR(serviceAddedOn), MONTH(serviceAddedOn)
-- ),
-- MonthlyChange AS (
--     SELECT 
--         year,
--         month,
--         clinician_cases,
--         LAG(clinician_cases) OVER (ORDER BY year, month) AS previous_month_cases,
--         ( (clinician_cases - LAG(clinician_cases) OVER (ORDER BY year, month)) / 
--             NULLIF(LAG(clinician_cases) OVER (ORDER BY year, month), 0) ) * 100 AS percentage_change
--     FROM MonthlyCases
-- )
-- SELECT 
--     year, 
--     month, 
--     clinician_cases, 
--     previous_month_cases, 
--     COALESCE(percentage_change, 0) AS percentage_change
-- FROM MonthlyChange
-- ORDER BY year, month;





-- WITH YearlyCases AS (
--     SELECT 
--         YEAR(serviceAddedOn) AS year,
--         COUNT(*) AS clinician_cases
--     FROM `dboservices`
--     WHERE clinicianId = 2
--     GROUP BY YEAR(serviceAddedOn)
-- ),
-- YearlyChange AS (
--     SELECT 
--         year,
--         clinician_cases,
--         LAG(clinician_cases) OVER (ORDER BY year) AS previous_year_cases,
--         ( (clinician_cases - LAG(clinician_cases) OVER (ORDER BY year)) / 
--             NULLIF(LAG(clinician_cases) OVER (ORDER BY year), 0) ) * 100 AS percentage_change
--     FROM YearlyCases
-- )
-- SELECT 
--     year, 
--     clinician_cases, 
--     previous_year_cases, 
--     COALESCE(percentage_change, 0) AS percentage_change
-- FROM YearlyChange
-- ORDER BY year;



-- WITH YearlyCases AS (
--     SELECT 
--         YEAR(serviceAddedOn) AS year,
--         COUNT(*) AS clinician_cases
--     FROM `dboservices`
--     WHERE clinicianId = 2
--     GROUP BY YEAR(serviceAddedOn)
-- ),
-- YearlyComparison AS (
--     SELECT 
--         yc1.year AS current_year,
--         yc1.clinician_cases AS current_year_cases,
--         yc2.year AS previous_year,
--         yc2.clinician_cases AS previous_year_cases,
--         CASE 
--             WHEN yc2.clinician_cases IS NULL THEN 0 
--             ELSE ((yc1.clinician_cases - yc2.clinician_cases) / yc2.clinician_cases) * 100 
--         END AS percentage_change
--     FROM YearlyCases yc1
--     LEFT JOIN YearlyCases yc2 
--     ON yc1.year = yc2.year + 1
-- )
-- SELECT 
--     current_year, 
--     current_year_cases, 
--     previous_year, 
--     previous_year_cases, 
--     percentage_change
-- FROM YearlyComparison
-- ORDER BY current_year DESC;



-- SELECT 
--     DAYNAME(serviceAddedOn) AS day_of_week,
--     COUNT(*) AS total_cases,
--     ROUND(AVG(COUNT(*)) OVER(), 2) AS avg_cases_per_day
-- FROM dboservices
-- WHERE clinicianId = 2
-- GROUP BY DAYNAME(serviceAddedOn)
-- ORDER BY FIELD(DAYNAME(serviceAddedOn), 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');



-- WITH ClinicianRevenue AS (
--     SELECT 
--         clinicianId,
--         SUM(totalpayable) AS clinician_revenue
--     FROM dboservices
--     WHERE clinicianId = 2
--     GROUP BY clinicianId
-- ),
-- TotalRevenue AS (
--     SELECT SUM(totalpayable) AS hospital_total_revenue FROM dboservices
-- )
-- SELECT 
--     cr.clinicianId,
--     cr.clinician_revenue,
--     tr.hospital_total_revenue,
--     ROUND((cr.clinician_revenue / tr.hospital_total_revenue) * 100, 2) AS revenue_percentage
-- FROM ClinicianRevenue cr
-- CROSS JOIN TotalRevenue tr;



-- SELECT 
--     CASE 
--         WHEN isNHIS = 1 OR isPHIS = 1 THEN 'Insurance'
--         ELSE 'Out-of-Pocket'
--     END AS payment_type,
--     COUNT(*) AS total_cases,
--     SUM(totalpayable) AS total_revenue
-- FROM dboservices
-- WHERE clinicianId = 2
-- GROUP BY payment_type;


-- SELECT 
--     CASE 
--         WHEN HOUR(serviceAddedOn) BETWEEN 20 AND 23 OR HOUR(serviceAddedOn) BETWEEN 0 AND 6 THEN 'Night Shift'
--         ELSE 'Day Shift'
--     END AS shift_type,
--     COUNT(*) AS total_cases
-- FROM dboservices
-- WHERE clinicianId = 2
-- GROUP BY shift_type;



-- SELECT 
--     isoutsourced, 
--     COUNT(*) AS total_cases,
--     SUM(totalpayable) AS total_revenue
-- FROM dboservices
-- WHERE clinicianId = 2
-- GROUP BY isoutsourced;



-- WITH YearlyStats AS (
--     SELECT 
--         YEAR(serviceAddedOn) AS year,
--         COUNT(*) AS total_cases,
--         SUM(totalpayable) AS total_revenue
--     FROM dboservices
--     WHERE clinicianId = 2
--     GROUP BY YEAR(serviceAddedOn)
-- )
-- SELECT 
--     year,
--     total_cases,
--     LAG(total_cases) OVER (ORDER BY year) AS previous_year_cases,
--     ROUND((total_cases - LAG(total_cases) OVER (ORDER BY year)) / NULLIF(LAG(total_cases) OVER (ORDER BY year), 0) * 100, 2) AS case_growth_percentage,
--     total_revenue,
--     LAG(total_revenue) OVER (ORDER BY year) AS previous_year_revenue,
--     ROUND((total_revenue - LAG(total_revenue) OVER (ORDER BY year)) / NULLIF(LAG(total_revenue) OVER (ORDER BY year), 0) * 100, 2) AS revenue_growth_percentage
-- FROM YearlyStats;


-- SELECT 
--     tp.name AS test_name, 
--     tp.id AS testid,
--     YEAR(ss.serviceAddedOn) AS year,
--     MONTH(ss.serviceAddedOn) AS month,
--     COUNT(DISTINCT ss.trackId) AS total_tests
-- FROM dboservices AS ss 
-- INNER JOIN test_panels AS tp ON tp.id = ss.trackId
-- WHERE ss.clinicianId = 2
-- GROUP BY tp.name, tp.id, YEAR(ss.serviceAddedOn), MONTH(ss.serviceAddedOn)
-- ORDER BY year DESC, month DESC;


-- SELECT 
--     tp.name AS test_name, 
--     ss.trackId, 
--     COUNT(*) AS outsourced_test_count
-- FROM dboservices AS ss
-- INNER JOIN test_panels AS tp ON tp.id = ss.trackId
-- WHERE ss.clinicianId = 2 AND ss.isoutsourced = 1
-- GROUP BY tp.name, ss.trackId
-- ORDER BY outsourced_test_count DESC
-- LIMIT 5;
-- -- 