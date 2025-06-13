export const q_create_an_outsource_organization = `INSERT INTO outsourcingorganization(name, organizationType, email, address, billingAddress, contactNumber, contactPerson,  outsourceCreatedBy) VALUES (?,?,?,?,?,?,?,?)`


export const create_update_an_outsource_servicess = `INSERT INTO outsourcingServices(outsourceid, price,testid,addedon,addedby)`;


export const q_update_an_outsource_organization_basic = ` 
    UPDATE outsourcingorganization 
    SET name  = ?, organizationType = ?, email = ?, address = ?, billingAddress = ?, contactNumber = ?, contactPerson =?, outsourceCreatedBy = ?
    WHERE outsourceid = ?`;



export const q_outsource_organization_exist = `SELECT COUNT(*) AS count 
FROM outsourcingorganization 
WHERE name = ?;
`

export const q_outsource_organization_exist_usingid = `SELECT COUNT(*) AS count 
FROM outsourcingorganization 
WHERE outsourceid  = ?
`;

export const q_get_outsource_organization_basic = `SELECT * FROM outsourcingorganization WHERE outsourceid  = ?`;

export const q_insert_into_outsource_org_services_table = `INSERT INTO outsourceorganizationservices (
    outsourceid, 
    generalTestId, 
    outsourcePrice, 
    addedby
) VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    outsourcePrice = VALUES(outsourcePrice),
    addedby = VALUES(addedby),
    updatedby=VALUES(addedby)
`

export const q_get_outsourceorganizationservices = `SELECT * FROM  outsourceorganizationservices WHERE outsourceid  = ?`
 

export const q_check_an_outsource_organization_provided_test = `SELECT * FROM outsourceorganizationservices WHERE outsourceid = ? AND generalTestId = ?`;

export const q_update_testdetails_outsourcing = `UPDATE testdetails SET OutSourcingList = ? WHERE testid = ?`;


export const q_get_test_outsourcing_organizations = `SELECT outSourcingList FROM testdetails WHERE testid = ?`;


export const _gel_all_outsourced_organization = `SELECT dbo.trackId AS testid,
dbo.serviceid, dbo.billingid 
tp.name,
dbo.cost AS testprice,
oo.organizationType,
oo.name AS outsourcingorganizationName
FROM dboservices AS dbo
INNER JOIN outsourcingorganization AS oo
INNER JOIN test_panels AS tp ON tp.id = dbo.trackId
WHERE dbo.outsourceid = oo.outsourceid OFFSET ? LIMIT ?`



export const q_get_all_outsourced_organization_stage_organization = `
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



export const q_update_to_resolve_outsourced = ` UPDATE outsourcedtesttracking  SET status = ? , completedconfirmedby = ? WHERE serviceid = ?`;