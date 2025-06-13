export class BillingAnalytics {
    public static totalSalesByServiceCategory = `SELECT serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static averageCostPerService = `SELECT AVG(cost) AS avgCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
    public static totalSalesByBranch = `SELECT db.branchid, SUM(db.cost) AS totalSales, b.name FROM dboservices AS db INNER JOIN branch AS b ON db.branchid = b.branchid WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY b.branchid;`;
    public static totalSalesByClinician = `SELECT d.clinicianId, COALESCE(c.name, 'Unknown') AS name, SUM(d.cost) AS totalSales FROM dboservices d LEFT JOIN clinicianbasicinfo c ON d.clinicianId = c.id WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY d.clinicianId, c.name;`;
    public static totalSalesByOrganization = `SELECT organizationId, SUM(totalcost) AS totalSales, o.name FROM dboservices AS db INNER JOIN organization AS o ON o.id = db.organizationId WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY db.organizationId;`;
    public static totalSalesByRegistrationType = `SELECT registrationType, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY registrationType;`;
    public static totalSalesByOutsourcedStatus = `SELECT isoutsourced, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY isoutsourced;`;
    public static salesTrendByDate = `SELECT serviceAddedOn, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY DATE(serviceAddedOn) ORDER BY serviceAddedOn`;
    public static numberOfServicesByCategory = `SELECT serviceCategory, COUNT(*) AS totalServices FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static salesByTaxStatus = `SELECT taxIncluded, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxIncluded;`;
    public static salesByDiscountStatus = `SELECT discount, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY discount;`;
    public static totalSalesByBranchAndCategory = `SELECT branchid, serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid, serviceCategory;`;
    public static totalSalesByEmployee = `SELECT db.employeeid, SUM(db.cost) AS totalSales, rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY db.employeeid;`;
    public static salesByOutsourceId = `SELECT outsourceid, SUM(totalcost) AS totalSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY outsourceid;`;
    public static top10HighestCostServices = `SELECT serviceid, MAX(cost) AS highestCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY highestCost DESC LIMIT 10;`;
    public static totalTaxByServiceCategory = `SELECT serviceCategory, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static totalSalesAndTaxValue = `SELECT SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
    public static averageTaxByBranch = `SELECT branchid, AVG(taxValue) AS avgTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
    public static salesWithHighestTaxIncluded = `SELECT serviceid, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax FROM dboservices WHERE taxIncluded = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY totalTax DESC LIMIT 10;`;
    public static totalTaxByClinician = `SELECT clinicianId, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
    public static totalDiscountByBranch = `SELECT branchid, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
    public static averageDiscountPerService = `SELECT serviceid, AVG(discount) AS avgDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid;`;
    public static totalDiscountByClinician = `SELECT clinicianId, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
    public static totalDiscountByRegistrationType = `SELECT registrationType, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY registrationType;`;
    public static top10ServicesWithMaxDiscount = `SELECT serviceid, MAX(discount) AS highestDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY highestDiscount DESC LIMIT 10;`;
    public static mostPopularServiceBySales = `SELECT serviceid, COUNT(*) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY totalSales DESC LIMIT 10;`;
    public static averageServiceCostByCategory = `SELECT serviceCategory, AVG(cost) AS avgCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static totalSalesByBillingid = `SELECT billingid, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY billingid;`;
    public static numberOfServicesByEmployee = `SELECT employeeid, COUNT(*) AS servicesProvided FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid;`;
    public static totalSalesByCategoryAndRegistration = `SELECT serviceCategory, registrationType, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory, registrationType;`;
    public static monthlySalesTrend = `SELECT MONTHNAME(serviceAddedOn) AS month, SUM(totalcost) AS totalSales,SUM(discount) AS totaldiscount , SUM(totalpayable) AS totalpayableAmount , SUM(paid) AS totalpaid FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn);`;
    public static dailySalesTrend = `SELECT 
    DATE(serviceAddedOn) AS date,
    SUM(totalcost) AS totalSales,
    SUM(totalcost) - LAG(SUM(totalcost)) OVER (ORDER BY DATE(serviceAddedOn)) AS changeFromPreviousDay
FROM dboservices
WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE)
GROUP BY DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn);
`;
    public static weeklySalesTrend = `SELECT WEEK(serviceAddedOn) AS week, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY week ORDER BY week;`;
    public static salesByMonthAndCategory = `SELECT MONTH(serviceAddedOn) AS month, serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY month, serviceCategory;`;
    public static salesByWeekAndBranch = ` SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, SUM(db.cost) AS totalSales ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
      WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY week, db.branchid;`;
    public static yearlySalesTrend = `SELECT YEAR(serviceAddedOn) AS year, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY year ORDER BY year;`;
    public static salesByHourOfDay = `SELECT HOUR(serviceAddedOn) AS hour, SUM(totalcost) AS totalSales FROM dboservices WHERE DATE(serviceAddedOn) = CURRENT_DATE GROUP BY hour ORDER BY hour;`;
    public static totalSalesFromOutsourcedServices = `SELECT SUM(totalcost) AS totalOutsourcedSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
    public static salesFromOutsourcedByBranch = `SELECT branchid, SUM(totalcost) AS totalOutsourcedSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
    public static numberOfOutsourcedServicesByOrg = `SELECT organizationId, COUNT(*) AS outsourcedServicesCount FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY organizationId;`;
    public static maxAndMinServiceCosts = `SELECT MAX(cost) AS maxCost, MIN(cost) AS minCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
    public static serviceCostByCategory = `SELECT serviceCategory, AVG(cost) AS avgCost, MAX(cost) AS maxCost, MIN(cost) AS minCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static costBreakdownByClinician = `SELECT clinicianId, SUM(totalcost) AS totalCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
    public static costPerServiceByCategory = `SELECT serviceCategory, AVG(cost) AS avgServiceCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static numberOfTransactionsByBranch = `SELECT branchid, COUNT(*) AS transactionCount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
    public static totalSalesByTransactionId = `SELECT trackId, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY trackId;`;
    public static transactionCountByEmployee = `SELECT employeeid, COUNT(*) AS transactionCount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid;`;
    public static totalSalesAndTransactionsByDate = `SELECT serviceAddedOn, COUNT(*) AS transactionCount, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceAddedOn ORDER BY serviceAddedOn;`;
    public static taxCollectedByTransaction = `SELECT trackId, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY trackId;`;
    public static taxValueByBranch = `SELECT branchid, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
    public static totalSalesByTaxValueAndIncluded = `SELECT taxValue, taxIncluded, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxValue, taxIncluded;`;
    public static averageSalesPerDay = `SELECT AVG(dailySales) AS avgDailySales FROM (SELECT DATE(serviceAddedOn) AS day, SUM(totalcost) AS dailySales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY day) AS dailySalesTable;`;
    public static salesByTaxableStatus = `SELECT taxIncluded, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxIncluded;`;
    public static totalSalesByEmployeeAndBranch = `SELECT employeeid, branchid, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, branchid;`;
    public static numberOfServicesByEmployeeAndDate = `SELECT employeeid, DATE(serviceAddedOn) AS date, COUNT(*) AS totalServices FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, date ORDER BY date;`;
    public static salesAndTaxValueByRegistrationType = `SELECT registrationType, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY registrationType;`;
    public static totalDiscountByServiceCategory = `SELECT serviceCategory, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static salesAndDiscountByClinician = `SELECT clinicianId, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
    public static totalSalesByTaxValue = `SELECT taxValue, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxValue;`;
    public static taxValueByClinician = `SELECT clinicianId, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
    public static totalSalesByOutsourceIdAndDate = `SELECT outsourceid, DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY outsourceid, date ORDER BY date;`;
    public static salesByEmployeeAndClinician = `SELECT employeeid, clinicianId, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, clinicianId;`;
    public static salesAndDiscountByMonth = `SELECT MONTH(serviceAddedOn) AS month, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY month;`;
    public static salesByEmployeeAndService = `SELECT employeeid, serviceid, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, serviceid;`;
    public static totalTaxValueByOutsourceStatus = `SELECT isoutsourced, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY isoutsourced;`;

    public static totalSalesFromOutsourcedServicesByCategory = `SELECT serviceCategory, SUM(totalcost) AS totalOutsourcedSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
    public static totalSalesForAllCategories = `SELECT serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
}


export class BillingAnalyticsWithDate {
    public static totalSalesByServiceCategory = `
        SELECT serviceCategory, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static averageCostPerService = `
        SELECT AVG(cost) AS avgCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;

    public static totalSalesByBranch = `
        SELECT db.branchid, SUM(totalcost) AS totalSales,SUM(discount) AS totaldiscount , SUM(totalpayable) AS totalpayableAmount  ,b.name
        FROM dboservices AS db
        INNER JOIN branch AS b ON db.branchid = b.branchid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY db.branchid;
    `;

    public static totalSalesByClinician = `
     SELECT
        d.clinicianId,
        COALESCE(c.name, 'Unknown') AS name,
        SUM(d.cost) AS totalSales
        FROM
            dboservices d
        LEFT JOIN
            clinicianbasicinfo c
        ON
            d.clinicianId = c.id
            WHERE
            DATE(d.serviceAddedOn) BETWEEN ? AND ?
        GROUP BY
    d.clinicianId, c.name

    `;

    public static totalSalesByOrganization = `
        SELECT organizationId, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY organizationId;
    `;

    public static totalSalesByRegistrationType = `
        SELECT registrationType, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY registrationType;
    `;

    public static totalSalesByOutsourcedStatus = `
        SELECT isoutsourced, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY isoutsourced;
    `;

    public static salesTrendByDate = `
        SELECT DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY date 
        ORDER BY date;
    `;

    public static numberOfServicesByCategory = `
        SELECT serviceCategory, COUNT(*) AS totalServices 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static salesByTaxStatus = `
        SELECT taxIncluded, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxIncluded;
    `;

    public static salesByDiscountStatus = `
        SELECT discount, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY discount;
    `;

    public static totalSalesByBranchAndCategory = `
        SELECT branchid, serviceCategory, SUM(totalpayable) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid, serviceCategory;
    `;

    public static totalSalesByEmployee = `
       SELECT db.employeeid, SUM(db.totalpayable) AS totalSales,rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid
        WHERE serviceAddedOn BETWEEN ? AND ?
        GROUP BY db.employeeid;
    `;

    public static salesByOutsourceId = `
        SELECT outsourceid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY outsourceid;
    `;

    public static top10HighestCostServices = `
        SELECT serviceid, MAX(cost) AS highestCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY highestCost DESC 
        LIMIT 10;
    `;

    public static totalTaxByServiceCategory = `
        SELECT serviceCategory, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static totalSalesAndTaxValue = `
        SELECT SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;

    public static averageTaxByBranch = `
        SELECT branchid, AVG(taxValue) AS avgTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;

    public static salesWithHighestTaxIncluded = `
        SELECT serviceid, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE taxIncluded = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY totalTax DESC 
        LIMIT 10;
    `;

    public static totalTaxByClinician = `
        SELECT clinicianId, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;

    public static totalDiscountByBranch = `
        SELECT branchid, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;

    public static averageDiscountPerService = `
        SELECT serviceid, AVG(discount) AS avgDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid;
    `;

    public static totalDiscountByClinician = `
        SELECT clinicianId, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;

    public static totalDiscountByRegistrationType = `
        SELECT registrationType, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY registrationType;
    `;

    public static top10ServicesWithMaxDiscount = `
        SELECT serviceid, MAX(discount) AS highestDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY highestDiscount DESC 
        LIMIT 10;
    `;

    public static mostPopularServiceBySales = `
        SELECT serviceid, COUNT(*) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY totalSales DESC 
        LIMIT 10;
    `;

    public static averageServiceCostByCategory = `
        SELECT serviceCategory, AVG(cost) AS avgCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static totalSalesByBillingid = `
        SELECT billingid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY billingid;
    `;

    public static numberOfServicesByEmployee = `
        SELECT employeeid, COUNT(*) AS servicesProvided 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid;
    `;

    public static totalSalesByCategoryAndRegistration = `
        SELECT serviceCategory, registrationType, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory, registrationType;
    `;

    public static monthlySalesTrend = `
       SELECT MONTHNAME(serviceAddedOn) AS month, SUM(totalcost) AS totalSales,SUM(discount) AS totaldiscount , 
       SUM(totalpayable) AS totalpayableAmount FROM dboservices
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn);
    `;

    public static dailySalesTrend = `
        SELECT DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY date 
        ORDER BY date;
    `;

    public static weeklySalesTrend = `
     SELECT * 
        FROM weekly_sales_summary
    WHERE startDate >= ? AND endDate <= ?
    ORDER BY week;

    `;

    public static salesByMonthAndCategory = `
        SELECT MONTH(serviceAddedOn) AS month, serviceCategory, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY month, serviceCategory;
    `;

    public static salesByWeekAndBranch = `
        SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, SUM(db.cost) AS totalSales ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        WHERE DATE(db.serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY week, db.branchid;
    `;

    public static yearlySalesTrend = `
        SELECT YEAR(serviceAddedOn) AS year, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY year 
        ORDER BY year;
    `;

    public static salesByHourOfDay = `
        SELECT HOUR(serviceAddedOn) AS hour, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY hour 
        ORDER BY hour;
    `;

    public static totalSalesFromOutsourcedServices = `
        SELECT SUM(totalcost) AS totalOutsourcedSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;

    public static salesFromOutsourcedByBranch = `
        SELECT branchid, SUM(totalcost) AS totalOutsourcedSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;

    public static numberOfOutsourcedServicesByOrg = `
        SELECT organizationId, COUNT(*) AS outsourcedServicesCount 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY organizationId;
    `;

    public static maxAndMinServiceCosts = `
        SELECT MAX(cost) AS maxCost, MIN(cost) AS minCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;

    public static serviceCostByCategory = `
        SELECT serviceCategory, AVG(cost) AS avgCost, MAX(cost) AS maxCost, MIN(cost) AS minCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static costBreakdownByClinician = `
        SELECT clinicianId, SUM(totalcost) AS totalCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;

    public static costPerServiceByCategory = `
        SELECT serviceCategory, AVG(cost) AS avgServiceCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static numberOfTransactionsByBranch = `
        SELECT branchid, COUNT(*) AS transactionCount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;

    public static totalSalesByTransactionId = `
        SELECT trackId, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY trackId;
    `;

    public static transactionCountByEmployee = `
        SELECT employeeid, COUNT(*) AS transactionCount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid;
    `;

    public static totalSalesAndTransactionsByDate = `
        SELECT DATE(serviceAddedOn) AS date, COUNT(*) AS transactionCount, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY date 
        ORDER BY date;
    `;

    public static taxCollectedByTransaction = `
        SELECT trackId, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY trackId;
    `;

    public static taxValueByBranch = `
        SELECT branchid, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;

    public static totalSalesByTaxValueAndIncluded = `
        SELECT taxValue, taxIncluded, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxValue, taxIncluded;
    `;

    public static averageSalesPerDay = `
        SELECT AVG(dailySales) AS avgDailySales 
        FROM (
            SELECT DATE(serviceAddedOn) AS day, SUM(totalcost) AS dailySales 
            FROM dboservices 
            WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
            GROUP BY day
        ) AS dailySalesTable;
    `;

    public static salesByTaxableStatus = `
        SELECT taxIncluded, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxIncluded;
    `;

    public static totalSalesByEmployeeAndBranch = `
        SELECT employeeid, branchid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, branchid;
    `;

    public static numberOfServicesByEmployeeAndDate = `
        SELECT employeeid, DATE(serviceAddedOn) AS date, COUNT(*) AS totalServices 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, date 
        ORDER BY date;
    `;

    public static salesAndTaxValueByRegistrationType = `
        SELECT registrationType, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY registrationType;
    `;

    public static totalDiscountByServiceCategory = `
        SELECT serviceCategory, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static salesAndDiscountByClinician = `
        SELECT clinicianId, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;

    public static totalSalesByTaxValue = `
        SELECT taxValue, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxValue;
    `;

    public static taxValueByClinician = `
        SELECT clinicianId, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;

    public static totalSalesByOutsourceIdAndDate = `
        SELECT outsourceid, DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY outsourceid, date 
        ORDER BY date;
    `;

    public static salesByEmployeeAndClinician = `
        SELECT employeeid, clinicianId, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, clinicianId;
    `;

    public static salesAndDiscountByMonth = `
        SELECT MONTH(serviceAddedOn) AS month, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY month;
    `;

    public static salesByEmployeeAndService = `
        SELECT employeeid, serviceid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, serviceid;
    `;

    public static totalTaxValueByOutsourceStatus = `
        SELECT isoutsourced, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY isoutsourced;
    `;

    public static totalSalesFromOutsourcedServicesByCategory = `
        SELECT serviceCategory, SUM(totalcost) AS totalOutsourcedSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;

    public static totalSalesForAllCategories = `
        SELECT serviceCategory, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
}
