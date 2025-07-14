export const q_create_service = `INSERT INTO additionalservices (serviceName,servicePrice,createdBy) VALUES(?,?,?)`;

export const q_update_service_created = `UPDATE additionalservices SET serviceName= ?,servicePrice= ?,serviceUpdatedBy= ? WHERE keyid = ?`

export const q_delete_service_created = `DELETE FROM additionalservices WHERE keyid = ?`;

export const q_getAllServicesByCount = `SELECT ss.serviceName,ss.servicePrice,ss.createdBy,ss.keyid,rr.username FROM additionalservices AS ss INNER JOIN roles AS rr ON rr.employeeid = ss.createdBy LIMIT ? OFFSET ?`;
export const q_get_specific_services = `SELECT * FROM additionalservices WHERE  keyid = ?`;


export const q_getAllServices = `SELECT ss.serviceName,ss.servicePrice,ss.createdBy,ss.keyid,rr.username,ss.issystem FROM additionalservices AS ss INNER JOIN roles AS rr ON rr.employeeid = ss.createdBy`;

export const q_delete_billed_services_using_billingid = `DELETE  FROM dboServices WHERE billingid = ?`;

export const q_get_all_services_associated_billingid = `SELECT DISTINCT ss.*,dbo.isRefundCompleted,dbo.isRefundApproved,dbo.isRefundInitiated,dbo.amountRefunded FROM dboServices AS ss INNER JOIN dbobillingrefundtable AS dbo ON dbo.serviceid = ss.serviceid WHERE billingid = ? GROUP BY ss.serviceid, ss.trackId,ss.categoryTrackId`;
export const q_get_all_services_associated_billingid_exclusive = `SELECT * FROM dboServices AS tt INNER JOIN dbobillingrefundtable AS ss ON ss.serviceid = tt.serviceid WHERE billingid = ? AND ss.isRefundCompleted = 0`;



export const q_services_refund_status_change = `UPDATE dbobillingrefundtable SET {withness} = ? , {date} = NOW() ,{withness}Purpose = ? WHERE serviceid = ?`;

export const q_refunds_has_witness_before = `SELECT COUNT(*) AS count FROM dbobillingrefundtable WHERE (firstWitness  = ? OR secondWitness = ? OR thirdWitness  = ?) AND serviceid = ? `;

export const q_get_a_service_refund_details = `

SELECT
    rf.*,
    ss.*,
    CONCAT(np.firstname, " ", np.middlename, " ", np.lastname) AS fullname,
    rr.username AS billedby
FROM
    dbobillingrefundtable AS rf
INNER JOIN
    dboservices AS ss
    ON ss.serviceid = rf.serviceid
INNER JOIN
    billing AS bb
    ON bb.billingid = ss.billingid
INNER JOIN
    new_patients AS np
    ON np.patientid = bb.patientid
INNER JOIN
    roles AS rr
    ON rr.employeeid = ss.employeeid
WHERE
    rf.serviceid = ?
`;

export const q_services_exist_using_billId_trackId = `SELECT COUNT(*) AS count FROM dboServices WHERE trackId = ? AND billingid = ?`;


export const q_services_refund_has_withness_data = `
SELECT
   CASE
     WHEN rf.firstWitness = rr.employeeid THEN 'firstWitness'
     WHEN rf.secondWitness = rr.employeeid THEN 'secondWitness'
     WHEN rf.thirdWitness = rr.employeeid THEN 'thirdWitness'
   END AS witnessType,
   rr.username,
   rr.employeeid
FROM dbobillingrefundtable AS rf
INNER JOIN roles AS rr
ON (rf.firstWitness = rr.employeeid OR rf.secondWitness = rr.employeeid OR rf.thirdWitness = rr.employeeid)
WHERE rf.serviceid = ?
AND (
   rf.firstWitness IS NOT NULL
   OR rf.secondWitness IS NOT NULL
   OR rf.thirdWitness IS NOT NULL
)`


export const q_refund_get_all_refunds_status_pending = `
SELECT
    rf.*,
    ss.*,
    CONCAT(np.firstname, " ", np.middlename, " ", np.lastname) AS fullname,
    rr.username AS billedby
FROM
    dbobillingrefundtable AS rf
INNER JOIN
    dboservices AS ss
    ON ss.serviceid = rf.serviceid
INNER JOIN
    billing AS bb
    ON bb.billingid = ss.billingid
INNER JOIN
    new_patients AS np
    ON np.patientid = bb.patientid
INNER JOIN
    roles AS rr
    ON rr.employeeid = ss.employeeid
WHERE
    rf.isRefundInitiated = 1
    AND rf.isRefundCompleted = 0
    AND rf.isRefundMatterClosed = 0
ORDER BY
    rf.refundid {orderDirection}
LIMIT ? OFFSET ?;
`;

export const q_refund_get_all_refunds_status_completed = `
SELECT
    rf.*,
    ss.*,
    CONCAT(np.firstname, " ", np.middlename, " ", np.lastname) AS fullname,
    rr.username AS billedby,
    refundedbyrole.username AS refundedBy
FROM
    dbobillingrefundtable AS rf
INNER JOIN
    dboservices AS ss
    ON ss.serviceid = rf.serviceid
INNER JOIN
    billing AS bb
    ON bb.billingid = ss.billingid
INNER JOIN
    new_patients AS np
    ON np.patientid = bb.patientid
INNER JOIN
    roles AS rr
    ON rr.employeeid = ss.employeeid
LEFT JOIN
    roles AS refundedbyrole
    ON refundedbyrole.employeeid = rf.refundedBy
WHERE
    rf.isRefundInitiated = 1
    AND rf.isRefundCompleted = 1
    AND rf.isRefundMatterClosed = 1
ORDER BY
    rf.refundid {orderDirection}
LIMIT ? OFFSET ?;
`;

export const q_refund_get_all_refunds_status_completed_employee_specific = `
SELECT
    rf.*,
    ss.*,
    CONCAT(np.firstname, " ", np.middlename, " ", np.lastname) AS fullname,
    rr.username AS billedby
FROM
    dbobillingrefundtable AS rf
INNER JOIN
    dboservices AS ss
    ON ss.serviceid = rf.serviceid
INNER JOIN
    billing AS bb
    ON bb.billingid = ss.billingid
INNER JOIN
    new_patients AS np
    ON np.patientid = bb.patientid
INNER JOIN
    roles AS rr
    ON rr.employeeid = ss.employeeid
WHERE
    rf.isRefundInitiated = 1
    AND rf.isRefundCompleted = 1
    AND (firstWitness = ? OR secondWitness = ? OR thirdWitness  = ?)
ORDER BY
    rf.refundid {orderDirection}
LIMIT ? OFFSET ?;
`;



export const q_services_refund_status_change_admin_approve = `UPDATE dbobillingrefundtable SET isRefundApproved = ? , approvalDate = NOW(), approvedby = ?  WHERE serviceid = ?`;

export const q_services_refund_status_is_approved = `SELECT * FROM dbobillingrefundtable WHERE isRefundApproved = 1 AND serviceid = ?`;
export const q_services_refund_status_is_completed = `SELECT * FROM dbobillingrefundtable WHERE isRefundCompleted = 1 AND serviceid = ?`;

export const q_service_refund_update_is_cashout = `
UPDATE dbobillingrefundtable SET isRefundCompleted = 1 , refundedBy = ?, amountRefunded = ? WHERE serviceid = ?`;



export const q_service_refundable_amount_exceeded = `SELECT ss.totalcost,ss.totalpayable,tt.amountRefunded FROM dboservices  AS ss INNER JOIN  dbobillingrefundtable  AS tt on tt.serviceid = ss.serviceid WHERE ss.serviceid = ? `


export const q_services_is_refund_matter_closed = `SELECT * FROM dbobillingrefundtable WHERE isRefundMatterClosed = 1 AND serviceid = ?`;

export const hasAmountRefunded = `SELECT COUNT(*) AS count FROM dbobillingrefundtable WHERE serviceid = ? AND amountRefunded > 0`;