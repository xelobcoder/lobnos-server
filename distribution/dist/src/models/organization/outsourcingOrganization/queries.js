"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_update_to_resolve_outsourced = exports.q_get_all_outsourced_organization_stage_organization = exports._gel_all_outsourced_organization = exports.q_get_test_outsourcing_organizations = exports.q_update_testdetails_outsourcing = exports.q_check_an_outsource_organization_provided_test = exports.q_get_outsourceorganizationservices = exports.q_insert_into_outsource_org_services_table = exports.q_get_outsource_organization_basic = exports.q_outsource_organization_exist_usingid = exports.q_outsource_organization_exist = exports.q_update_an_outsource_organization_basic = exports.create_update_an_outsource_servicess = exports.q_create_an_outsource_organization = void 0;
exports.q_create_an_outsource_organization = `INSERT INTO outsourcingorganization(name, organizationType, email, address, billingAddress, contactNumber, contactPerson,  outsourceCreatedBy) VALUES (?,?,?,?,?,?,?,?)`;
exports.create_update_an_outsource_servicess = `INSERT INTO outsourcingServices(outsourceid, price,testid,addedon,addedby)`;
exports.q_update_an_outsource_organization_basic = ` 
    UPDATE outsourcingorganization 
    SET name  = ?, organizationType = ?, email = ?, address = ?, billingAddress = ?, contactNumber = ?, contactPerson =?, outsourceCreatedBy = ?
    WHERE outsourceid = ?`;
exports.q_outsource_organization_exist = `SELECT COUNT(*) AS count 
FROM outsourcingorganization 
WHERE name = ?;
`;
exports.q_outsource_organization_exist_usingid = `SELECT COUNT(*) AS count 
FROM outsourcingorganization 
WHERE outsourceid  = ?
`;
exports.q_get_outsource_organization_basic = `SELECT * FROM outsourcingorganization WHERE outsourceid  = ?`;
exports.q_insert_into_outsource_org_services_table = `INSERT INTO outsourceorganizationservices (
    outsourceid, 
    generalTestId, 
    outsourcePrice, 
    addedby
) VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    outsourcePrice = VALUES(outsourcePrice),
    addedby = VALUES(addedby),
    updatedby=VALUES(addedby)
`;
exports.q_get_outsourceorganizationservices = `SELECT * FROM  outsourceorganizationservices WHERE outsourceid  = ?`;
exports.q_check_an_outsource_organization_provided_test = `SELECT * FROM outsourceorganizationservices WHERE outsourceid = ? AND generalTestId = ?`;
exports.q_update_testdetails_outsourcing = `UPDATE testdetails SET OutSourcingList = ? WHERE testid = ?`;
exports.q_get_test_outsourcing_organizations = `SELECT outSourcingList FROM testdetails WHERE testid = ?`;
exports._gel_all_outsourced_organization = `SELECT dbo.trackId AS testid,
dbo.serviceid, dbo.billingid 
tp.name,
dbo.cost AS testprice,
oo.organizationType,
oo.name AS outsourcingorganizationName
FROM dboservices AS dbo
INNER JOIN outsourcingorganization AS oo
INNER JOIN test_panels AS tp ON tp.id = dbo.trackId
WHERE dbo.outsourceid = oo.outsourceid OFFSET ? LIMIT ?`;
exports.q_get_all_outsourced_organization_stage_organization = `
SELECT
    dbo.trackId AS testid,
    dbo.serviceid, 
    dbo.billingid,
    tp.name,
    dbo.cost AS testprice,
    oo.organizationType,
    oo.name AS outsourcingorganizationName,
    CASE 
        WHEN ott.employeeid IS NOT NULL THEN 
            (SELECT username FROM roles WHERE employeeid = ott.employeeid)
        ELSE NULL
    END AS requestedby,
       CASE
        WHEN ott.employeeid IS NOT NULL THEN
            (SELECT username FROM roles WHERE employeeid = ott.completedconfirmedby)
        ELSE NULL
    END AS completedby
FROM dboservices AS dbo
INNER JOIN outsourcingorganization AS oo ON dbo.outsourceid = oo.outsourceid
INNER JOIN test_panels AS tp ON tp.id = dbo.trackId
INNER JOIN outsourcedtesttracking AS ott ON ott.outsourceid = dbo.outsourceid
WHERE ott.status = ?
LIMIT ? OFFSET ?`;
exports.q_update_to_resolve_outsourced = ` UPDATE outsourcedtesttracking  SET status = ? , completedconfirmedby = ? WHERE serviceid = ?`;
