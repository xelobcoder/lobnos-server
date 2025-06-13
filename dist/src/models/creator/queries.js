"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_has_drug_reaction_inserts = exports.q_get_drug_reaction_inserts_find = exports.q_update_drug_reaction = exports.q_insert_drug_reaction = exports.q_get_ultrasound_template_field = exports.q_insert_ultrasound_template_single_count = exports.q_get_a_single_ultrasound_template = exports.q_get_ultrasound_template = exports.q_get_a_single_ultrasound_mapper = exports.q_get_ultrasound_template_mapper_scan_type = exports.q_get_ultrasound_template_mapper = exports.q_update_ultrasound_template = exports.q_insert_ultrasound_template = exports.q_update_ultrasound_template_mapper = exports.q_insert_new_ultrasound_template_mapper = exports.get_all_unseen_track_unique = exports.get_all_unseen_track = exports.insert_critical_value_alert = exports.q_get_rejected_collected_samples = exports.q_get_pending_collected_but_unvalidated_samples = exports.q_get_all_test_qualified_to_for_result_entry_on_test = exports.modify_ultrasound_field_to_support_long_text = exports.q_get_test_ascension_name_and_id = exports.update_creation_query = exports.q_comments_query = exports.getGenderQuery = exports.testCreationRule = void 0;
exports.testCreationRule = "SELECT creationrule FROM customtestcreation WHERE testid = ?";
exports.getGenderQuery = "SELECT gender,age,agetype FROM new_patients WHERE patientid = ?";
exports.q_comments_query = "SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?";
exports.update_creation_query = "UPDATE customtestcreation SET creationrule = ? WHERE testid = ?";
exports.q_get_test_ascension_name_and_id = `SELECT tp.name,ta.testid FROM test_ascension AS ta INNER JOIN test_panels AS tp ON tp.id = ta.testid WHERE ta.billingid = ?`;
exports.modify_ultrasound_field_to_support_long_text = `ALTER TABLE  test_results_ultrasound MODIFY COLUMN value LONGTEXT`;
exports.q_get_all_test_qualified_to_for_result_entry_on_test = `SELECT 
       tp.name,
       ta.testid,
       ta.id AS ascensionid,
       ta.resultEntryStart,
       ta.resultEntryEnd
       FROM test_ascension AS ta INNER JOIN test_panels AS tp ON tp.id = ta.testid
       INNER JOIN dboservices AS dbs ON dbs.serviceid = ta.serviceid
       WHERE dbs.billingid = ? AND dbs.branchid = ? AND (ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL AND processingStartDate IS NOT NULL AND processingEndDate IS NOT NULL)
`;
exports.q_get_pending_collected_but_unvalidated_samples = `
     SELECT DISTINCT
          b.patientid,
          b.billingid,
          b.billedon AS date,
          CONCAT(np.firstname, ' ', np.lastname, ' ', np.middlename) AS fullname
        FROM billing AS b
        INNER JOIN  new_patients as np ON np.patientid = b.patientid
        INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
        INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
        WHERE ss.approvalstatus IS NULL AND ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL
          GROUP BY b.billingid,ta.id ORDER BY b.billingid ASC LIMIT ? OFFSET ? 
`;
exports.q_get_rejected_collected_samples = `
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
`;
exports.insert_critical_value_alert = "INSERT INTO loggingcriticalvaluealert(billingid, testid, statement, createdBy) VALUES (?,?,?,?)";
exports.get_all_unseen_track = `SELECT
 lc.statement,
 b.billingid,
 p.patientid,
 lc.createdon,
 CONCAT(p.firstname," ", p.middlename, " ",p.lastname) AS fullname FROM loggingcriticalvaluealert AS lc
INNER JOIN billing AS b ON lc.billingid = b.billingid
INNER JOIN new_patients AS p ON p.patientid = b.patientid
WHERE isseen IS NULL AND b.billingid IN list ORDER BY billingid DESC
`;
exports.get_all_unseen_track_unique = `SELECT DISTINCT billingid
  FROM loggingcriticalvaluealert
WHERE isseen IS NULL LIMIT ? OFFSET ? `;
// ultrasound templates
exports.q_insert_new_ultrasound_template_mapper = `INSERT INTO ultrasoundtemplatesMapper (testid, name,  createdby, visibletoAll,associatedbodypart) VALUES (?,?,?,?,?)`;
exports.q_update_ultrasound_template_mapper = `
UPDATE ultrasoundtemplatesMapper  SET name = ?, createdby = ?,visibletoAll = ? ,associatedbodypart = ? WHERE keyid = ?`;
exports.q_insert_ultrasound_template = `INSERT INTO ultrasoundtemplates(templateid, field, value,fieldid) VALUES (?,?,?,?)
  `;
exports.q_update_ultrasound_template = `UPDATE ultrasoundtemplates SET field = ?,value = ?,lastupdatedon = NOW() WHERE templateid = ?  AND field = ?`;
exports.q_get_ultrasound_template_mapper = `SELECT 
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
exports.q_get_ultrasound_template_mapper_scan_type = `SELECT 
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
exports.q_get_a_single_ultrasound_mapper = `SELECT * FROM ultrasoundtemplatesMapper WHERE keyid = ?`;
exports.q_get_ultrasound_template = `SELECT * FROM ultrasoundtemplates  LIMIT ? OFFSET ?`;
exports.q_get_a_single_ultrasound_template = `SELECT * FROM ultrasoundtemplates WHERE templateid = ?`;
exports.q_insert_ultrasound_template_single_count = `
SELECT COUNT(*)  FROM ultrasoundtemplatesMapper WHERE name = ? AND testid = ? `;
exports.q_get_ultrasound_template_field = `SELECT * FROM ultrasoundtemplates WHERE templateid = ? AND field = ?`;
exports.q_insert_drug_reaction = `
INSERT INTO  resultentrydrugsreaction (drugid ,  reaction ,  ascensionid ,  testid ) VALUES (?,?,?,?)
`;
exports.q_update_drug_reaction = `
UPDATE resultentrydrugsreaction SET reaction= ?,lastupdatedon= NOW() WHERE ascensionid= ? AND testid= ?
`;
exports.q_get_drug_reaction_inserts_find = `
SELECT * FROM resultentrydrugsreaction AS rr
INNER JOIN drugs AS ds ON ds.id = rr.drugid
 WHERE rr.testid = ? AND rr.ascensionid = ?
`;
exports.q_has_drug_reaction_inserts = `
SELECT * FROM resultentrydrugsreaction AS rr
INNER JOIN drugs AS ds ON ds.id = rr.drugid
 WHERE rr.testid = ? AND rr.ascensionid = ? AND rr.drugid = ?
`;
