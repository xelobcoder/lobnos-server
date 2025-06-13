"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingAnalyticsWithDate = exports.BillingAnalytics = void 0;
class BillingAnalytics {
}
exports.BillingAnalytics = BillingAnalytics;
BillingAnalytics.totalSalesByServiceCategory = `SELECT serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.averageCostPerService = `SELECT AVG(cost) AS avgCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
BillingAnalytics.totalSalesByBranch = `SELECT db.branchid, SUM(db.cost) AS totalSales, b.name FROM dboservices AS db INNER JOIN branch AS b ON db.branchid = b.branchid WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY b.branchid;`;
BillingAnalytics.totalSalesByClinician = `SELECT d.clinicianId, COALESCE(c.name, 'Unknown') AS name, SUM(d.cost) AS totalSales FROM dboservices d LEFT JOIN clinicianbasicinfo c ON d.clinicianId = c.id WHERE YEAR(d.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY d.clinicianId, c.name;`;
BillingAnalytics.totalSalesByOrganization = `SELECT organizationId, SUM(totalcost) AS totalSales, o.name FROM dboservices AS db INNER JOIN organization AS o ON o.id = db.organizationId WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY db.organizationId;`;
BillingAnalytics.totalSalesByRegistrationType = `SELECT registrationType, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY registrationType;`;
BillingAnalytics.totalSalesByOutsourcedStatus = `SELECT isoutsourced, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY isoutsourced;`;
BillingAnalytics.salesTrendByDate = `SELECT serviceAddedOn, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY DATE(serviceAddedOn) ORDER BY serviceAddedOn`;
BillingAnalytics.numberOfServicesByCategory = `SELECT serviceCategory, COUNT(*) AS totalServices FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.salesByTaxStatus = `SELECT taxIncluded, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxIncluded;`;
BillingAnalytics.salesByDiscountStatus = `SELECT discount, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY discount;`;
BillingAnalytics.totalSalesByBranchAndCategory = `SELECT branchid, serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid, serviceCategory;`;
BillingAnalytics.totalSalesByEmployee = `SELECT db.employeeid, SUM(db.cost) AS totalSales, rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY db.employeeid;`;
BillingAnalytics.salesByOutsourceId = `SELECT outsourceid, SUM(totalcost) AS totalSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY outsourceid;`;
BillingAnalytics.top10HighestCostServices = `SELECT serviceid, MAX(cost) AS highestCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY highestCost DESC LIMIT 10;`;
BillingAnalytics.totalTaxByServiceCategory = `SELECT serviceCategory, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.totalSalesAndTaxValue = `SELECT SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
BillingAnalytics.averageTaxByBranch = `SELECT branchid, AVG(taxValue) AS avgTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
BillingAnalytics.salesWithHighestTaxIncluded = `SELECT serviceid, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax FROM dboservices WHERE taxIncluded = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY totalTax DESC LIMIT 10;`;
BillingAnalytics.totalTaxByClinician = `SELECT clinicianId, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
BillingAnalytics.totalDiscountByBranch = `SELECT branchid, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
BillingAnalytics.averageDiscountPerService = `SELECT serviceid, AVG(discount) AS avgDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid;`;
BillingAnalytics.totalDiscountByClinician = `SELECT clinicianId, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
BillingAnalytics.totalDiscountByRegistrationType = `SELECT registrationType, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY registrationType;`;
BillingAnalytics.top10ServicesWithMaxDiscount = `SELECT serviceid, MAX(discount) AS highestDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY highestDiscount DESC LIMIT 10;`;
BillingAnalytics.mostPopularServiceBySales = `SELECT serviceid, COUNT(*) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceid ORDER BY totalSales DESC LIMIT 10;`;
BillingAnalytics.averageServiceCostByCategory = `SELECT serviceCategory, AVG(cost) AS avgCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.totalSalesByBillingid = `SELECT billingid, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY billingid;`;
BillingAnalytics.numberOfServicesByEmployee = `SELECT employeeid, COUNT(*) AS servicesProvided FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid;`;
BillingAnalytics.totalSalesByCategoryAndRegistration = `SELECT serviceCategory, registrationType, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory, registrationType;`;
BillingAnalytics.monthlySalesTrend = `SELECT MONTHNAME(serviceAddedOn) AS month, SUM(totalcost) AS totalSales,SUM(discount) AS totaldiscount , SUM(totalpayable) AS totalpayableAmount , SUM(paid) AS totalpaid FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn);`;
BillingAnalytics.dailySalesTrend = `SELECT 
    DATE(serviceAddedOn) AS date,
    SUM(totalcost) AS totalSales,
    SUM(totalcost) - LAG(SUM(totalcost)) OVER (ORDER BY DATE(serviceAddedOn)) AS changeFromPreviousDay
FROM dboservices
WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE)
GROUP BY DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn);
`;
BillingAnalytics.weeklySalesTrend = `SELECT WEEK(serviceAddedOn) AS week, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY week ORDER BY week;`;
BillingAnalytics.salesByMonthAndCategory = `SELECT MONTH(serviceAddedOn) AS month, serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY month, serviceCategory;`;
BillingAnalytics.salesByWeekAndBranch = ` SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, SUM(db.cost) AS totalSales ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
      WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY week, db.branchid;`;
BillingAnalytics.yearlySalesTrend = `SELECT YEAR(serviceAddedOn) AS year, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY year ORDER BY year;`;
BillingAnalytics.salesByHourOfDay = `SELECT HOUR(serviceAddedOn) AS hour, SUM(totalcost) AS totalSales FROM dboservices WHERE DATE(serviceAddedOn) = CURRENT_DATE GROUP BY hour ORDER BY hour;`;
BillingAnalytics.totalSalesFromOutsourcedServices = `SELECT SUM(totalcost) AS totalOutsourcedSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
BillingAnalytics.salesFromOutsourcedByBranch = `SELECT branchid, SUM(totalcost) AS totalOutsourcedSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
BillingAnalytics.numberOfOutsourcedServicesByOrg = `SELECT organizationId, COUNT(*) AS outsourcedServicesCount FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY organizationId;`;
BillingAnalytics.maxAndMinServiceCosts = `SELECT MAX(cost) AS maxCost, MIN(cost) AS minCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE);`;
BillingAnalytics.serviceCostByCategory = `SELECT serviceCategory, AVG(cost) AS avgCost, MAX(cost) AS maxCost, MIN(cost) AS minCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.costBreakdownByClinician = `SELECT clinicianId, SUM(totalcost) AS totalCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
BillingAnalytics.costPerServiceByCategory = `SELECT serviceCategory, AVG(cost) AS avgServiceCost FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.numberOfTransactionsByBranch = `SELECT branchid, COUNT(*) AS transactionCount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
BillingAnalytics.totalSalesByTransactionId = `SELECT trackId, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY trackId;`;
BillingAnalytics.transactionCountByEmployee = `SELECT employeeid, COUNT(*) AS transactionCount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid;`;
BillingAnalytics.totalSalesAndTransactionsByDate = `SELECT serviceAddedOn, COUNT(*) AS transactionCount, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceAddedOn ORDER BY serviceAddedOn;`;
BillingAnalytics.taxCollectedByTransaction = `SELECT trackId, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY trackId;`;
BillingAnalytics.taxValueByBranch = `SELECT branchid, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY branchid;`;
BillingAnalytics.totalSalesByTaxValueAndIncluded = `SELECT taxValue, taxIncluded, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxValue, taxIncluded;`;
BillingAnalytics.averageSalesPerDay = `SELECT AVG(dailySales) AS avgDailySales FROM (SELECT DATE(serviceAddedOn) AS day, SUM(totalcost) AS dailySales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY day) AS dailySalesTable;`;
BillingAnalytics.salesByTaxableStatus = `SELECT taxIncluded, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxIncluded;`;
BillingAnalytics.totalSalesByEmployeeAndBranch = `SELECT employeeid, branchid, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, branchid;`;
BillingAnalytics.numberOfServicesByEmployeeAndDate = `SELECT employeeid, DATE(serviceAddedOn) AS date, COUNT(*) AS totalServices FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, date ORDER BY date;`;
BillingAnalytics.salesAndTaxValueByRegistrationType = `SELECT registrationType, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY registrationType;`;
BillingAnalytics.totalDiscountByServiceCategory = `SELECT serviceCategory, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.salesAndDiscountByClinician = `SELECT clinicianId, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
BillingAnalytics.totalSalesByTaxValue = `SELECT taxValue, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY taxValue;`;
BillingAnalytics.taxValueByClinician = `SELECT clinicianId, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY clinicianId;`;
BillingAnalytics.totalSalesByOutsourceIdAndDate = `SELECT outsourceid, DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY outsourceid, date ORDER BY date;`;
BillingAnalytics.salesByEmployeeAndClinician = `SELECT employeeid, clinicianId, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, clinicianId;`;
BillingAnalytics.salesAndDiscountByMonth = `SELECT MONTH(serviceAddedOn) AS month, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY month;`;
BillingAnalytics.salesByEmployeeAndService = `SELECT employeeid, serviceid, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY employeeid, serviceid;`;
BillingAnalytics.totalTaxValueByOutsourceStatus = `SELECT isoutsourced, SUM(taxValue) AS totalTax FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY isoutsourced;`;
BillingAnalytics.totalSalesFromOutsourcedServicesByCategory = `SELECT serviceCategory, SUM(totalcost) AS totalOutsourcedSales FROM dboservices WHERE isoutsourced = 1 AND YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
BillingAnalytics.totalSalesForAllCategories = `SELECT serviceCategory, SUM(totalcost) AS totalSales FROM dboservices WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) GROUP BY serviceCategory;`;
class BillingAnalyticsWithDate {
}
exports.BillingAnalyticsWithDate = BillingAnalyticsWithDate;
BillingAnalyticsWithDate.totalSalesByServiceCategory = `
        SELECT serviceCategory, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.averageCostPerService = `
        SELECT AVG(cost) AS avgCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;
BillingAnalyticsWithDate.totalSalesByBranch = `
        SELECT db.branchid, SUM(totalcost) AS totalSales,SUM(discount) AS totaldiscount , SUM(totalpayable) AS totalpayableAmount  ,b.name
        FROM dboservices AS db
        INNER JOIN branch AS b ON db.branchid = b.branchid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY db.branchid;
    `;
BillingAnalyticsWithDate.totalSalesByClinician = `
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
BillingAnalyticsWithDate.totalSalesByOrganization = `
        SELECT organizationId, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY organizationId;
    `;
BillingAnalyticsWithDate.totalSalesByRegistrationType = `
        SELECT registrationType, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY registrationType;
    `;
BillingAnalyticsWithDate.totalSalesByOutsourcedStatus = `
        SELECT isoutsourced, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY isoutsourced;
    `;
BillingAnalyticsWithDate.salesTrendByDate = `
        SELECT DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY date 
        ORDER BY date;
    `;
BillingAnalyticsWithDate.numberOfServicesByCategory = `
        SELECT serviceCategory, COUNT(*) AS totalServices 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.salesByTaxStatus = `
        SELECT taxIncluded, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxIncluded;
    `;
BillingAnalyticsWithDate.salesByDiscountStatus = `
        SELECT discount, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY discount;
    `;
BillingAnalyticsWithDate.totalSalesByBranchAndCategory = `
        SELECT branchid, serviceCategory, SUM(totalpayable) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid, serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesByEmployee = `
       SELECT db.employeeid, SUM(db.totalpayable) AS totalSales,rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid
        WHERE serviceAddedOn BETWEEN ? AND ?
        GROUP BY db.employeeid;
    `;
BillingAnalyticsWithDate.salesByOutsourceId = `
        SELECT outsourceid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY outsourceid;
    `;
BillingAnalyticsWithDate.top10HighestCostServices = `
        SELECT serviceid, MAX(cost) AS highestCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY highestCost DESC 
        LIMIT 10;
    `;
BillingAnalyticsWithDate.totalTaxByServiceCategory = `
        SELECT serviceCategory, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesAndTaxValue = `
        SELECT SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;
BillingAnalyticsWithDate.averageTaxByBranch = `
        SELECT branchid, AVG(taxValue) AS avgTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;
BillingAnalyticsWithDate.salesWithHighestTaxIncluded = `
        SELECT serviceid, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE taxIncluded = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY totalTax DESC 
        LIMIT 10;
    `;
BillingAnalyticsWithDate.totalTaxByClinician = `
        SELECT clinicianId, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;
BillingAnalyticsWithDate.totalDiscountByBranch = `
        SELECT branchid, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;
BillingAnalyticsWithDate.averageDiscountPerService = `
        SELECT serviceid, AVG(discount) AS avgDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid;
    `;
BillingAnalyticsWithDate.totalDiscountByClinician = `
        SELECT clinicianId, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;
BillingAnalyticsWithDate.totalDiscountByRegistrationType = `
        SELECT registrationType, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY registrationType;
    `;
BillingAnalyticsWithDate.top10ServicesWithMaxDiscount = `
        SELECT serviceid, MAX(discount) AS highestDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY highestDiscount DESC 
        LIMIT 10;
    `;
BillingAnalyticsWithDate.mostPopularServiceBySales = `
        SELECT serviceid, COUNT(*) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceid 
        ORDER BY totalSales DESC 
        LIMIT 10;
    `;
BillingAnalyticsWithDate.averageServiceCostByCategory = `
        SELECT serviceCategory, AVG(cost) AS avgCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesByBillingid = `
        SELECT billingid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY billingid;
    `;
BillingAnalyticsWithDate.numberOfServicesByEmployee = `
        SELECT employeeid, COUNT(*) AS servicesProvided 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid;
    `;
BillingAnalyticsWithDate.totalSalesByCategoryAndRegistration = `
        SELECT serviceCategory, registrationType, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory, registrationType;
    `;
BillingAnalyticsWithDate.monthlySalesTrend = `
       SELECT MONTHNAME(serviceAddedOn) AS month, SUM(totalcost) AS totalSales,SUM(discount) AS totaldiscount , 
       SUM(totalpayable) AS totalpayableAmount FROM dboservices
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn);
    `;
BillingAnalyticsWithDate.dailySalesTrend = `
        SELECT DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY date 
        ORDER BY date;
    `;
BillingAnalyticsWithDate.weeklySalesTrend = `
     SELECT * 
        FROM weekly_sales_summary
    WHERE startDate >= ? AND endDate <= ?
    ORDER BY week;

    `;
BillingAnalyticsWithDate.salesByMonthAndCategory = `
        SELECT MONTH(serviceAddedOn) AS month, serviceCategory, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY month, serviceCategory;
    `;
BillingAnalyticsWithDate.salesByWeekAndBranch = `
        SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, SUM(db.cost) AS totalSales ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        WHERE DATE(db.serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY week, db.branchid;
    `;
BillingAnalyticsWithDate.yearlySalesTrend = `
        SELECT YEAR(serviceAddedOn) AS year, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY year 
        ORDER BY year;
    `;
BillingAnalyticsWithDate.salesByHourOfDay = `
        SELECT HOUR(serviceAddedOn) AS hour, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY hour 
        ORDER BY hour;
    `;
BillingAnalyticsWithDate.totalSalesFromOutsourcedServices = `
        SELECT SUM(totalcost) AS totalOutsourcedSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;
BillingAnalyticsWithDate.salesFromOutsourcedByBranch = `
        SELECT branchid, SUM(totalcost) AS totalOutsourcedSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;
BillingAnalyticsWithDate.numberOfOutsourcedServicesByOrg = `
        SELECT organizationId, COUNT(*) AS outsourcedServicesCount 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY organizationId;
    `;
BillingAnalyticsWithDate.maxAndMinServiceCosts = `
        SELECT MAX(cost) AS maxCost, MIN(cost) AS minCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?;
    `;
BillingAnalyticsWithDate.serviceCostByCategory = `
        SELECT serviceCategory, AVG(cost) AS avgCost, MAX(cost) AS maxCost, MIN(cost) AS minCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.costBreakdownByClinician = `
        SELECT clinicianId, SUM(totalcost) AS totalCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;
BillingAnalyticsWithDate.costPerServiceByCategory = `
        SELECT serviceCategory, AVG(cost) AS avgServiceCost 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.numberOfTransactionsByBranch = `
        SELECT branchid, COUNT(*) AS transactionCount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;
BillingAnalyticsWithDate.totalSalesByTransactionId = `
        SELECT trackId, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY trackId;
    `;
BillingAnalyticsWithDate.transactionCountByEmployee = `
        SELECT employeeid, COUNT(*) AS transactionCount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid;
    `;
BillingAnalyticsWithDate.totalSalesAndTransactionsByDate = `
        SELECT DATE(serviceAddedOn) AS date, COUNT(*) AS transactionCount, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY date 
        ORDER BY date;
    `;
BillingAnalyticsWithDate.taxCollectedByTransaction = `
        SELECT trackId, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY trackId;
    `;
BillingAnalyticsWithDate.taxValueByBranch = `
        SELECT branchid, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY branchid;
    `;
BillingAnalyticsWithDate.totalSalesByTaxValueAndIncluded = `
        SELECT taxValue, taxIncluded, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxValue, taxIncluded;
    `;
BillingAnalyticsWithDate.averageSalesPerDay = `
        SELECT AVG(dailySales) AS avgDailySales 
        FROM (
            SELECT DATE(serviceAddedOn) AS day, SUM(totalcost) AS dailySales 
            FROM dboservices 
            WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
            GROUP BY day
        ) AS dailySalesTable;
    `;
BillingAnalyticsWithDate.salesByTaxableStatus = `
        SELECT taxIncluded, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxIncluded;
    `;
BillingAnalyticsWithDate.totalSalesByEmployeeAndBranch = `
        SELECT employeeid, branchid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, branchid;
    `;
BillingAnalyticsWithDate.numberOfServicesByEmployeeAndDate = `
        SELECT employeeid, DATE(serviceAddedOn) AS date, COUNT(*) AS totalServices 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, date 
        ORDER BY date;
    `;
BillingAnalyticsWithDate.salesAndTaxValueByRegistrationType = `
        SELECT registrationType, SUM(totalcost) AS totalSales, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY registrationType;
    `;
BillingAnalyticsWithDate.totalDiscountByServiceCategory = `
        SELECT serviceCategory, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.salesAndDiscountByClinician = `
        SELECT clinicianId, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;
BillingAnalyticsWithDate.totalSalesByTaxValue = `
        SELECT taxValue, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY taxValue;
    `;
BillingAnalyticsWithDate.taxValueByClinician = `
        SELECT clinicianId, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY clinicianId;
    `;
BillingAnalyticsWithDate.totalSalesByOutsourceIdAndDate = `
        SELECT outsourceid, DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY outsourceid, date 
        ORDER BY date;
    `;
BillingAnalyticsWithDate.salesByEmployeeAndClinician = `
        SELECT employeeid, clinicianId, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, clinicianId;
    `;
BillingAnalyticsWithDate.salesAndDiscountByMonth = `
        SELECT MONTH(serviceAddedOn) AS month, SUM(totalcost) AS totalSales, SUM(discount) AS totalDiscount 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY month;
    `;
BillingAnalyticsWithDate.salesByEmployeeAndService = `
        SELECT employeeid, serviceid, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY employeeid, serviceid;
    `;
BillingAnalyticsWithDate.totalTaxValueByOutsourceStatus = `
        SELECT isoutsourced, SUM(taxValue) AS totalTax 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY isoutsourced;
    `;
BillingAnalyticsWithDate.totalSalesFromOutsourcedServicesByCategory = `
        SELECT serviceCategory, SUM(totalcost) AS totalOutsourcedSales 
        FROM dboservices 
        WHERE isoutsourced = 1 AND DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesForAllCategories = `
        SELECT serviceCategory, SUM(totalcost) AS totalSales 
        FROM dboservices 
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? 
        GROUP BY serviceCategory;
    `;
