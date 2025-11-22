"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingAnalyticsWithDate = exports.BillingAnalytics = void 0;
const major_constraints = `AND (dboservices.isRefunded = 0 AND dboservices.status ='active')`;
class BillingAnalytics {
}
exports.BillingAnalytics = BillingAnalytics;
BillingAnalytics.totalSalesByBranch = `SELECT db.branchid, SUM(db.totalcost) AS totalCost, SUM(db.paidamount) AS totalPaid, SUM(db.totalpayable) AS totalPayable, SUM(db.discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded, b.name FROM dboservices AS db INNER JOIN branch AS b ON db.branchid = b.branchid LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY b.branchid;`;
BillingAnalytics.totalSalesByOrganization = `SELECT organizationId, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded, o.name FROM dboservices AS db INNER JOIN organization AS o ON o.id = db.organizationId LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY db.organizationId;`;
BillingAnalytics.totalSalesByOutsourcedStatus = `SELECT isoutsourced, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY isoutsourced;`;
BillingAnalytics.totalSalesByBranchAndCategory = `SELECT branchid, serviceCategory, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY branchid, serviceCategory;`;
BillingAnalytics.totalSalesByEmployee = `SELECT db.employeeid, SUM(db.totalcost) AS totalCost, SUM(db.paidamount) AS totalPaid, SUM(db.totalpayable) AS totalPayable, SUM(db.discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded,
     rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
     WHERE YEAR(db.serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY db.employeeid;`;
BillingAnalytics.monthlySalesTrend = `SELECT MONTHNAME(serviceAddedOn) AS month, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn);`;
BillingAnalytics.dailySalesTrend = `SELECT
    DATE(serviceAddedOn) AS date,
    SUM(totalcost) AS totalCost,
    SUM(paidamount) AS totalPaid,
    SUM(totalpayable) AS totalPayable,
    SUM(discount) AS totalDiscount,
    COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
FROM dboservices
LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints}
GROUP BY DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn);
`;
BillingAnalytics.weeklySalesTrend = `SELECT WEEK(serviceAddedOn) AS week, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY week ORDER BY week;`;
BillingAnalytics.salesByWeekAndBranch = ` SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, SUM(db.totalcost) AS totalCost, SUM(db.paidamount) AS totalPaid, SUM(db.totalpayable) AS totalPayable, SUM(db.discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
      WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) AND  (db.isRefunded = 0 AND db.status ='active') GROUP BY week, db.branchid;`;
BillingAnalytics.yearlySalesTrend = `SELECT YEAR(serviceAddedOn) AS year, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints} GROUP BY year ORDER BY year;`;
BillingAnalytics.totalAmountRefunded = `SELECT SUM(r.amountRefunded) AS totalRefunded FROM dboservices s INNER JOIN dbobillingrefundtable r ON s.serviceid = r.serviceid WHERE YEAR(s.serviceAddedOn) = YEAR(CURRENT_DATE) ${major_constraints};`;
class BillingAnalyticsWithDate {
}
exports.BillingAnalyticsWithDate = BillingAnalyticsWithDate;
BillingAnalyticsWithDate.totalSalesByServiceCategory = `
        SELECT serviceCategory, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  ${major_constraints}
        GROUP BY serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesByBranch = `
        SELECT db.branchid, SUM(db.totalcost) AS totalCost, SUM(db.paidamount) AS totalPaid, SUM(db.totalpayable) AS totalPayable, SUM(db.discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded, b.name
        FROM dboservices AS db
        INNER JOIN branch AS b ON db.branchid = b.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  AND (db.isRefunded = 0 AND db.status ='active')
        GROUP BY db.branchid;
    `;
BillingAnalyticsWithDate.totalSalesByOrganization = `
        SELECT organizationId, SUM(totalcost) AS totalCost,o.name, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        LEFT JOIN organization o ON o.id = dboservices.organizationId
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  AND (dboservices.isRefunded = 0 AND dboservices.status ='active')
        AND serviceCategory ='ORGANIZATION' AND registrationType ='organization' AND organizationId IS NOT NULL
        GROUP BY organizationId;
    `;
BillingAnalyticsWithDate.totalSalesByOutsourcedStatus = `
        SELECT isoutsourced, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY isoutsourced;
    `;
BillingAnalyticsWithDate.totalSalesByBranchAndCategory = `
        SELECT branchid, serviceCategory, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY branchid, serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesByEmployee = `
       SELECT db.employeeid, SUM(db.totalcost) AS totalCost, SUM(db.paidamount) AS totalPaid, SUM(db.totalpayable) AS totalPayable, SUM(db.discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded, rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
        WHERE serviceAddedOn BETWEEN ? AND ? AND db.isRefunded = 0 AND db.status ='active'
        GROUP BY db.employeeid;
    `;
BillingAnalyticsWithDate.monthlySalesTrend = `
       SELECT MONTHNAME(serviceAddedOn) AS month, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints} GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn);
    `;
BillingAnalyticsWithDate.dailySalesTrend = `
        SELECT DATE(serviceAddedOn) AS date, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY date
        ORDER BY date;
    `;
BillingAnalyticsWithDate.weeklySalesTrend = `
     SELECT *
        FROM weekly_sales_summary
    WHERE startDate >= ? AND endDate <= ?
    ORDER BY week;

    `;
BillingAnalyticsWithDate.salesByWeekAndBranch = `
        SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, SUM(db.totalcost) AS totalCost, SUM(db.paidamount) AS totalPaid, SUM(db.totalpayable) AS totalPayable, SUM(db.discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
        WHERE DATE(db.serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY week, db.branchid;
    `;
BillingAnalyticsWithDate.yearlySalesTrend = `
        SELECT YEAR(serviceAddedOn) AS year, SUM(totalcost) AS totalCost, SUM(paidamount) AS totalPaid, SUM(totalpayable) AS totalPayable, SUM(discount) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY year
        ORDER BY year;
    `;
BillingAnalyticsWithDate.totalAmountRefunded = `
        SELECT SUM(r.amountRefunded) AS totalRefunded
        FROM dboservices s
        INNER JOIN dbobillingrefundtable r ON s.serviceid = r.serviceid
        WHERE DATE(s.serviceAddedOn) BETWEEN ? AND ? ${major_constraints};
    `;
