const outsourcing_constraints = `AND d.isoutsourced = 1 AND d.status IN ('active','refunded') `;

export class OutsourcingAnalytics {
  // Current year outsourcing analytics (following BillingAnalytics pattern)
  public static dailyOutsourcedAmountLast30Days = `
        SELECT
            DATE(d.serviceAddedOn) AS service_date,
            COUNT(*) AS services_count,
           COALESCE(SUM(d.totalpayable), 0) AS daily_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS outsourced_daily_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS daily_profit_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY service_date
        ORDER BY service_date DESC, daily_billed_amount DESC;
    `;

  public static monthlyOutsourcedAmountLast12Months = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            COUNT(*) AS total_services,
            COALESCE(SUM(d.totalpayable), 0) AS monthly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS outsourced_monthly_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS monthly_profit_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month
        ORDER BY month DESC, monthly_billed_amount DESC;
    `;

  public static yearlySummaryByFacility = `
        SELECT
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS total_services,
            COALESCE(SUM(d.totalpayable), 0) AS yearly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS outsourced_yearly_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS yearly_profit_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY year
        ORDER BY year DESC, yearly_billed_amount DESC;
    `;

  public static top20OutsourcedFacilities = `
        SELECT
            d.outsourceid,
            o.name AS facility_name,
            o.organizationType,
            o.contactPerson,
            o.contactNumber,
            COUNT(*) AS total_services,
            COALESCE(SUM(d.totalpayable), 0) AS total_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS total_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS total_profit_amount,
            COALESCE(AVG(d.totalpayable), 0) AS avg_billed_per_service
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY d.outsourceid, o.name, o.organizationType, o.contactPerson, o.contactNumber
        ORDER BY total_billed_amount DESC
        LIMIT 20;
    `;

  public static hourlyOutsourcingPattern = `
        SELECT
            HOUR(d.serviceAddedOn) AS hour_of_day,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS total_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS total_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS total_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) = ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY hour_of_day
        ORDER BY hour_of_day;
    `;

  public static topFacilityPerMonth = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            o.name AS facility_name,
            COALESCE(SUM(d.totalpayable), 0) AS monthly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS monthly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS monthly_profit_amount
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month, d.outsourceid, o.name
        ORDER BY month DESC, monthly_billed_amount DESC;
    `;

  public static grandSummaryDashboard = `
        SELECT
            COUNT(*) AS total_outsourced_services,
            COALESCE(SUM(d.totalpayable), 0) AS grand_total_billed,
            COALESCE(SUM(d.outsourceprice), 0) AS grand_total_outsourced,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS grand_total_profit,
            COALESCE(AVG(d.totalpayable), 0) AS avg_billed_per_service,
            COUNT(DISTINCT d.outsourceid) AS total_active_facilities,
            MIN(DATE(d.serviceAddedOn)) AS first_outsourced_date,
            MAX(DATE(d.serviceAddedOn)) AS latest_outsourced_date
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?);
    `;

  public static weeklyOutsourcedTrend = `
        SELECT
            WEEK(d.serviceAddedOn) AS week,
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS weekly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS weekly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS weekly_profit_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY week, year
        ORDER BY year DESC, week DESC;
    `;

  public static quarterlyOutsourcedTrend = `
        SELECT
            QUARTER(d.serviceAddedOn) AS quarter,
            YEAR(d.serviceAddedOn) AS year,
            CONCAT('Q', QUARTER(d.serviceAddedOn), ' ', YEAR(d.serviceAddedOn)) AS quarter_label,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS quarterly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS quarterly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS quarterly_profit_amount
        FROM dboservices d
        WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY quarter, year
        ORDER BY year DESC, quarter DESC;
    `;
}

// Date-range based outsourcing analytics queries
export class OutsourcingAnalyticsWithDate {
  // Daily Outsourced Amount with Date Range
  public static dailyOutsourcedAmount = `
        SELECT
            DATE(d.serviceAddedOn) AS service_date,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS daily_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS daily_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS daily_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY service_date
        ORDER BY service_date DESC, daily_billed_amount DESC;
    `;

  // Monthly Outsourced Amount with Date Range
  public static monthlyOutsourcedAmount = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            COUNT(*) AS total_services,
            COALESCE(SUM(d.totalpayable), 0) AS monthly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS monthly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS monthly_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month
        ORDER BY month DESC, monthly_billed_amount DESC;
    `;

  // Yearly Summary by Facility with Date Range
  public static yearlySummaryByFacility = `
        SELECT
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS total_services,
            COALESCE(SUM(d.totalpayable), 0) AS yearly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS yearly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS yearly_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY year
        ORDER BY year DESC, yearly_billed_amount DESC;
    `;

  // Top Facilities within Date Range
  public static topFacilitiesByAmount = `
        SELECT
            d.outsourceid,
            o.name AS facility_name,
            o.organizationType,
            o.contactPerson,
            o.contactNumber,
            COUNT(*) AS total_services,
            COALESCE(SUM(d.totalpayable), 0) AS total_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS total_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS total_profit_amount,
            COALESCE(AVG(d.totalpayable), 0) AS avg_billed_per_service
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY d.outsourceid, o.name, o.organizationType, o.contactPerson, o.contactNumber
        ORDER BY total_billed_amount DESC
        LIMIT 20;
    `;

  // Hourly Pattern for Specific Date
  public static hourlyOutsourcingPattern = `
        SELECT
            HOUR(d.serviceAddedOn) AS hour_of_day,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS total_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS total_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS total_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) = ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY hour_of_day
        ORDER BY hour_of_day;
    `;

  // Most Outsourced Facility Per Month within Date Range
  public static topFacilityPerMonth = `
        SELECT
            DATE_FORMAT(d.serviceAddedOn, '%Y-%m') AS month,
            o.name AS facility_name,
            COALESCE(SUM(d.totalpayable), 0) AS monthly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS monthly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS monthly_profit_amount
        FROM dboservices d
        JOIN outsourcingorganization o ON d.outsourceid = o.outsourceid
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY month, d.outsourceid, o.name
        ORDER BY month DESC, monthly_billed_amount DESC;
    `;

  // Summary Dashboard within Date Range
  public static summaryDashboard = `
        SELECT
            COUNT(*) AS total_outsourced_services,
            COALESCE(SUM(d.totalpayable), 0) AS total_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS total_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS total_profit_amount,
            COALESCE(AVG(d.totalpayable), 0) AS avg_billed_per_service,
            COUNT(DISTINCT d.outsourceid) AS active_facilities,
            MIN(DATE(d.serviceAddedOn)) AS period_start,
            MAX(DATE(d.serviceAddedOn)) AS period_end
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?);
    `;

  // Weekly Outsourced Trend with Date Range
  public static weeklyOutsourcedTrend = `
        SELECT
            WEEK(d.serviceAddedOn) AS week,
            YEAR(d.serviceAddedOn) AS year,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS weekly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS weekly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS weekly_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY week, year
        ORDER BY year DESC, week DESC;
    `;

  // Quarterly Outsourced Trend with Date Range
  public static quarterlyOutsourcedTrend = `
        SELECT
            QUARTER(d.serviceAddedOn) AS quarter,
            YEAR(d.serviceAddedOn) AS year,
            CONCAT('Q', QUARTER(d.serviceAddedOn), ' ', YEAR(d.serviceAddedOn)) AS quarter_label,
            COUNT(*) AS services_count,
            COALESCE(SUM(d.totalpayable), 0) AS quarterly_billed_amount,
            COALESCE(SUM(d.outsourceprice), 0) AS quarterly_outsourced_amount,
            COALESCE(SUM(d.totalpayable), 0) - COALESCE(SUM(d.outsourceprice), 0) AS quarterly_profit_amount
        FROM dboservices d
        WHERE DATE(d.serviceAddedOn) BETWEEN ? AND ? ${outsourcing_constraints}
          AND (? IS NULL OR d.branchid = ?)
          AND (? IS NULL OR d.outsourceid = ?)
        GROUP BY quarter, year
        ORDER BY year DESC, quarter DESC;
    `;
}

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