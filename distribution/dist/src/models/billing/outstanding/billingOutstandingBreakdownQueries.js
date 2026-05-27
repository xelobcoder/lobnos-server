"use strict";
// 🔹 1. TOTAL OUTSTANDING (date filtered)
Object.defineProperty(exports, "__esModule", { value: true });
exports.top_20_debtors = exports.reconciliation_billing_vs_services = exports.outstanding_by_aging_range = exports.outstanding_by_organization = exports.outstanding_by_branch = exports.outstanding_by_service_category = exports.outstanding_by_billing_or_transaction = exports.outstanding_by_patient = exports.all_outstanding = void 0;
exports.all_outstanding = `
SELECT 
    SUM(outstanding) AS total_outstanding
FROM dboservices
WHERE status IN('active','refunded')
  AND (isDeleted = 0 OR isDeleted IS NULL)
  AND outstanding > 0
  AND DATE(serviceAddedOn) BETWEEN ? AND ?;
`;
// 🔹 2. OUTSTANDING BY PATIENT
exports.outstanding_by_patient = `
SELECT 
    b.patientid,
    CONCAT_WS(' ', p.firstname, p.middlename, p.lastname) AS patient_name,
    COUNT(DISTINCT s.billingid) AS invoices,
    SUM(s.totalcost) AS total_billed,
    SUM(s.paidamount) AS total_paid,
    SUM(s.outstanding) AS total_outstanding
FROM dboservices s
LEFT JOIN billing b ON b.billingid = s.billingid
LEFT JOIN new_patients p ON p.patientid = b.patientid
WHERE s.status IN('active','refunded')
  AND (s.isDeleted = 0 OR s.isDeleted IS NULL)
  AND s.outstanding > 0
  AND DATE(s.serviceAddedOn) BETWEEN ? AND ?  GROUP BY b.patientid
ORDER BY total_outstanding DESC;
`;
// 🔹 3. OUTSTANDING BY BILL / TRANSACTION
exports.outstanding_by_billing_or_transaction = `
SELECT 
    s.billingid,
    b.patientid,
    b.status AS billing_status,
    s.serviceAddedOn AS billing_date,
    SUM(s.totalcost) AS total_billed,
    SUM(s.paidamount) AS total_paid,
    SUM(s.outstanding) AS total_outstanding
FROM dboservices s
JOIN billing b ON b.billingid = s.billingid
WHERE s.status IN('active','refunded')
  AND (s.isDeleted = 0 OR s.isDeleted IS NULL)
  AND DATE(s.serviceAddedOn) BETWEEN ? AND ?
GROUP BY s.billingid
HAVING total_outstanding > 0
ORDER BY total_outstanding DESC;
`;
// 🔹 4. OUTSTANDING BY SERVICE CATEGORY
exports.outstanding_by_service_category = `
SELECT 
    serviceCategory,
    COUNT(*) AS services,
    SUM(totalcost) AS total_billed,
    SUM(paidamount) AS total_paid,
    SUM(outstanding) AS total_outstanding
FROM dboservices
WHERE status IN('active','refunded')
  AND (isDeleted = 0 OR isDeleted IS NULL)
  AND DATE(serviceAddedOn) BETWEEN ? AND ?
GROUP BY serviceCategory
ORDER BY total_outstanding DESC;
`;
// 🔹 5. OUTSTANDING BY BRANCH
exports.outstanding_by_branch = `
SELECT 
    dboservices.branchid,
    branch.name,
    COUNT(DISTINCT billingid) AS invoices,
    SUM(totalcost) AS total_billed,
    SUM(paidamount) AS total_paid,
    SUM(outstanding) AS total_outstanding
FROM dboservices
LEFT JOIN branch ON dboservices.branchid = branch.branchid
WHERE status IN('active','refunded')
  AND (isDeleted = 0 OR isDeleted IS NULL)
  AND DATE(serviceAddedOn) BETWEEN ? AND ?
GROUP BY branchid
ORDER BY total_outstanding DESC;
`;
// 🔹 6. OUTSTANDING BY ORGANIZATION
exports.outstanding_by_organization = `
SELECT 
    organizationId,
    organization.name,
    COUNT(DISTINCT billingid) AS invoices,
    SUM(totalcost) AS total_billed,
    SUM(paidamount) AS total_paid,
    SUM(outstanding) AS total_outstanding
FROM dboservices
LEFT JOIN organization ON dboservices.organizationId = organization.id
WHERE organizationId IS NOT NULL
  AND status IN('active','refunded')
  AND (isDeleted = 0 OR isDeleted IS NULL)
  AND DATE(serviceAddedOn) BETWEEN ? AND ?
GROUP BY organizationId
ORDER BY total_outstanding DESC;
`;
// 🔹 7. AGING REPORT (date limited + bucketed)
exports.outstanding_by_aging_range = `
SELECT 
    CASE
        WHEN DATEDIFF(CURDATE(), DATE(serviceAddedOn)) <= 7 THEN '0–7 days'
        WHEN DATEDIFF(CURDATE(), DATE(serviceAddedOn)) BETWEEN 8 AND 30 THEN '8–30 days'
        WHEN DATEDIFF(CURDATE(), DATE(serviceAddedOn)) BETWEEN 31 AND 90 THEN '31–90 days'
        ELSE '>90 days'
    END AS aging_bucket,
    COUNT(*) AS services,
    SUM(outstanding) AS total_outstanding
FROM dboservices
WHERE status IN('active','refunded')
  AND (isDeleted = 0 OR isDeleted IS NULL)
  AND outstanding > 0
  AND DATE(serviceAddedOn) BETWEEN ? AND ?
GROUP BY aging_bucket
ORDER BY aging_bucket;
`;
// 🔹 8. RECONCILIATION — BILLING vs SERVICES
exports.reconciliation_billing_vs_services = `
SELECT 
    b.billingid,
    b.outstanding AS billing_outstanding,
    SUM(s.outstanding) AS services_outstanding,
    (b.outstanding - SUM(s.outstanding)) AS difference
FROM billing b
JOIN dboservices s ON s.billingid = b.billingid
WHERE b.outstanding > 0
  AND (s.isDeleted = 0 OR s.isDeleted IS NULL)
  AND DATE(s.serviceAddedOn) BETWEEN ? AND ?
GROUP BY b.billingid
HAVING difference != 0;
`;
exports.top_20_debtors = `
SELECT 
    b.patientid,
    SUM(s.outstanding) AS total_outstanding,
    CONCAT_WS(' ', p.firstname, p.middlename, p.lastname) AS patient_name
FROM dboservices s
JOIN billing b ON b.billingid = s.billingid
LEFT JOIN new_patients p ON p.patientid = b.patientid
WHERE s.status IN('active','refunded')
  AND (s.isDeleted = 0 OR s.isDeleted IS NULL)
  AND DATE(s.serviceAddedOn) BETWEEN ? AND ?
GROUP BY b.patientid
ORDER BY total_outstanding DESC
LIMIT 20;
`;
