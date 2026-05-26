export const testCreationRule: string = "SELECT creationrule FROM customtestcreation WHERE testid = ?";

export const getGenderQuery: string = "SELECT gender,age,agetype FROM new_patients WHERE patientid = ?";

export const q_comments_query: string = "SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?";

export const update_creation_query: string = "UPDATE customtestcreation SET creationrule = ? WHERE testid = ?";



export const q_get_test_ascension_name_and_id = `SELECT tp.name,ta.testid FROM test_ascension AS ta INNER JOIN test_panels AS tp ON tp.id = ta.testid WHERE ta.billingid = ?`;


export const modify_ultrasound_field_to_support_long_text: string = `ALTER TABLE  test_results_ultrasound MODIFY COLUMN value LONGTEXT`;


export const q_get_all_test_qualified_to_for_result_entry_on_test: string = `SELECT 
       tp.name,
       ta.testid,
       ta.id AS ascensionid,
       ta.resultEntryStart,
       ta.resultEntryEnd
       FROM test_ascension AS ta INNER JOIN test_panels AS tp ON tp.id = ta.testid
       INNER JOIN dboservices AS dbs ON dbs.serviceid = ta.serviceid
       WHERE dbs.billingid = ? AND dbs.branchid = ? AND (ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL AND processingStartDate IS NOT NULL AND processingEndDate IS NOT NULL)
`

export const q_get_pending_collected_but_unvalidated_samples = `
        SELECT DISTINCT
          b.patientid,
          b.billingid,
          ta.id AS ascensionid,
          ta.testid,
          b.billedon AS date,
          CONCAT(np.firstname, ' ', np.lastname, ' ', np.middlename) AS fullname
        FROM billing AS b
        INNER JOIN  new_patients as np ON np.patientid = b.patientid
        INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
        INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
        LEFT JOIN test_panels AS tt ON tt.id = ta.testid
        LEFT JOIN departments AS dd ON dd.id = tt.category
        WHERE ss.approvalstatus IS NULL AND (ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL) 
        AND dd.department <> 'ultrasound'
          
`


export const q_get_rejected_collected_samples = `
     SELECT DISTINCT
          b.patientid,
          b.billingid,
         (SELECT username FROM roles WHERE employeeid = ta.sampleCollectedBy LIMIT 1) AS sampleCollectedBy,
          b.billedon AS date,
          CONCAT(np.firstname, ' ', np.lastname, ' ', np.middlename) AS fullname,
         CONCAT(np.age, ' ',np.ageType) AS age,
         ss.rejectionmessage,
         ss.samplevalidatedon,
         ta.collectionEndDate,
         np.fullpatientid,
         ta.id AS ascensionid,
         ss.validatedby AS validatorid,
         rr.username AS validatedby,
         ts.name AS testname,
         np.mobile_number As mobilenumber
        FROM billing AS b
        INNER JOIN  new_patients as np ON np.patientid = b.patientid
        INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
        INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
        INNER JOIN roles AS rr ON rr.employeeid = ss.validatedby
        INNER JOIN test_panels AS ts ON ts.id = ta.testid
        WHERE ss.approvalstatus = 0 AND ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL
          GROUP BY ta.serviceid ORDER BY ta.serviceid ASC  LIMIT ? OFFSET ?
`

export const insert_critical_value_alert: string = "INSERT INTO loggingcriticalvaluealert(billingid, testid, statement, createdBy) VALUES (?,?,?,?)";



export const get_all_unseen_track: string = `SELECT
 lc.statement,
 b.billingid,
 p.patientid,
 lc.createdon,
 CONCAT(p.firstname," ", p.middlename, " ",p.lastname) AS fullname FROM loggingcriticalvaluealert AS lc
INNER JOIN billing AS b ON lc.billingid = b.billingid
INNER JOIN new_patients AS p ON p.patientid = b.patientid
WHERE isseen IS NULL AND b.billingid IN list ORDER BY billingid DESC
`

export const get_all_unseen_track_unique: string = `SELECT DISTINCT billingid
  FROM loggingcriticalvaluealert
WHERE isseen IS NULL LIMIT ? OFFSET ? ` ;

// ultrasound templates

export const q_insert_new_ultrasound_template_mapper: string = `INSERT INTO ultrasoundtemplatesMapper (testid, name,  createdby, visibletoAll,associatedbodypart) VALUES (?,?,?,?,?)`;

export const q_update_ultrasound_template_mapper: string = `
UPDATE ultrasoundtemplatesMapper  SET name = ?, createdby = ?,visibletoAll = ? ,associatedbodypart = ? WHERE keyid = ?`

export const q_insert_ultrasound_template = `INSERT INTO ultrasoundtemplates(templateid, field, value,fieldid) VALUES (?,?,?,?)
  `;

export const q_update_ultrasound_template: string = `UPDATE ultrasoundtemplates SET field = ?,value = ?,lastupdatedon = NOW() WHERE templateid = ?  AND field = ?`

export const q_get_ultrasound_template_mapper = `SELECT 
    utm.*, 
    tp.name as ultrasoundname
FROM 
    ultrasoundtemplatesMapper AS utm
INNER JOIN 
    test_panels AS tp 
ON 
    tp.id = utm.testid
WHERE 
    utm.createdby = ? OR utm.visibletoAll = 1
GROUP BY 
    utm.name, utm.associatedbodypart
ORDER BY 
    utm.keyid DESC
LIMIT ? OFFSET ?;
`;


export const q_get_ultrasound_template_mapper_scan_type = `SELECT 
    utm.keyid,
    utm.testid,
    utm.name,
    utm.associatedbodypart,
    utm.createdOn,
    utm.createdby,
    utm.visibletoAll,
    tp.name AS ultrasoundname
FROM 
    ultrasoundtemplatesMapper AS utm
INNER JOIN 
    test_panels AS tp 
ON 
    tp.id = utm.testid
WHERE 
    (utm.createdby = ? OR utm.visibletoAll = 1) AND utm.testid = ?
GROUP BY 
    utm.keyid, 
    utm.testid,
    utm.name, 
    utm.associatedbodypart, 
    utm.createdOn, 
    utm.createdby, 
    utm.visibletoAll, 
    tp.name
ORDER BY 
    utm.keyid DESC
LIMIT ? OFFSET ?;

`;

export const q_get_a_single_ultrasound_mapper = `SELECT * FROM ultrasoundtemplatesMapper WHERE keyid = ?`;

export const q_get_ultrasound_template = `SELECT * FROM ultrasoundtemplates  LIMIT ? OFFSET ?`;

export const q_get_a_single_ultrasound_template = `SELECT * FROM ultrasoundtemplates WHERE templateid = ?`;

export const q_insert_ultrasound_template_single_count: string = `
SELECT COUNT(*)  FROM ultrasoundtemplatesMapper WHERE name = ? AND testid = ? `

export const q_get_ultrasound_template_field = `SELECT * FROM ultrasoundtemplates WHERE templateid = ? AND field = ?`


export const q_insert_drug_reaction: string = `
INSERT INTO  resultentrydrugsreaction (drugid ,  reaction ,  ascensionid ,  testid ) VALUES (?,?,?,?)
`;

export const q_update_drug_reaction: string = `
UPDATE resultentrydrugsreaction SET reaction= ?,lastupdatedon= NOW() WHERE ascensionid= ? AND testid= ?
`

export const q_get_drug_reaction_inserts_find: string = `
SELECT * FROM resultentrydrugsreaction AS rr
INNER JOIN drugs AS ds ON ds.id = rr.drugid
 WHERE rr.testid = ? AND rr.ascensionid = ?
`;
export const q_has_drug_reaction_inserts: string = `
SELECT * FROM resultentrydrugsreaction AS rr
INNER JOIN drugs AS ds ON ds.id = rr.drugid
 WHERE rr.testid = ? AND rr.ascensionid = ? AND rr.drugid = ?
`;
