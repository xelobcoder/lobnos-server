"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingAnalyticsWithDate = exports.BillingAnalytics = void 0;
const major_constraints = `AND (dboservices.status IN ('active','refunded')) AND (isDeleted = 0 OR isDeleted IS NULL)`;
class BillingAnalytics {
}
exports.BillingAnalytics = BillingAnalytics;
BillingAnalytics.totalSalesByBranch = `SELECT db.branchid, COALESCE(SUM(db.totalcost), 0) AS totalCost, COALESCE(SUM(db.paidamount), 0) AS totalPaid, COALESCE(SUM(db.totalpayable), 0) AS totalPayable, COALESCE(SUM(db.discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded, b.name FROM dboservices AS db INNER JOIN branch AS b ON db.branchid = b.branchid LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY b.branchid;`;
BillingAnalytics.totalSalesByOrganization = `SELECT organizationId, COALESCE(SUM(totalcost), 0) AS totalCost, COALESCE(SUM(paidamount), 0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded, o.name FROM dboservices AS db INNER JOIN organization AS o ON o.id = db.organizationId LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY db.organizationId;`;
BillingAnalytics.totalSalesByOutsourcedStatus = `SELECT isoutsourced, COALESCE(SUM(totalcost), 0) AS totalCost, COALESCE(SUM(paidamount), 0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY isoutsourced;`;
BillingAnalytics.totalSalesByBranchAndCategory = `SELECT branchid, serviceCategory, COALESCE(SUM(totalcost), 0) AS totalCost, COALESCE(SUM(paidamount), 0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY branchid, serviceCategory;`;
BillingAnalytics.totalSalesByEmployee = `SELECT db.employeeid, COALESCE(SUM(db.totalcost), 0) AS totalCost, COALESCE(SUM(db.paidamount), 0) AS totalPaid, COALESCE(SUM(db.totalpayable), 0) AS totalPayable, COALESCE(SUM(db.discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded,
     rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
     WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY db.employeeid;`;
BillingAnalytics.monthlySalesTrend = `SELECT MONTHNAME(serviceAddedOn) AS month, COALESCE(SUM(totalcost), 0) AS totalCost, COALESCE(SUM(paidamount), 0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn) DESC;`;
BillingAnalytics.dailySalesTrend = `SELECT
    DATE(serviceAddedOn) AS date,
    COALESCE(SUM(totalcost), 0) AS totalCost,
    COALESCE(SUM(paidamount), 0) AS totalPaid,
    COALESCE(SUM(totalpayable), 0) AS totalPayable,
    COALESCE(SUM(discount), 0) AS totalDiscount,
    COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
FROM dboservices
LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
WHERE YEAR(serviceAddedOn) = ? ${major_constraints}
GROUP BY DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn) DESC;
`;
BillingAnalytics.weeklySalesTrend = `
        WITH sales AS (
            SELECT WEEK(serviceAddedOn) AS week,
            COALESCE(SUM(totalcost), 0) AS totalCost,
            COALESCE(SUM(paidamount), 0) AS totalPaid,
            COALESCE(SUM(totalpayable), 0) AS totalPayable,
            COALESCE(SUM(discount), 0) AS totalDiscount,
            COALESCE(SUM(outstanding), 0) AS outstanding_debt,
            COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
            FROM dboservices
            LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
            WHERE YEAR(serviceAddedOn) = ? ${major_constraints}
            GROUP BY WEEK(serviceAddedOn)
        ),
        expenses AS (
            SELECT WEEK(payment_date) AS week, COALESCE(SUM(amount), 0) AS total_expenses
            FROM expense_payments
            WHERE YEAR(payment_date) = ? AND COALESCE(is_reversed, 0) = 0
            GROUP BY WEEK(payment_date)
        )
        SELECT s.week,
        s.totalCost,
        s.totalPaid AS actual_revenue,
        s.totalPayable AS accrued_revenue,
        s.totalDiscount AS total_discount,
        s.totalRefunded,
        COALESCE(e.total_expenses, 0) AS total_expenses,
        (COALESCE(s.totalPaid, 0) - COALESCE(e.total_expenses, 0)) AS net_revenue,
        s.outstanding_debt
        FROM sales s
        LEFT JOIN expenses e ON s.week = e.week
        ORDER BY s.week DESC;
    `;
BillingAnalytics.salesByWeekAndBranch = ` SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, COALESCE(SUM(db.totalcost), 0) AS totalCost, COALESCE(SUM(db.paidamount), 0) AS totalPaid, COALESCE(SUM(db.totalpayable), 0) AS totalPayable, COALESCE(SUM(db.discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
      WHERE YEAR(serviceAddedOn) = ? AND  (db.isRefunded = 0 AND db.status ='active') GROUP BY week, db.branchid ORDER BY week DESC;`;
BillingAnalytics.yearlySalesTrend = `SELECT YEAR(serviceAddedOn) AS year, COALESCE(SUM(totalcost), 0) AS totalCost, COALESCE(SUM(paidamount), 0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY year ORDER BY year DESC;`;
BillingAnalytics.totalAmountRefunded = `SELECT COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded FROM dboservices s INNER JOIN dbobillingrefundtable r ON s.serviceid = r.serviceid WHERE YEAR(s.serviceAddedOn) = ? ${major_constraints};`;
class BillingAnalyticsWithDate {
}
exports.BillingAnalyticsWithDate = BillingAnalyticsWithDate;
BillingAnalyticsWithDate.totalSalesByServiceCategory = `
        SELECT serviceCategory, 
        COALESCE(SUM(totalcost), 0) AS totalCost,
         COALESCE(SUM(paidamount), 0) AS totalPaid, 
         COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  ${major_constraints}
        GROUP BY serviceCategory ORDER BY serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesByBranch = `
        SELECT 
        dboservices.branchid,
    COALESCE(SUM(dboservices.totalcost), 0) AS totalCost, 
        COALESCE(SUM(dboservices.paidamount), 0) actual_revenue,
        COALESCE(SUM(dboservices.totalpayable), 0) AS accrued_revenue,
        COALESCE(SUM(dboservices.discount), 0) AS total_discount,
        COALESCE(SUM(r.amountRefunded), 0) AS total_refunded,
        (
          SELECT SUM(exp.amount) FROM expense_payments AS exp
            WHERE exp.branchid = dboservices.branchid
            AND DATE(exp.payment_date) BETWEEN ? AND ? AND COALESCE(exp.is_reversed, 0) = 0
        ) AS total_expenses,
         COALESCE(SUM(dboservices.paidamount), 0) - (
            SELECT SUM(exp.amount) FROM expense_payments AS exp
            WHERE exp.branchid = dboservices.branchid
            AND DATE(exp.payment_date) BETWEEN ? AND ? AND COALESCE(exp.is_reversed, 0) = 0
        ) AS net_revenue,
         b.name
        FROM dboservices
        LEFT JOIN branch AS b ON dboservices.branchid = b.branchid
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY dboservices.branchid 
    `;
BillingAnalyticsWithDate.totalSalesByOrganization = `
        SELECT organizationId, dboservices.status,
         COALESCE(SUM(totalcost), 0) AS totalCost,
        o.name,
         COALESCE(SUM(paidamount), 0) AS actual_revenue,
        COALESCE(SUM(totalpayable), 0) AS accrued_revenue,
         COALESCE(SUM(discount), 0) AS total_discount,
          COALESCE(SUM(r.amountRefunded), 0) AS total_amount_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        LEFT JOIN organization o ON o.id = dboservices.organizationId
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  ${major_constraints}
        AND serviceCategory ='ORGANIZATION' AND registrationType ='organization' 
        AND organizationId IS NOT NULL
        GROUP BY organizationId;
    `;
BillingAnalyticsWithDate.totalSalesByOutsourcedStatus = `
        SELECT isoutsourced, COALESCE(SUM(totalcost), 0) AS totalCost, COALESCE(SUM(paidamount), 0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable, COALESCE(SUM(discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY isoutsourced;
    `;
BillingAnalyticsWithDate.totalSalesByBranchAndCategory = `
        SELECT branchid,
         serviceCategory,
         COALESCE(SUM(totalcost),
         0) AS totalCost,
         COALESCE(SUM(paidamount),
         0) AS totalPaid, COALESCE(SUM(totalpayable), 0) AS totalPayable,
          COALESCE(SUM(discount), 0) AS totalDiscount,
           COALESCE(SUM(r.amountRefunded), 0)
            AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY branchid, serviceCategory;
    `;
BillingAnalyticsWithDate.totalSalesByEmployee = `
        SELECT
            dboservices.employeeid,
            dboservices.status,
            COUNT(*) AS totalServicesRendered,
            COALESCE(SUM(dboservices.totalcost), 0) AS totalCost,
            COALESCE(SUM(dboservices.paidamount), 0) AS actual_revenue,
            COALESCE(SUM(dboservices.totalpayable), 0) AS accrued_revenue,
            COALESCE(SUM(dboservices.discount), 0) AS total_discount,
            COALESCE(SUM(r.amountRefunded), 0) AS total_amount_refunded,
            rr.username
        FROM dboservices
        JOIN roles AS rr ON rr.employeeid = dboservices.employeeid
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY dboservices.employeeid;
    `;
BillingAnalyticsWithDate.monthlySalesTrend = `
       WITH sales AS (
        SELECT MONTHNAME(serviceAddedOn) AS month,
        COALESCE(SUM(totalcost), 0) AS totalCost, 
        COALESCE(SUM(paidamount), 0) AS totalPaid, 
        COALESCE(SUM(totalpayable), 0) AS totalPayable,
        COALESCE(SUM(discount), 0) AS totalDiscount, 
        COALESCE(SUM(outstanding), 0) AS outstanding_debt,
        COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE YEAR(serviceAddedOn) = ? ${major_constraints} 
        GROUP BY MONTH(serviceAddedOn)
    ),
            expenses AS (
                SELECT MONTHNAME(DATE_SUB(payment_date, INTERVAL DAYOFMONTH(payment_date)-1 DAY)) AS month, COALESCE(SUM(amount), 0) AS total_expenses
                FROM expense_payments
                WHERE YEAR(payment_date) = ? AND COALESCE(is_reversed, 0) = 0
                GROUP BY MONTH(payment_date)
            )
            SELECT s.month, 
            s.totalCost, 
            s.totalPaid AS actual_revenue, 
            s.totalPayable AS accrued_revenue, 
            s.totalDiscount AS total_discount,
            s.totalRefunded,
            COALESCE(e.total_expenses, 0) AS total_expenses,
            (COALESCE(s.totalPaid, 0) - COALESCE(e.total_expenses, 0)) AS net_revenue,
            s.outstanding_debt
            FROM sales s
            LEFT JOIN expenses e ON s.month = e.month
            ORDER BY FIELD(s.month, 'December', 'November', 'October', 'September', 'August', 'July', 'June', 'May', 'April', 'March', 'February', 'January');
    `;
BillingAnalyticsWithDate.dailySalesTrend = `
    WITH sales AS (
        SELECT DATE(serviceAddedOn) AS date, 
        COALESCE(SUM(totalcost), 0) AS totalCost, 
        COALESCE(SUM(paidamount), 0) AS totalPaid, 
        COALESCE(SUM(totalpayable), 0) AS totalPayable, 
        COALESCE(SUM(discount), 0) AS totalDiscount, 
        COALESCE(SUM(outstanding), 0) AS outstanding_debt,
        COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY DATE(serviceAddedOn)
    ),
    expenses AS (
        SELECT DATE(payment_date) AS date, 
        COALESCE(SUM(amount), 0) AS total_expenses
        FROM expense_payments
        WHERE DATE(payment_date) BETWEEN ? AND ? AND COALESCE(is_reversed, 0) = 0
        GROUP BY DATE(payment_date)
    )
            SELECT s.date, 
            s.totalCost, 
            s.totalPaid AS actual_revenue, 
            s.totalPayable AS accrued_revenue, 
            s.totalDiscount AS total_discount,
            s.totalRefunded,
            COALESCE(e.total_expenses, 0) AS total_expenses,
            (COALESCE(s.totalPaid, 0) - COALESCE(e.total_expenses, 0)) AS net_revenue,
            s.outstanding_debt
            FROM sales s
            LEFT JOIN expenses e ON s.date = e.date
            ORDER BY s.date DESC;
    `;
BillingAnalyticsWithDate.weeklySalesTrend = `
     SELECT *
        FROM weekly_sales_summary
    WHERE startDate >= ? AND endDate <= ?
    ORDER BY week DESC;

    `;
BillingAnalyticsWithDate.salesByWeekAndBranch = `
        SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, COALESCE(SUM(db.totalcost), 0) AS totalCost, COALESCE(SUM(db.paidamount), 0) AS totalPaid, COALESCE(SUM(db.totalpayable), 0) AS totalPayable, COALESCE(SUM(db.discount), 0) AS totalDiscount, COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
        WHERE DATE(db.serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY week, db.branchid ORDER BY week DESC;
    `;
BillingAnalyticsWithDate.yearlySalesTrend = `
        WITH sales AS (
            SELECT YEAR(serviceAddedOn) AS year,
            COALESCE(SUM(totalcost), 0) AS totalCost,
            COALESCE(SUM(paidamount), 0) AS totalPaid,
            COALESCE(SUM(totalpayable), 0) AS totalPayable,
            COALESCE(SUM(discount), 0) AS totalDiscount,
            COALESCE(SUM(outstanding), 0) AS outstanding_debt,
            COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
            FROM dboservices
            LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
            WHERE dboservices.status IN ('active','refunded')
            GROUP BY YEAR(serviceAddedOn)
        ),
        expenses AS (
            SELECT YEAR(payment_date) AS year, COALESCE(SUM(amount), 0) AS total_expenses
            FROM expense_payments
            WHERE COALESCE(is_reversed, 0) = 0
            GROUP BY YEAR(payment_date)
        )
        SELECT s.year,
        s.totalCost,
        s.totalPaid AS actual_revenue,
        s.totalPayable AS accrued_revenue,
        s.totalDiscount AS total_discount,
        s.totalRefunded,
        COALESCE(e.total_expenses, 0) AS total_expenses,
        (COALESCE(s.totalPaid, 0) - COALESCE(e.total_expenses, 0)) AS net_revenue,
        s.outstanding_debt
        FROM sales s
        LEFT JOIN expenses e ON s.year = e.year
        ORDER BY s.year DESC;
    `;
BillingAnalyticsWithDate.totalAmountRefunded = `
        SELECT COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices s
        INNER JOIN dbobillingrefundtable r ON s.serviceid = r.serviceid
        WHERE DATE(s.serviceAddedOn) BETWEEN ? AND ? ${major_constraints};
    `;
BillingAnalyticsWithDate.hourlySalesTrend = `
    WITH sales AS (
        SELECT HOUR(serviceAddedOn) AS hour, 
        COALESCE(SUM(totalcost), 0) AS totalCost, 
        COALESCE(SUM(paidamount), 0) AS totalPaid, 
        COALESCE(SUM(totalpayable), 0) AS totalPayable, 
        COALESCE(SUM(discount), 0) AS totalDiscount, 
        COALESCE(SUM(outstanding), 0) AS outstanding_debt,
        COALESCE(SUM(r.amountRefunded), 0) AS totalRefunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY HOUR(serviceAddedOn)
    ),
    expenses AS (
        SELECT HOUR(payment_date) AS hour, COALESCE(SUM(amount), 0) AS total_expenses
        FROM expense_payments
        WHERE DATE(payment_date) BETWEEN ? AND ? AND COALESCE(is_reversed, 0) = 0
        GROUP BY HOUR(payment_date)
    )
    SELECT s.hour, 
    s.totalCost, 
    s.totalPaid AS actual_revenue, 
    s.totalPayable AS accrued_revenue, 
    s.totalDiscount AS total_discount,
    s.totalRefunded,
    COALESCE(e.total_expenses, 0) AS total_expenses,
    (COALESCE(s.totalPaid, 0) - COALESCE(e.total_expenses, 0)) AS net_revenue,
    s.outstanding_debt
    FROM sales s
    LEFT JOIN expenses e ON s.hour = e.hour
    ORDER BY s.hour DESC;
`;
