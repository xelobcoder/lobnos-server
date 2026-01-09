const major_constraints = `dboservices.serviceAddedOn IS NOT NULL AND dboservices.status IN('refunded','active'
)`

export const QUERY_DAILY_CEO_SNAPSHOT = `
 SELECT 
            COALESCE(SUM(totalcost), 0) AS totalCost,
            COALESCE(SUM(paidamount), 0) AS actual_revenue,
            COALESCE(SUM(totalpayable), 0) AS accrued_revenue,
            COALESCE(SUM(discount), 0) AS total_discount,
            COALESCE(SUM(outstanding), 0) AS outstanding_debt,
            COALESCE(SUM(r.amountRefunded), 0) AS total_refunds,
            (SELECT COALESCE(SUM(amount), 0) FROM expense_payments WHERE DATE(payment_date) BETWEEN ? AND ?) AS total_expense_payments,
            COUNT(dboservices.serviceid) AS total_tests_conducted,
            COALESCE(SUM(paidamount), 0) - (SELECT COALESCE(SUM(amount), 0) FROM expense_payments WHERE DATE(payment_date) BETWEEN ? AND ?) AS net_revenue
            FROM dboservices
            LEFT JOIN dbobillingrefundtable r ON dboservices.serviceid = r.serviceid
            WHERE DATE(dboservices.serviceAddedOn) BETWEEN ? AND ? AND ${major_constraints}
`;


export const QUERY_NIGHT_ADJUSTMENT_IMPACT = `
SELECT
    CAST(dboservices.serviceAddedOn AS DATE) AS report_date,
    SUM(dboservices.totalpayable) AS accrued_revenue,
    SUM(CASE
            WHEN dboservices.hasNightAdjustment = 1 THEN dboservices.totalpayable
            ELSE 0
        END) AS total_night_adjustment_payable,
    SUM(CASE
            WHEN dboservices.hasNightAdjustment = 0 THEN dboservices.totalpayable
            ELSE 0
        END) AS total_normal_payable,
    COUNT(CASE WHEN dboservices.hasNightAdjustment = 1 THEN 1 END) AS night_adjustment_cases_count,
    COUNT(CASE WHEN dboservices.hasNightAdjustment = 0 THEN 1 END) AS normal_cases_count,
    COUNT(*) AS total_cases
FROM dboservices
WHERE DATE(dboservices.serviceAddedOn) BETWEEN ? AND ? AND ${major_constraints}
GROUP BY report_date
ORDER BY report_date DESC
`;

export const QUERY_TEST_TRANSACTION_SNAPSHOT = `
SELECT
    dboservices.serviceAddedOn AS serviceAddedOn,
    CAST(dboservices.serviceAddedOn AS DATE) AS test_date,
    dboservices.trackId AS trackId,
    dboservices.serviceCategory AS serviceCategory,
    CASE
        WHEN dboservices.serviceCategory = 'SERVICES' THEN ads.serviceName
        ELSE tp.name
    END AS test_panel_name,
    COUNT(dboservices.serviceid) AS test_count,
    SUM(dboservices.totalpayable) AS accrued_revenue,
    SUM(dboservices.paidamount) AS actual_revenue,
    SUM(dboservices.discount) AS total_discount,
    SUM(dboservices.outstanding) AS total_outstanding,
    SUM(dboservices.totalcost) AS total_cost,
    SUM(dbobillingrefundtable.amountRefunded) AS total_refunds
    FROM dboservices 
    LEFT JOIN test_panels tp
        ON dboservices.serviceCategory <> 'SERVICES' AND tp.id = dboservices.trackId
    LEFT JOIN additionalservices ads
        ON dboservices.serviceCategory = 'SERVICES' AND dboservices.trackId = ads.keyid
    LEFT JOIN dbobillingrefundtable 
        ON dboservices.serviceid = dbobillingrefundtable.serviceid
    LEFT JOIN roles r
        ON dboservices.employeeid = r.employeeid
    WHERE DATE(dboservices.serviceAddedOn) BETWEEN ? AND ?  AND  ${major_constraints}
    GROUP BY
        dboservices.trackId,
        dboservices.serviceAddedOn,
        dboservices.serviceCategory,
        tp.name,
        ads.serviceName
    ORDER BY
        dboservices.serviceAddedOn,
    dboservices.trackId DESC
`;

export const QUERY_TOP_PERFORMING_BRANCHES = `
    SELECT
        dboservices.branchid,
        SUM(dboservices.totalpayable) AS accrued_revenue,
        SUM(dboservices.paidamount) AS actual_revenue,
        SUM(dboservices.discount) AS total_discount,
        SUM(dboservices.outstanding) AS total_outstanding,
        COUNT(dboservices.serviceid) AS total_tests,
        SUM(dbobillingrefundtable.amountRefunded) AS total_refunds,
        branch.name AS branchname
    FROM dboservices 
    INNER JOIN branch ON branch.branchid = dboservices.branchid
    LEFT JOIN dbobillingrefundtable 
        ON dboservices.serviceid = dbobillingrefundtable.serviceid
    WHERE DATE(dboservices.serviceAddedOn) BETWEEN ? AND ?
    AND ${major_constraints}
    GROUP BY dboservices.branchid
    ORDER BY DATE(dboservices.serviceAddedOn) DESC
    ;`


export const QUERY_MISMATCHED_PAYMENT_HISTORY = `
    SELECT
        b.billingid,
        b.paid AS paid_in_billing,
        (
            SELECT COALESCE(SUM(bh.Amount), 0)
            FROM billinghx bh
            WHERE bh.Billingid = b.billingid
        ) AS total_in_billinghx,
        (
            b.paid - (
                SELECT COALESCE(SUM(bh.Amount), 0)
                FROM billinghx bh
                WHERE bh.Billingid = b.billingid
            )
        ) AS difference
    FROM billing b
    WHERE DATE(b.billedon) BETWEEN ? AND ?
    AND b.status != 'voided'
    AND (b.adjustmentType IS NULL OR b.adjustmentType != 'void')
    HAVING difference != 0
`;

export const QUERY_BREAK_DOWN_PAYMENT_MODES = `
    SELECT
        pm.PaymentMode AS mode,
        COUNT(*) AS total_transactions,
        SUM(bh.Amount) AS total_amount
    FROM billinghx bh
    JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
    WHERE DATE(bh.Date) BETWEEN ? AND ?
    GROUP BY pm.PaymentMode
    ORDER BY total_amount DESC
`;

export const QUERY_EMPLOYEES_COLLECTED_CASH = `
    SELECT
        r.username,
        COUNT(*) AS total_transactions,
        SUM(bh.Amount) AS total_amount,
        bh.Date AS payment_date
    FROM billinghx bh
    JOIN paymentmodes pm ON bh.PaymentMode = pm.KeyID
    JOIN roles r ON r.employeeid = bh.employeeid
    WHERE DATE(bh.Date) BETWEEN ? AND ?
    GROUP BY DATE(bh.Date), r.username
    ORDER BY DATE(bh.Date) DESC
`;

export const CLINCIAN_SALES_PAYMENT = `
    SELECT
        CAST(s.serviceAddedOn AS DATE) AS sale_date,
        c.id AS clinician_id,
        c.name AS clinician_name,
        c.phone AS clinician_phone,
        c.occupation AS occupation,
        c.organization AS organization,
        COUNT(0) AS total_services,
        SUM(s.totalcost) AS total_value,
        SUM(CASE WHEN s.categoryTrackId = 6 THEN 1 ELSE 0 END) AS additional_services_count,
        SUM(CASE WHEN s.categoryTrackId <> 6 THEN 1 ELSE 0 END) AS test_panels_count
    FROM dboservices s
    JOIN clinicianbasicinfo c ON s.clinicianId = c.id
    WHERE s.clinicianId <> 0
    AND s.serviceAddedOn IS NOT NULL
    AND s.totalcost > 0
    AND DATE(s.serviceAddedOn) BETWEEN ? AND ?
    GROUP BY
        CAST(s.serviceAddedOn AS DATE),
        c.id,
        c.name,
        c.phone,
        c.occupation,
        c.organization
    ORDER BY
        CAST(s.serviceAddedOn AS DATE) DESC,
        SUM(s.totalcost) DESC
`;


// EXPENSE QUERIES FOR CEO DASHBOARD

export const QUERY_TOTAL_EXPENSES_PERIOD_COMPARISON = `
SELECT 
    'Selected Period' AS period,
    COUNT(*) AS expense_count,
    COALESCE(SUM(amount), 0) AS total_expenses
FROM expensesrecord 
WHERE date BETWEEN ? AND ?

UNION ALL

SELECT 
    'Previous Period' AS period,
    COUNT(*) AS expense_count,
    COALESCE(SUM(amount), 0) AS total_expenses
FROM expensesrecord 
WHERE date BETWEEN DATE_SUB(?, INTERVAL DATEDIFF(?, ?) + 1 DAY)
              AND DATE_SUB(?, INTERVAL 1 DAY)
`;

export const QUERY_ALL_EXPENSE_CATEGORIES = `
SELECT 
    c.category,
    COUNT(e.id) AS expense_count,
    SUM(e.amount) AS total_amount,
    ROUND(SUM(e.amount) * 100.0 / totals.total, 2) AS percentage_of_total
FROM expensesrecord e
JOIN dboexpensecategory c ON e.category = c.id
CROSS JOIN (
    SELECT COALESCE(SUM(amount), 0) AS total 
    FROM expensesrecord 
    WHERE date BETWEEN ? AND ?
) totals
WHERE e.date BETWEEN ? AND ?
GROUP BY c.id, c.category, totals.total
ORDER BY total_amount DESC
`;

export const QUERY_EXPENSE_APPROVAL_STATUS_SUMMARY = `
SELECT 
    CASE WHEN approved = 1 THEN 'Approved' ELSE 'Pending' END AS status,
    COUNT(*) AS expense_count,
    SUM(amount) AS total_amount
FROM expensesrecord
WHERE date BETWEEN ? AND ?
GROUP BY approved
`;

export const QUERY_EXPENSE_PAYMENTS_SUMMARY = `
SELECT 
    p.status,
    p.method,
    em.name AS merchant_name,
    COUNT(*) AS payments_made,
    COUNT(DISTINCT p.expense_id) AS unique_expenses_reimbursed,
    COALESCE(SUM(p.amount), 0) AS total_reimbursed_amount
FROM expense_payments p
JOIN expensesrecord e ON p.expense_id = e.id
LEFT JOIN expense_merchants em
    ON e.merchant = em.id
WHERE e.date BETWEEN ? AND ?
GROUP BY p.status, p.method
ORDER BY total_reimbursed_amount DESC
`;

export const QUERY_EXPENSE_PAYMENTS_FULL_LIST = `
SELECT 
    p.id AS payment_id,
    e.id AS expense_id,
    e.name AS expense_name,
    e.merchant,
    e.amount AS claimed_amount,
    p.amount AS paid_amount,
    DATE(p.payment_date) AS payment_date,
    p.method,
    p.status,
    p.created_by AS paid_by_employee_id
FROM expense_payments p
JOIN expensesrecord e ON p.expense_id = e.id
WHERE e.date BETWEEN ? AND ?
ORDER BY p.payment_date DESC, p.amount DESC
`;

export const QUERY_BILLABLE_EXPENSES = `
SELECT 
    ie.expense_id,
    e.name AS expense_name,
    e.merchant,
    e.amount AS billable_amount,
    DATE(e.date) AS expense_date,
    e.employeeid
FROM invoice_expenses ie
JOIN expensesrecord e ON ie.expense_id = e.id
WHERE e.date BETWEEN ? AND ?
ORDER BY e.amount DESC
`;

export const QUERY_MONTHLY_EXPENSE_TREND = `
SELECT 
    DATE_FORMAT(date, '%Y-%m') AS month,
    COUNT(*) AS expense_count,
    SUM(amount) AS total_expenses
FROM expensesrecord
WHERE date BETWEEN ? AND ?
GROUP BY month
ORDER BY month
`;

export const QUERY_ALL_INDIVIDUAL_EXPENSES = `
SELECT 
    e.id AS expense_id,
    e.name,
    e.merchant,
    b.name AS branch_name,
    e.amount,
    DATE(e.date) AS expense_date,
em.name AS merchant_name,
    r.username AS submitted_by,
    c.category,
    CASE WHEN e.approved = 1 THEN 'Approved' ELSE 'Pending' END AS approval_status,
    e.employeeid,
    e.branchid,
    e.description
FROM expensesrecord e
JOIN dboexpensecategory c ON e.category = c.id
LEFT JOIN roles r
    ON e.employeeid = r.employeeid
LEFT JOIN expense_merchants em
    ON e.merchant = em.id
LEFT JOIN branch b
    ON e.branchid = b.branchid
WHERE e.date BETWEEN ? AND ?
ORDER BY e.date DESC, e.amount DESC
`;

export const QUERY_UNAPPROVED_EXPENSES_PERIOD = `
SELECT 
    e.id AS expense_id,
    e.name,
    e.merchant,
    e.amount,
    DATE(e.date) AS expense_date,
    DATEDIFF(?, e.date) AS days_since_submission,
    e.employeeid,
    e.branchid
FROM expensesrecord e
WHERE e.approved = 0
  AND e.date BETWEEN ? AND ?
ORDER BY e.date ASC
`;

export const QUERY_EXPENSES_BY_BRANCH = `
SELECT 
    e.branchid,
    b.name AS branch_name,
    COUNT(*) AS expense_count,
    SUM(e.amount) AS total_amount,
    ROUND(SUM(e.amount) * 100.0 / totals.total, 2) AS percentage_of_total
FROM expensesrecord e
CROSS JOIN (
    SELECT COALESCE(SUM(amount), 0) AS total 
    FROM expensesrecord 
    WHERE date BETWEEN ? AND ?
) totals
LEFT JOIN branch b
    ON e.branchid = b.branchid
WHERE e.date BETWEEN ? AND ?
GROUP BY e.branchid, totals.total
ORDER BY total_amount DESC
`;

export const QUERY_CEO_EXPENSE_SUMMARY_SNAPSHOT = `
SELECT 
    CONCAT(DATE_FORMAT(?, '%Y-%m-%d'), ' to ', DATE_FORMAT(?, '%Y-%m-%d')) AS reporting_period,
    
    (SELECT COUNT(*) FROM expensesrecord WHERE date BETWEEN ? AND ?) 
        AS total_expenses_submitted,
    
    (SELECT COALESCE(SUM(amount), 0) FROM expensesrecord WHERE date BETWEEN ? AND ?) 
        AS total_expenses_amount,
    
    (SELECT COALESCE(SUM(amount), 0) FROM expensesrecord WHERE approved = 1 AND date BETWEEN ? AND ?) 
        AS approved_expenses_amount,
    
    (SELECT COUNT(*) FROM expensesrecord WHERE approved = 0 AND date BETWEEN ? AND ?) 
        AS pending_expenses_count,
    
    (SELECT COALESCE(SUM(p.amount), 0) 
     FROM expense_payments p 
     JOIN expensesrecord e ON p.expense_id = e.id 
     WHERE p.status = 'Paid' AND e.date BETWEEN ? AND ?) 
        AS total_reimbursed_amount,
    
    (SELECT COALESCE(SUM(er.amount), 0) 
     FROM invoice_expenses ie 
     JOIN expensesrecord er ON ie.expense_id = er.id 
     WHERE er.date BETWEEN ? AND ?) 
        AS total_billable_to_clients_amount
`;




