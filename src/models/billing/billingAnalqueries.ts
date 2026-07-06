const major_constraints = `AND (dboservices.status IN ('active','refunded','written-off')) AND (isDeleted = 0 OR isDeleted IS NULL)`;

export class BillingAnalytics {
    public static totalSalesByBranch = `SELECT db.branchid, COALESCE(SUM(db.totalcost), 0) AS gross_revenue, COALESCE(SUM(db.paidamount), 0) AS cash_collected, COALESCE(SUM(db.totalpayable), 0) AS earned_revenue, COALESCE(SUM(db.discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded, b.name FROM dboservices AS db INNER JOIN branch AS b ON db.branchid = b.branchid LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY b.branchid;`;
    public static totalSalesByOrganization = `SELECT organizationId, COALESCE(SUM(totalcost), 0) AS gross_revenue, COALESCE(SUM(db.paidamount), 0) AS cash_collected, COALESCE(SUM(totalpayable), 0) AS earned_revenue, COALESCE(SUM(discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded, 
    COUNT(CASE WHEN serviceCategory = 'ORGANIZATION' THEN 1 END) AS organization_services_count,
    COUNT(CASE WHEN serviceCategory = 'NHIS' THEN 1 END) AS nhis_services_count,
    COUNT(*) AS total_services_rendered,
    o.name FROM dboservices AS db INNER JOIN organization AS o ON o.id = db.organizationId LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY db.organizationId;`;
    public static totalSalesByOutsourcedStatus = `SELECT isoutsourced, 
    COALESCE(SUM(totalcost), 0) AS gross_revenue,
     COALESCE(SUM(paidamount), 0) AS cash_collected,
      COALESCE(SUM(totalpayable), 0) AS earned_revenue,
       COALESCE(SUM(discount), 0) AS discount,
        COALESCE(SUM(dboservices.outstanding), 0) AS outstanding,
         COALESCE(SUM(r.amountRefunded), 0) AS total_refunded 
         FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid 
         WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY isoutsourced;`;
    public static totalSalesByBranchAndCategory = `SELECT branchid, serviceCategory, COALESCE(SUM(totalcost), 0) AS gross_revenue, COALESCE(SUM(paidamount), 0) AS cash_collected, COALESCE(SUM(totalpayable), 0) AS earned_revenue, COALESCE(SUM(discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY branchid, serviceCategory;`;
    public static totalSalesByEmployee = `SELECT db.employeeid, COALESCE(SUM(db.totalcost), 0) AS gross_revenue, COALESCE(SUM(db.paidamount), 0) AS cash_collected, COALESCE(SUM(db.totalpayable), 0) AS earned_revenue, COALESCE(SUM(db.discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded,
     rr.username FROM dboservices AS db JOIN roles AS rr ON rr.employeeid = db.employeeid LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
     WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY db.employeeid;`;
    public static totalSalesByClinician = `SELECT db.clinicianId, db.status, COUNT(*) AS totalServicesRendered, COALESCE(SUM(db.totalcost), 0) AS gross_revenue, COALESCE(SUM(db.paidamount), 0) AS cash_collected, COALESCE(SUM(db.totalpayable), 0) AS earned_revenue, COALESCE(SUM(db.discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded, c.name FROM dboservices AS db JOIN clinicianbasicinfo AS c ON c.id = db.clinicianId LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid WHERE YEAR(db.serviceAddedOn) = ? ${major_constraints} GROUP BY db.clinicianId;`;
    public static monthlySalesTrend = `SELECT MONTHNAME(serviceAddedOn) AS month, COALESCE(SUM(totalcost), 0) AS gross_revenue, COALESCE(SUM(paidamount), 0) AS cash_collected, COALESCE(SUM(totalpayable), 0) AS earned_revenue, COALESCE(SUM(discount), 0) AS discount, COALESCE(SUM(dboservices.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY MONTH(serviceAddedOn) ORDER BY MONTH(serviceAddedOn) DESC;`;
    public static dailySalesTrend = `SELECT
    DATE(serviceAddedOn) AS date,
    COALESCE(SUM(totalcost), 0) AS gross_revenue,
    COALESCE(SUM(paidamount), 0) AS cash_collected,
    COALESCE(SUM(totalpayable), 0) AS earned_revenue,
    COALESCE(SUM(discount), 0) AS discount,
    COALESCE(SUM(outstanding), 0) AS outstanding,
    COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
FROM dboservices
LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
WHERE YEAR(serviceAddedOn) = ? ${major_constraints}
GROUP BY DATE(serviceAddedOn)
ORDER BY DATE(serviceAddedOn) DESC;
`;
    public static weeklySalesTrend = `
        WITH sales AS (
            SELECT WEEK(serviceAddedOn) AS week,
            COALESCE(SUM(totalcost), 0) AS gross_revenue,
            COALESCE(SUM(paidamount), 0) AS cash_collected,
            COALESCE(SUM(totalpayable), 0) AS earned_revenue,
            COALESCE(SUM(discount), 0) AS discount,
            COALESCE(SUM(outstanding), 0) AS outstanding,
            COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
            FROM dboservices
            LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
            WHERE YEAR(serviceAddedOn) = ? ${major_constraints}
            GROUP BY WEEK(serviceAddedOn)
        ),
        expenses AS (
            SELECT WEEK(payment_date) AS week, COALESCE(SUM(amount), 0) AS expenses_paid
            FROM expense_payments
            WHERE YEAR(payment_date) = ? AND COALESCE(is_reversed, 0) = 0 AND status = 'Paid'
            GROUP BY WEEK(payment_date)
        )
        SELECT s.week,
        s.gross_revenue,
        s.cash_collected,
        s.earned_revenue,
        s.discount,
        s.total_refunded,
        COALESCE(e.expenses_paid, 0) AS expenses_paid,
        (COALESCE(s.cash_collected, 0) - COALESCE(e.expenses_paid, 0)) AS net_operating_cash,
        s.outstanding
        FROM sales s
        LEFT JOIN expenses e ON s.week = e.week
        ORDER BY s.week DESC;
    `;
    public static salesByWeekAndBranch = ` SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, COALESCE(SUM(db.totalcost), 0) AS gross_revenue, COALESCE(SUM(db.paidamount), 0) AS cash_collected, COALESCE(SUM(db.totalpayable), 0) AS earned_revenue, COALESCE(SUM(db.discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
      WHERE YEAR(serviceAddedOn) = ? AND  (db.isRefunded = 0 AND db.status ='active') GROUP BY week, db.branchid ORDER BY week DESC;`;
    public static yearlySalesTrend = `SELECT YEAR(serviceAddedOn) AS year, COALESCE(SUM(totalcost), 0) AS gross_revenue, COALESCE(SUM(paidamount), 0) AS cash_collected, COALESCE(SUM(totalpayable), 0) AS earned_revenue, COALESCE(SUM(discount), 0) AS discount, COALESCE(SUM(dboservices.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded FROM dboservices LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid WHERE YEAR(serviceAddedOn) = ? ${major_constraints} GROUP BY year ORDER BY year DESC;`;
    public static totalAmountRefunded = `SELECT COALESCE(SUM(r.amountRefunded), 0) AS total_refunded FROM dboservices s INNER JOIN dbobillingrefundtable r ON s.serviceid = r.serviceid WHERE YEAR(s.serviceAddedOn) = ? ${major_constraints};`;
}

export class BillingAnalyticsWithDate {
    public static totalSalesByServiceCategory = `
        SELECT serviceCategory, 
        COALESCE(SUM(totalcost), 0) AS gross_revenue,
         COALESCE(SUM(paidamount), 0) AS cash_collected, 
         COALESCE(SUM(totalpayable), 0) AS earned_revenue, COALESCE(SUM(discount), 0) AS discount, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  ${major_constraints}
        GROUP BY serviceCategory ORDER BY serviceCategory;
    `;

    public static totalSalesByBranch = `
        SELECT 
        dboservices.branchid,
    COALESCE(SUM(dboservices.totalcost), 0) AS gross_revenue, 
        COALESCE(SUM(dboservices.paidamount), 0) as cash_collected,
        COALESCE(SUM(dboservices.outstanding), 0) AS outstanding,
        COALESCE(SUM(dboservices.totalpayable), 0) AS earned_revenue,
        COALESCE(SUM(dboservices.discount), 0) AS discount,
        COALESCE(SUM(r.amountRefunded), 0) AS total_refunded,
        (
          SELECT SUM(exp.amount) FROM expense_payments AS exp
            WHERE exp.branchid = dboservices.branchid
            AND DATE(exp.payment_date) BETWEEN ? AND ? AND COALESCE(exp.is_reversed, 0) = 0 AND exp.status = 'Paid'
        ) AS expenses_paid,
         COALESCE(SUM(dboservices.paidamount), 0) - (
            SELECT SUM(exp.amount) FROM expense_payments AS exp
            WHERE exp.branchid = dboservices.branchid
            AND DATE(exp.payment_date) BETWEEN ? AND ? AND COALESCE(exp.is_reversed, 0) = 0 AND exp.status = 'Paid'
        ) AS net_operating_cash,
         b.name
        FROM dboservices
        LEFT JOIN branch AS b ON dboservices.branchid = b.branchid
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY dboservices.branchid 
    `;

    public static totalSalesByOrganization = `
        SELECT organizationId, dboservices.status,
         COALESCE(SUM(totalcost), 0) AS gross_revenue,
        o.name,
         COALESCE(SUM(paidamount), 0) AS cash_collected,
        COALESCE(SUM(totalpayable), 0) AS earned_revenue,
         COALESCE(SUM(discount), 0) AS discount,
          COALESCE(SUM(r.amountRefunded), 0) AS total_refunded,
          COUNT(CASE WHEN serviceCategory = 'ORGANIZATION' THEN 1 END) AS organization_services_count,
          COUNT(CASE WHEN serviceCategory = 'NHIS' THEN 1 END) AS nhis_services_count,
          COUNT(*) AS total_services_rendered
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        LEFT JOIN organization o ON o.id = dboservices.organizationId
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ?  ${major_constraints}
        AND ((serviceCategory ='ORGANIZATION' AND registrationType ='organization') OR (serviceCategory='NHIS' AND organizationId IS NOT NULL AND clinicianId IS NULL )) 
        AND organizationId IS NOT NULL
        GROUP BY organizationId;
    `;

    public static totalSalesByOutsourcedStatus = `
        SELECT isoutsourced, COALESCE(SUM(totalcost), 0) AS gross_revenue, 
        COALESCE(SUM(paidamount), 0) AS cash_collected,
         COALESCE(SUM(totalpayable), 0) AS earned_revenue, 
         COALESCE(SUM(discount), 0) AS discount, 
         COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY isoutsourced;
    `;

    public static totalSalesByBranchAndCategory = `
        SELECT branchid,
         serviceCategory,
         COALESCE(SUM(totalcost),
         0) AS gross_revenue,
         COALESCE(SUM(paidamount),
         0) AS cash_collected, COALESCE(SUM(totalpayable), 0) AS earned_revenue,
          COALESCE(SUM(discount), 0) AS discount,
           COALESCE(SUM(r.amountRefunded), 0)
            AS total_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY branchid, serviceCategory;
    `;

    public static totalSalesByEmployee = `
        SELECT
            dboservices.employeeid,
            dboservices.status,
            COUNT(*) AS totalServicesRendered,
            COALESCE(SUM(dboservices.totalcost), 0) AS gross_revenue,
            COALESCE(SUM(dboservices.paidamount), 0) AS cash_collected,
            COALESCE(SUM(dboservices.totalpayable), 0) AS earned_revenue,
            COALESCE(SUM(dboservices.discount), 0) AS discount,
            COALESCE(SUM(r.amountRefunded), 0) AS total_refunded,
            rr.username
        FROM dboservices
        JOIN roles AS rr ON rr.employeeid = dboservices.employeeid
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY dboservices.employeeid;
    `;

    public static totalSalesByClinician = `
        SELECT
            dboservices.clinicianId,
            dboservices.status,
            COUNT(*) AS totalServicesRendered,
            COALESCE(SUM(dboservices.totalcost), 0) AS gross_revenue,
            COALESCE(SUM(dboservices.paidamount), 0) AS cash_collected,
            COALESCE(SUM(dboservices.totalpayable), 0) AS earned_revenue,
            COALESCE(SUM(dboservices.discount), 0) AS discount,
            COALESCE(SUM(r.amountRefunded), 0) AS total_refunded,
            c.name AS clinician_name
        FROM dboservices
        JOIN clinicianbasicinfo AS c ON c.id = dboservices.clinicianId
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY dboservices.clinicianId;
    `;

    public static monthlySalesTrend = `
       WITH sales AS (
        SELECT MONTHNAME(serviceAddedOn) AS month,
        COALESCE(SUM(totalcost), 0) AS gross_revenue, 
        COALESCE(SUM(paidamount), 0) AS cash_collected, 
        COALESCE(SUM(totalpayable), 0) AS earned_revenue,
        COALESCE(SUM(discount), 0) AS discount, 
        COALESCE(SUM(outstanding), 0) AS outstanding,
        COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE YEAR(serviceAddedOn) = ? ${major_constraints} 
        GROUP BY MONTH(serviceAddedOn)
    ),
            expenses AS (
                SELECT MONTHNAME(DATE_SUB(payment_date, INTERVAL DAYOFMONTH(payment_date)-1 DAY)) AS month, COALESCE(SUM(amount), 0) AS expenses_paid
                FROM expense_payments
                WHERE YEAR(payment_date) = ? AND COALESCE(is_reversed, 0) = 0 AND status = 'Paid'
                GROUP BY MONTH(payment_date)
            )
            SELECT s.month, 
            s.gross_revenue, 
            s.cash_collected, 
            s.earned_revenue, 
            s.discount,
            s.total_refunded,
            COALESCE(e.expenses_paid, 0) AS expenses_paid,
            (COALESCE(s.cash_collected, 0) - COALESCE(e.expenses_paid, 0)) AS net_operating_cash,
            s.outstanding
            FROM sales s
            LEFT JOIN expenses e ON s.month = e.month
            ORDER BY FIELD(s.month, 'December', 'November', 'October', 'September', 'August', 'July', 'June', 'May', 'April', 'March', 'February', 'January');
    `;

    public static dailySalesTrend = `
    WITH sales AS (
        SELECT DATE(serviceAddedOn) AS date, 
        COALESCE(SUM(totalcost), 0) AS gross_revenue, 
        COALESCE(SUM(paidamount), 0) AS cash_collected, 
        COALESCE(SUM(totalpayable), 0) AS earned_revenue, 
        COALESCE(SUM(discount), 0) AS discount, 
        COALESCE(SUM(outstanding), 0) AS outstanding,
        COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY DATE(serviceAddedOn)
    ),
    expenses AS (
        SELECT DATE(payment_date) AS date, 
        COALESCE(SUM(amount), 0) AS expenses_paid
        FROM expense_payments
        WHERE DATE(payment_date) BETWEEN ? AND ? AND COALESCE(is_reversed, 0) = 0 AND status = 'Paid'
        GROUP BY DATE(payment_date)
    )
            SELECT s.date, 
            s.gross_revenue, 
            s.cash_collected, 
            s.earned_revenue, 
            s.discount,
            s.total_refunded,
            COALESCE(e.expenses_paid, 0) AS expenses_paid,
            (COALESCE(s.cash_collected, 0) - COALESCE(e.expenses_paid, 0)) AS net_operating_cash,
            s.outstanding
            FROM sales s
            LEFT JOIN expenses e ON s.date = e.date
            ORDER BY s.date DESC;
    `;

    public static weeklySalesTrend = `
     SELECT *
        FROM weekly_sales_summary
    WHERE startDate >= ? AND endDate <= ?
    ORDER BY week DESC;

    `;

    public static salesByWeekAndBranch = `
        SELECT WEEK(db.serviceAddedOn) AS week, db.branchid, COALESCE(SUM(db.totalcost), 0) AS gross_revenue, COALESCE(SUM(db.paidamount), 0) AS cash_collected, COALESCE(SUM(db.totalpayable), 0) AS earned_revenue, COALESCE(SUM(db.discount), 0) AS discount, COALESCE(SUM(db.outstanding), 0) AS outstanding, COALESCE(SUM(r.amountRefunded), 0) AS total_refunded ,bb.name
        FROM dboservices AS db
        INNER JOIN branch AS bb ON bb.branchid = db.branchid
        LEFT JOIN dbobillingrefundtable r ON db.serviceid = r.serviceid
        WHERE DATE(db.serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY week, db.branchid ORDER BY week DESC;
    `;

    public static yearlySalesTrend = `
        WITH sales AS (
            SELECT YEAR(serviceAddedOn) AS year,
            COALESCE(SUM(totalcost), 0) AS gross_revenue,
            COALESCE(SUM(paidamount), 0) AS cash_collected,
            COALESCE(SUM(totalpayable), 0) AS earned_revenue,
            COALESCE(SUM(discount), 0) AS discount,
            COALESCE(SUM(outstanding), 0) AS outstanding,
            COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
            FROM dboservices
            LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
            WHERE dboservices.status IN ('active','refunded','written-off') AND (isDeleted = 0 OR isDeleted IS NULL)
            GROUP BY YEAR(serviceAddedOn)
        ),
        expenses AS (
            SELECT YEAR(payment_date) AS year, COALESCE(SUM(amount), 0) AS expenses_paid
            FROM expense_payments
            WHERE COALESCE(is_reversed, 0) = 0 AND status = 'Paid'
            GROUP BY YEAR(payment_date)
        )
        SELECT s.year,
        s.gross_revenue,
        s.cash_collected,
        s.earned_revenue,
        s.discount,
        s.total_refunded,
        COALESCE(e.expenses_paid, 0) AS expenses_paid,
        (COALESCE(s.cash_collected, 0) - COALESCE(e.expenses_paid, 0)) AS net_operating_cash,
        s.outstanding
        FROM sales s
        LEFT JOIN expenses e ON s.year = e.year
        ORDER BY s.year DESC;
    `;
    public static totalAmountRefunded = `
        SELECT COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
        FROM dboservices s
        INNER JOIN dbobillingrefundtable r ON s.serviceid = r.serviceid
        WHERE DATE(s.serviceAddedOn) BETWEEN ? AND ? ${major_constraints};
    `;

    public static hourlySalesTrend = `
    WITH sales AS (
        SELECT HOUR(serviceAddedOn) AS hour, 
        COALESCE(SUM(totalcost), 0) AS gross_revenue, 
        COALESCE(SUM(paidamount), 0) AS cash_collected, 
        COALESCE(SUM(totalpayable), 0) AS earned_revenue, 
        COALESCE(SUM(discount), 0) AS discount, 
        COALESCE(SUM(outstanding), 0) AS outstanding,
        COALESCE(SUM(r.amountRefunded), 0) AS total_refunded
        FROM dboservices
        LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
        WHERE DATE(serviceAddedOn) BETWEEN ? AND ? ${major_constraints}
        GROUP BY HOUR(serviceAddedOn)
    ),
    expenses AS (
        SELECT HOUR(payment_date) AS hour, COALESCE(SUM(amount), 0) AS expenses_paid
        FROM expense_payments
        WHERE DATE(payment_date) BETWEEN ? AND ? AND COALESCE(is_reversed, 0) = 0 AND status = 'Paid'
        GROUP BY HOUR(payment_date)
    )
    SELECT s.hour, 
    s.gross_revenue, 
    s.cash_collected, 
    s.earned_revenue, 
    s.discount,
    s.total_refunded,
    COALESCE(e.expenses_paid, 0) AS expenses_paid,
    (COALESCE(s.cash_collected, 0) - COALESCE(e.expenses_paid, 0)) AS net_operating_cash,
    s.outstanding
    FROM sales s
    LEFT JOIN expenses e ON s.hour = e.hour
    ORDER BY s.hour DESC;
`;
}
