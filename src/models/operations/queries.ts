export const q_checkbillingid = "SELECT * FROM billing WHERE billingid = ?";

export const q_approved_samples = "SELECT * FROM samplestatus WHERE billingid = ? AND approvalstatus= 1";


export const q_entered_result_part = `SELECT ta.testid,
                          tp.name,
                          ta.billingid,
                          tp.category
                        FROM test_ascension as ta
                          INNER JOIN test_panels as tp ON ta.testid = tp.id
                          INNER JOIN departments AS d ON d.id = tp.category
       WHERE ta.billingid = ?`;

export const q_billing_test_collection = `SELECT ta.testid,
                tp.name,
                ta.billingid,
                tp.category
              FROM test_ascension as ta
                INNER JOIN test_panels as tp ON ta.testid = tp.id
                INNER JOIN departments AS d ON d.id = tp.category
              WHERE ta.billingid = ?`;

export const q_qualifiedToProcessByDepartment: string = `SELECT CONCAT(np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
          np.patientid,
          b.billingid,
          tp.category
        FROM new_patients as np
          INNER JOIN billing as b ON np.patientid = b.patientid
          INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
          INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
          INNER JOIN test_panels AS tp ON tp.ID = ss.testid
          INNER JOIN departments AS d ON d.ID = tp.category
        WHERE ss.approvalstatus = 1 AND DATE(b.billedon) = CURRENT_DATE`;


export const q_log_result_entry: string = `UPDATE test_ascension SET ready_date = NOW(),ready = 'true'  WHERE billingid = ? AND testid = ?`;


export const q_get_all_result_entry_base: string = `
  SELECT DISTINCT
    CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
    CONCAT(np.age, " ", np.agetype) AS age,
            np.patientid,
            b.billingid,
            tp.category,
            ta.processingStartDate,
            np.fullpatientid,
            ta.processingEndDate,
            ta.resultEntryStart,
            ta.resultEntryEnd,
            b.billedon AS billing_date,
            d.department,
            ta.id AS ascensionid,
            ta.ascension_date,
            tp.name,
            ds.clinicianId,
            ss.approvalstatus,
            dta.printCount,
            tp.id,
            b.clientstatus,
  CASE WHEN ds.organizationId <> 0 THEN
    (SELECT name FROM organization WHERE id = ds.organizationId)
  END AS organization,
  CASE WHEN ds.clinicianId <> 0 THEN
    (SELECT name FROM clinicianbasicinfo WHERE id = ds.clinicianId)
  END AS clinicianName
  FROM dboServices AS ds
  INNER JOIN test_ascension AS ta ON ta.serviceid = ds.serviceid
  INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
  INNER JOIN test_panels AS tp ON tp.id = ss.testid
  INNER JOIN departments AS d ON d.id = tp.category
  INNER JOIN billing AS b ON b.billingid = ds.billingid
  INNER JOIN new_patients AS np  ON np.patientid = b.patientid
   INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
  WHERE ss.approvalstatus = 1
      AND ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL
`;
export const q_get_all_result_entry_ultrasound_base: string = `
  SELECT DISTINCT
    CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
    CONCAT(np.age, " ", np.agetype) AS age,
            np.patientid,
            b.billingid,
                 np.fullpatientid,
            tp.category,
            ta.resultEntryStart,
            ta.resultEntryEnd,
            b.billedon AS billing_date,
            d.department,
            ta.id AS ascensionid,
            ta.ascension_date,
            tp.name,
            ds.clinicianId,
            tp.id,
            b.clientstatus,
  CASE WHEN ds.organizationId <> 0 THEN
    (SELECT name FROM organization WHERE id = ds.organizationId)
  END AS organization,
  CASE WHEN ds.clinicianId <> 0 THEN
    (SELECT name FROM clinicianbasicinfo WHERE id = ds.clinicianId)
  END AS clinicianName
  FROM dboServices AS ds
  INNER JOIN test_ascension AS ta ON ta.serviceid = ds.serviceid
  INNER JOIN test_panels AS tp ON tp.id = ta.testid
  INNER JOIN departments AS d ON d.id = tp.category
  INNER JOIN billing AS b ON b.billingid = ds.billingid
  INNER JOIN new_patients AS np  ON np.patientid = b.patientid
  INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
  WHERE d.department = 'ULTRASOUND'
`;

export enum OperationsStages {
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  VALIDATION = "VALIDATION",
  ULTRASOUND_UNCOMPLETED = "ULTRASOUND_UNCOMPLETED",
  ULTRASOUND_COMPLETED = "ULTRASOUND_COMPLETED",
  VALIDATED = 'VALIDATED'
}

export const q_get_all_test_ready_for_various_stages = function (currentQuery: string, stage: string) {
  let query = currentQuery;
  switch (stage) {
    case OperationsStages.PROCESSING:
      query += ` AND (ta.processingStartDate IS NULL OR  ta.processingEndDATE IS NULL) AND  d.department <> 'ultrasound'`;
      return query;
    case OperationsStages.COMPLETED:
      query += ` AND (ta.processingStartDate IS NOT NULL AND ta.processingEndDATE IS NOT NULL) AND ta.resultEntryStart IS NULL 
     AND d.department <> 'ultrasound'`
      return query;
    case OperationsStages.VALIDATION:
      query += `AND (ta.processingStartDate IS NOT NULL AND ta.processingEndDATE IS NOT NULL) AND ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL AND  dta.isapproved = 0
     AND d.department <> 'ultrasound'
			`
      return query;
    case OperationsStages.VALIDATED:
      query += `AND ta.processingStartDate IS NOT NULL AND ta.processingEndDATE IS NOT NULL AND ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL AND  dta.isapproved = 1
     AND d.department <> 'ultrasound'
			`
      return query;
    default:
      return null
  }


}


export const q_get_all_test_ready_for_various_stages_ultrasound = function (currentQuery: string, stage: string) {
  let query = currentQuery;
  switch (stage) {
    case OperationsStages.ULTRASOUND_UNCOMPLETED:
      query += ` AND (ta.resultEntryStart IS NULL OR ta.resultEntryEnd IS NULL) 
			`
      return query;
    case OperationsStages.ULTRASOUND_COMPLETED:
      query += `AND (ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL )
			`
      return query;
    default:
      return null
  }
}

export const q_get_all_result_entry_partitioning = `SELECT DISTINCT
    CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
    CONCAT(np.age, ' ', np.agetype) AS age,
    np.patientid,
    b.billingid,
    tp.category,
    np.fullpatientid,
    b.billedon AS billing_date,
    ta.processingStartDate,
    ta.processingEndDate,
    ta.resultEntryStart,
         np.fullpatientid,
    ta.resultEntryEnd,
    d.department,
    ta.id AS ascensionid,
    tp.name,
    ta.ascension_date,
        dta.printCount,
    ds.clinicianId,
    ss.approvalstatus,
    tp.id,
    b.clientstatus,
    CASE
      WHEN ds.organizationId <> 0 THEN
        (SELECT name FROM organization WHERE id = ds.organizationId)
      ELSE NULL
    END AS organization,
    CASE
      WHEN ds.clinicianId <> 0 THEN
        (SELECT name FROM clinicianbasicinfo WHERE id = ds.clinicianId)
      ELSE NULL
    END AS clinicianName
FROM billing PARTITION({billing_table}) AS b
INNER JOIN test_ascension PARTITION ({asc_table}) AS ta ON ta.billingid = b.billingid
INNER JOIN dboServices AS ds ON ds.billingid = b.billingid
INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
INNER JOIN test_panels AS tp ON tp.id = ss.testid
INNER JOIN departments AS d ON d.id = tp.category
INNER JOIN new_patients AS np ON np.patientid = b.patientid
 INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
WHERE ss.approvalstatus = 1
  AND ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL
`;

export const q_get_all_result_entry_partitioning_ultrasound = `SELECT DISTINCT
            CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
            CONCAT(np.age, ' ', np.agetype) AS age,
            np.patientid,
            np.fullpatientid,
            b.billingid,
            tp.category,
                 np.fullpatientid,
            b.billedon AS billing_date,
            ta.resultEntryStart,
            ta.resultEntryEnd,
            d.department,
            ta.id AS ascensionid,
            tp.name,
            ta.ascension_date,
            ds.clinicianId,
            tp.id,
            b.clientstatus,
            CASE
              WHEN ds.organizationId <> 0 THEN
                (SELECT name FROM organization WHERE id = ds.organizationId)
              ELSE NULL
            END AS organization,
            CASE
              WHEN ds.clinicianId <> 0 THEN
                (SELECT name FROM clinicianbasicinfo WHERE id = ds.clinicianId)
              ELSE NULL
            END AS clinicianName
        FROM billing PARTITION({billing_table}) AS b
        INNER JOIN test_ascension PARTITION ({asc_table}) AS ta ON ta.billingid = b.billingid
        INNER JOIN dboServices AS ds ON ds.billingid = b.billingid
        INNER JOIN test_panels AS tp ON tp.id = ta.testid
        INNER JOIN departments AS d ON d.id = tp.category
        INNER JOIN new_patients AS np ON np.patientid = b.patientid
         INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
        WHERE d.department = 'ULTRASOUND'
`;

export const q_ultrasound_waitingList: string = `SELECT DISTINCT
          np.patientid,
          b.billingid,
          CONCAT( np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
          b.billedon,
          tp.name,
          tp.id AS testid,
          tp.category,
          d.department
  FROM new_patients as np
    INNER JOIN billing as b ON np.patientid = b.patientid
    INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
    INNER JOIN test_panels AS tp ON tp.id = ta.testid
    INNER JOIN departments AS d ON d.id = tp.category
  WHERE  d.department = 'ultrasound' LIMIT ? OFFSET ?`;

export const q_ultrasound_processed_list: string = `SELECT DISTINCT
        np.patientid,
        b.billingid,
        CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
        b.billedon,
        tp.name,
        tp.id AS testid,
        tp.category,
        d.department
      FROM new_patients AS np
      INNER JOIN billing AS b ON np.PATIENTID = b.patientid
      INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
      INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
      INNER JOIN test_panels AS tp ON tp.id = ta.testid
      INNER JOIN departments AS d ON d.id = tp.category
      ?
      ORDER BY b.BILLINGID ASC
      LIMIT ? OFFSET ?
    `;

export const q_get_all_entered_result: string = `SELECT  CONCAT(np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
          np.PATIENTID AS patientid,
          np.gender,
          b.BILLINGID AS billingid,
          ta.id AS ascensionid,
          b.billedon AS billing_date,
          tp.CATEGORY AS category
        FROM new_patients as np
          INNER JOIN billing as b ON np.PATIENTID = b.PATIENTID
           INNER JOIN test_ascension AS ta ON ta.billingid = b.BILLINGID
          INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
          INNER JOIN test_panels AS tp ON tp.ID = ss.testid
          INNER JOIN departments AS d ON d.ID = tp.CATEGORY`;

export const q_get_all_test_preview = `SELECT ta.testid,
            tp.NAME,
            ta.billingid,
            tp.CATEGORY,
            ta.processing,
            ta.processing_date
          FROM test_ascension as ta
            INNER JOIN test_panels as tp ON ta.testid = tp.ID
            INNER JOIN departments AS d ON d.id = tp.CATEGORY
          WHERE ta.billingid = ?`;

export const q_update_test_ascesion_collection = `
            UPDATE test_ascension SET collection = true , collection_date = NOW() WHERE ascensionid = ?
          `;

export const q_update_test_ascesion_processing = `
            UPDATE test_ascension SET processing = true , processing_date = NOW() WHERE ascensionid = ?
          `;

export const q_update_test_ascesion_ready = ` UPDATE test_ascension SET ready = true , ready_date = NOW() WHERE ascensionid = ?`;


export const delete_test_ascension_billed = `DELETE FROM test_ascension WHERE billingid = ?`;



// phelobotomy Analytics

export const q_get_pending_ascension_cases = `SELECT COUNT(*) AS pendingcases FROM test_ascension WHERE collection = 'false' AND ascension_date = CURRENT_DATE`;





// test ascension

export const q_update_ascension_collection_state = `UPDATE test_ascension SET {stage} = ?,sampleCollectedBy = ? WHERE id = ?`

export const q_update_ascension_processing_state = `UPDATE test_ascension SET {stage} = ?, sampleProcessedBy = ? WHERE id = ?`

export const q_update_ascension_result_entry_state = `UPDATE test_ascension SET {stage} = ?, resultEnteredBy = ? WHERE id = ?`


export const q_get_stages_column_dual: string = `SELECT {start} , {end} from test_ascension WHERE ascensionid = ? `;

export const q_ascension_find_id: string = `SELECT * FROM test_ascension WHERE id = ?`;

export const q_pending_sample_uncollected: string = ` 
    SELECT DISTINCT
      CONCAT(p.firstname, " ", p.middlename, " ", p.lastname) AS fullname,
      p.patientid,
      CONCAT(p.age, " ", p.agetype) AS age,
      p.gender,
      p.mobile_number AS mobilenumber,
      b.billingid AS billingid,
      b.billedon AS date,
      b.clientstatus 
    FROM new_patients AS p
    INNER JOIN billing AS b ON p.patientid = b.patientid
    INNER JOIN test_ascension AS ts ON b.billingid = ts.billingid
    WHERE (ts.collectionStartDate IS NULL OR ts.collectionEndDate IS NULL)
    ORDER BY b.billingid ASC 
    LIMIT ? OFFSET ?`;


export const q_transaction_ascension_phelobotomy_details: string = `
  SELECT DISTINCT
      t.id,
      t.testid,
      t.billingid,
      t.collectionStartDate,
      t.collectionEndDate,
      p.category,
      p.sample_container,
      s.rejectionmessage,
      p.unit,
      p.sample,
      p.qty_required,
      p.name,
      st.name AS sampletype
  FROM test_ascension AS t
  INNER JOIN test_panels AS p ON t.testid = p.id
  INNER JOIN samplestatus AS s ON s.ascensionid = t.id
  INNER JOIN sampletype AS st ON st.id = p.sample
  WHERE t.billingid = ? AND (t.collectionStartDate IS NULL OR t.collectionEndDate IS NULL)
  `




export const q_update_general_ascension_test_edit_count: string ="UPDATE dbogeneraltesteditcount SET counter = ? WHERE ascensionid = ? AND billingid = ?";




export const q_get_date_for_tat_analysis: string = `SELECT 
          ta.*, 
          ss.*,
          tp.name AS testname,
td.pre_tat,
td.tat,
td.post_Tat,
          bb.*, 
          ta.id AS ascensionid, 
          np.* 
FROM test_ascension AS ta
INNER JOIN dboservices AS ss ON ss.serviceid = ta.serviceid
INNER JOIN billing AS bb ON bb.billingid = ss.billingid
INNER JOIN new_patients AS np ON np.patientid = bb.patientid
INNER JOIN test_panels AS tp ON tp.id = ta.testid
INNER JOIN testdetails AS td ON td.testid = tp.id
LIMIT ? OFFSET ?`;



export const q_test_multi_create_testConditionDefinition = "INSERT INTO testConditionDefinitions (conditionName, testId) VALUES (?, ?)";
export const q_test_multi_read_testConditionDefinition = "SELECT * FROM testConditionDefinitions WHERE id = ?";
export const q_test_multi_update_testConditionDefinition = "UPDATE testConditionDefinitions SET conditionName = ?, testId = ? WHERE id = ?";
export const q_test_multi_delete_testConditionDefinition = "DELETE FROM testConditionDefinitions WHERE id = ?";

export const q_test_multi_read_testCondition = "SELECT * FROM testConditions WHERE id = ?";
export const q_test_multi_update_testCondition = "UPDATE testConditions SET testId = ?, parameter = ?, conditionId = ?, target = ?, inRange = ?, createdBy = ? WHERE id = ?";
export const q_test_multi_delete_testCondition = "DELETE FROM testConditions WHERE id = ?";


export const q_test_definition_conditions = `SELECT * FROM testconditions WHERE conditionid = ?`



export const q_get_test_conditions = `SELECT * FROM testconditiondefinitions WHERE testid = ?`