"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutsourcingAnalyticsWithDate = exports.OutsourcingAnalytics = void 0;
const outsourcing_constraints = `AND (d.isoutsourced = 1 AND d.status = 'active' AND d.isRefunded = 0) `;
class OutsourcingAnalytics {
}
exports.OutsourcingAnalytics = OutsourcingAnalytics;
// Current year outsourcing analytics (following BillingAnalytics pattern)
OutsourcingAnalytics.dailyOutsourcedAmountLast30Days = `
        SELECT
            DATE(d.serviceAddedOn) AS service_date,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS daily_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY service_date
        ORDER BY service_date DESC, daily_amount DESC;
    `;
OutsourcingAnalytics.monthlyOutsourcedAmountLast12Months = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            COUNT(*) AS total_services,
            ROUND(SUM(d.totalpayable), 2) AS monthly_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month
        ORDER BY month DESC, monthly_amount DESC;
    `;
OutsourcingAnalytics.yearlySummaryByFacility = `
        SELECT
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS total_services,
            ROUND(SUM(d.totalpayable), 2) AS yearly_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY year
        ORDER BY year DESC, yearly_amount DESC;
    `;
OutsourcingAnalytics.top20OutsourcedFacilities = `
        SELECT
            d.outsourceid,
            o.name AS facility_name,
            o.organizationType,
            o.contactPerson,
            o.contactNumber,
            COUNT(*) AS total_services,
            ROUND(SUM(d.totalpayable), 2) AS total_amount_outsourced,
            ROUND(AVG(d.totalpayable), 2) AS avg_per_service
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY d.outsourceid, o.name, o.organizationType, o.contactPerson, o.contactNumber
        ORDER BY total_amount_outsourced DESC
        LIMIT 20;
    `;
OutsourcingAnalytics.hourlyOutsourcingPattern = `
        SELECT
            HOUR(d.serviceAddedOn) AS hour_of_day,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS total_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) = ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY hour_of_day
        ORDER BY hour_of_day;
    `;
OutsourcingAnalytics.topFacilityPerMonth = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            o.name AS facility_name,
            ROUND(SUM(d.totalpayable), 2) AS monthly_amount
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month, d.outsourceid, o.name
        ORDER BY month DESC, monthly_amount DESC;
    `;
OutsourcingAnalytics.grandSummaryDashboard = `
        SELECT
            COUNT(*) AS total_outsourced_services,
            ROUND(SUM(d.totalpayable), 2) AS grand_total_outsourced,
            ROUND(AVG(d.totalpayable), 2) AS avg_service_cost,
            COUNT(DISTINCT d.outsourceid) AS total_active_facilities,
            MIN(DATE(d.serviceAddedOn)) AS first_outsourced_date,
            MAX(DATE(d.serviceAddedOn)) AS latest_outsourced_date
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?);
    `;
OutsourcingAnalytics.weeklyOutsourcedTrend = `
        SELECT
            WEEK(d.serviceAddedOn) AS week,
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS weekly_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY week, year
        ORDER BY year DESC, week DESC;
    `;
OutsourcingAnalytics.quarterlyOutsourcedTrend = `
        SELECT
            QUARTER(d.serviceAddedOn) AS quarter,
            YEAR(d.serviceAddedOn) AS year,
            CONCAT('Q', QUARTER(d.serviceAddedOn), ' ', YEAR(d.serviceAddedOn)) AS quarter_label,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS quarterly_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY quarter, year
        ORDER BY year DESC, quarter DESC;
    `;
// Date-range based outsourcing analytics queries
class OutsourcingAnalyticsWithDate {
}
exports.OutsourcingAnalyticsWithDate = OutsourcingAnalyticsWithDate;
// Daily Outsourced Amount with Date Range
OutsourcingAnalyticsWithDate.dailyOutsourcedAmount = `
        SELECT
            DATE(d.serviceAddedOn) AS service_date,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS daily_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY service_date
        ORDER BY service_date DESC, daily_amount DESC;
    `;
// Monthly Outsourced Amount with Date Range
OutsourcingAnalyticsWithDate.monthlyOutsourcedAmount = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            COUNT(*) AS total_services,
            ROUND(SUM(d.totalpayable), 2) AS monthly_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month
        ORDER BY month DESC, monthly_amount DESC;
    `;
// Yearly Summary by Facility with Date Range
OutsourcingAnalyticsWithDate.yearlySummaryByFacility = `
        SELECT
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS total_services,
            ROUND(SUM(d.totalpayable), 2) AS yearly_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY year
        ORDER BY year DESC, yearly_amount DESC;
    `;
// Top Facilities within Date Range
OutsourcingAnalyticsWithDate.topFacilitiesByAmount = `
        SELECT
            d.outsourceid,
            o.name AS facility_name,
            o.organizationType,
            o.contactPerson,
            o.contactNumber,
            COUNT(*) AS total_services,
            ROUND(SUM(d.totalpayable), 2) AS total_amount_outsourced,
            ROUND(AVG(d.totalpayable), 2) AS avg_per_service
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY d.outsourceid, o.name, o.organizationType, o.contactPerson, o.contactNumber
        ORDER BY total_amount_outsourced DESC
        LIMIT 20;
    `;
// Hourly Pattern for Specific Date
OutsourcingAnalyticsWithDate.hourlyOutsourcingPattern = `
        SELECT
            HOUR(d.serviceAddedOn) AS hour_of_day,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS total_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) = ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY hour_of_day
        ORDER BY hour_of_day;
    `;
// Most Outsourced Facility Per Month within Date Range
OutsourcingAnalyticsWithDate.topFacilityPerMonth = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            o.name AS facility_name,
            ROUND(SUM(d.totalpayable), 2) AS monthly_amount
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month, d.outsourceid, o.name
        ORDER BY month DESC, monthly_amount DESC;
    `;
// Summary Dashboard within Date Range
OutsourcingAnalyticsWithDate.summaryDashboard = `
        SELECT
            COUNT(*) AS total_outsourced_services,
            ROUND(SUM(d.totalpayable), 2) AS total_outsourced_amount,
            ROUND(AVG(d.totalpayable), 2) AS avg_service_cost,
            COUNT(DISTINCT d.outsourceid) AS active_facilities,
            MIN(DATE(d.serviceAddedOn)) AS period_start,
            MAX(DATE(d.serviceAddedOn)) AS period_end
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?);
    `;
// Weekly Outsourced Trend with Date Range
OutsourcingAnalyticsWithDate.weeklyOutsourcedTrend = `
        SELECT
            WEEK(d.serviceAddedOn) AS week,
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS weekly_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY week, year
        ORDER BY year DESC, week DESC;
    `;
// Quarterly Outsourced Trend with Date Range
OutsourcingAnalyticsWithDate.quarterlyOutsourcedTrend = `
        SELECT
            QUARTER(d.serviceAddedOn) AS quarter,
            YEAR(d.serviceAddedOn) AS year,
            CONCAT('Q', QUARTER(d.serviceAddedOn), ' ', YEAR(d.serviceAddedOn)) AS quarter_label,
            COUNT(*) AS services_count,
            ROUND(SUM(d.totalpayable), 2) AS quarterly_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY quarter, year
        ORDER BY year DESC, quarter DESC;
    `;
// Optional View Creation Query (Run this once in database)
/*
CREATE OR REPLACE VIEW vw_outsourced_analytics_daily AS
SELECT
    DATE(d.serviceAddedOn) AS service_date,
    o.name AS facility,
    o.organizationType,
    COUNT(*) AS services,
    ROUND(SUM(d.totalpayable), 2) AS amount
FROM dboservices d
JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
WHERE d.isoutsourced = 1 AND d.status = 'active'
GROUP BY service_date, o.outsourceid;
*/ 
