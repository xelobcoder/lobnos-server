// Query to fetch TAT analysis archive by date range
export const q_get_tat_analysis_archive_by_date = `
  SELECT * FROM tat_analysis_archive
  WHERE computed_date BETWEEN ? AND ?
  ORDER BY computed_date DESC, ascensionid DESC
`;

export const q_get_ascension_ids_for_tat_archive = `
  SELECT ta.id
  FROM test_ascension AS ta
  INNER JOIN dboservices AS ss ON ss.serviceid = ta.serviceid
  INNER JOIN billing AS bb ON bb.billingid = ss.billingid
  WHERE ta.collectionStartDate IS NOT NULL
    AND ta.collectionEndDate IS NOT NULL
    AND ta.processingStartDate IS NOT NULL
    AND ta.processingEndDate IS NOT NULL
    AND ta.resultEntryStart IS NOT NULL
    AND ta.resultEntryEnd IS NOT NULL
    AND bb.billedon IS NOT NULL
    AND DATE(ta.resultEntryEnd) = CURDATE() - INTERVAL 1 DAY
  ORDER BY ta.id ASC
`;
// Upsert TAT analysis archive (for use in TurnAroundTime.ts)
export const q_upsert_tat_analysis_archive = `
  INSERT INTO tat_analysis_archive (
    ascensionid, billedon, test, setTat, setPreTat, setProcessingTat, setPostTat,
    collectionStartDate, collectionEndDate, processingStartDate, processingEndDate,
    resultEntryStart, resultEntryEnd, preTAT, processingTAT, postTAT, totalTAT,
    preTatMinutes, processingTatMinutes, postTatMinutes, totalTatMinutes,
    preTatExceededBy, processingTatExceededBy, postTatExceededBy, totalTatExceededBy,
    preTATExceeded, processingTATExceeded, postTATExceeded, tatExceeded,
    tatConsistencyWarning, patientName, computed_date, locked
  ) VALUES (
    ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
  )
  ON DUPLICATE KEY UPDATE
    billedon=VALUES(billedon), test=VALUES(test), setTat=VALUES(setTat), setPreTat=VALUES(setPreTat),
    setProcessingTat=VALUES(setProcessingTat), setPostTat=VALUES(setPostTat),
    collectionStartDate=VALUES(collectionStartDate), collectionEndDate=VALUES(collectionEndDate),
    processingStartDate=VALUES(processingStartDate), processingEndDate=VALUES(processingEndDate),
    resultEntryStart=VALUES(resultEntryStart), resultEntryEnd=VALUES(resultEntryEnd),
    preTAT=VALUES(preTAT), processingTAT=VALUES(processingTAT), postTAT=VALUES(postTAT), totalTAT=VALUES(totalTAT),
    preTatMinutes=VALUES(preTatMinutes), processingTatMinutes=VALUES(processingTatMinutes),
    postTatMinutes=VALUES(postTatMinutes), totalTatMinutes=VALUES(totalTatMinutes),
    preTatExceededBy=VALUES(preTatExceededBy), processingTatExceededBy=VALUES(processingTatExceededBy),
    postTatExceededBy=VALUES(postTatExceededBy), totalTatExceededBy=VALUES(totalTatExceededBy),
    preTATExceeded=VALUES(preTATExceeded), processingTATExceeded=VALUES(processingTATExceeded),
    postTATExceeded=VALUES(postTATExceeded), tatExceeded=VALUES(tatExceeded),
    tatConsistencyWarning=VALUES(tatConsistencyWarning), patientName=VALUES(patientName),
    locked=VALUES(locked)
`;
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
  SELECT 
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
            ds.paymentstatus,
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
            org.name AS organization,
            prdp.requested_mode AS requested_mode,
            drol.username AS delivered_by_username,
            rdel.delivered_by_employeeid AS delivered_by_employeeid,
            rdel.delivered_at AS delivered_at,
            rdel.delivered_mode AS delivered_mode,
            clin.name AS clinicianName
  FROM dboServices AS ds
  INNER JOIN billing AS b ON b.billingid = ds.billingid 
  INNER JOIN test_ascension AS ta ON ta.serviceid = ds.serviceid
  INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
  INNER JOIN test_panels AS tp ON tp.id = ss.testid
  LEFT JOIN departments AS d ON d.id = tp.category
  LEFT JOIN organization AS org ON org.id = ds.organizationId
  LEFT JOIN clinicianbasicinfo AS clin ON clin.id = ds.clinicianId
  LEFT JOIN result_delivery_log AS rdel ON rdel.ascensionid = ss.ascensionid
  LEFT JOIN patient_result_delivery_preference AS prdp ON prdp.ascension = ss.ascensionid
  LEFT JOIN roles AS drol ON drol.employeeid = rdel.delivered_by_employeeid
  INNER JOIN new_patients AS np  ON np.patientid = b.patientid
  INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
  WHERE ss.approvalstatus = 1
      AND (ta.collectionStartDate IS NOT NULL AND ta.collectionEndDate IS NOT NULL) AND (ds.isDeleted = 0 OR ds.isDeleted IS NULL)
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
            org.name AS organization,
            clin.name AS clinicianName,
            entered_by.employeeid AS entered_by_employeeid,
            entered_by.username AS entered_by_username,
            entered_by.email AS entered_by_email,
            entered_by.role AS entered_by_role
  FROM dboservices AS ds
  INNER JOIN test_ascension AS ta ON ta.serviceid = ds.serviceid
  INNER JOIN test_panels AS tp ON tp.id = ta.testid
  INNER JOIN departments AS d ON d.id = tp.category
  LEFT JOIN organization AS org ON org.id = ds.organizationId
  LEFT JOIN clinicianbasicinfo AS clin ON clin.id = ds.clinicianId
  INNER JOIN billing AS b ON b.billingid = ds.billingid
  INNER JOIN new_patients AS np  ON np.patientid = b.patientid
  INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
  LEFT JOIN (
    SELECT tr.ascensionid, tr.employeeid, r.username, r.email, r.role
    FROM test_results AS tr
    LEFT JOIN roles AS r ON r.employeeid = tr.employeeid
    GROUP BY tr.ascensionid
    LIMIT 1
  ) AS entered_by ON entered_by.ascensionid = ta.id
  WHERE d.department = 'ULTRASOUND' AND (ds.isDeleted = 0 OR ds.isDeleted IS NULL)
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
      query += ` AND (ta.processingEndDate IS NULL OR ta.processingStartDate IS NULL) AND  (d.department <> 'ultrasound' OR d.department IS NULL)`;
      return query;
    case OperationsStages.COMPLETED:
      query += ` AND (ta.processingStartDate IS NOT NULL AND ta.processingEndDATE IS NOT NULL) AND (ta.resultEntryStart IS NULL OR ta.resultEntryEnd IS NULL)
AND (d.department <> 'ultrasound' OR d.department IS NULL)`
      return query;
    case OperationsStages.VALIDATION:
      query += `AND (ta.processingStartDate IS NOT NULL AND ta.processingEndDATE IS NOT NULL) AND ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL AND  dta.isapproved = 0
AND (d.department <> 'ultrasound' OR d.department IS NULL)
      `
      return query;
    case OperationsStages.VALIDATED:
      query += `AND dta.isapproved = 1 AND (ta.processingStartDate IS NOT NULL AND ta.processingEndDATE IS NOT NULL) AND (ta.resultEntryStart IS NOT NULL AND ta.resultEntryEnd IS NOT NULL ) AND  dta.isapproved = 1
     AND (d.department <> 'ultrasound' OR d.department IS NULL)
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
    org.name AS organization,
    clin.name AS clinicianName
FROM billing PARTITION({billing_table}) AS b
INNER JOIN test_ascension PARTITION ({asc_table}) AS ta ON ta.billingid = b.billingid
INNER JOIN dboServices AS ds ON ds.billingid = b.billingid
INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
INNER JOIN test_panels AS tp ON tp.id = ss.testid
INNER JOIN departments AS d ON d.id = tp.category
LEFT JOIN organization AS org ON org.id = ds.organizationId
LEFT JOIN clinicianbasicinfo AS clin ON clin.id = ds.clinicianId
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
            org.name AS organization,
            clin.name AS clinicianName
        FROM billing PARTITION({billing_table}) AS b
        INNER JOIN test_ascension PARTITION ({asc_table}) AS ta ON ta.billingid = b.billingid
        INNER JOIN dboServices AS ds ON ds.billingid = b.billingid
        INNER JOIN test_panels AS tp ON tp.id = ta.testid
        INNER JOIN departments AS d ON d.id = tp.category
        LEFT JOIN organization AS org ON org.id = ds.organizationId
        LEFT JOIN clinicianbasicinfo AS clin ON clin.id = ds.clinicianId
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

export const q_get_all_entered_result: string = `
  SELECT 
    CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
    np.patientid,
    np.gender,
    b.billingid,
    b.billedon AS billing_date,
    dta.ascensionid,
    ta.testid,
    ta.resultEntryStart AS result_entry_date,
    dta.*,
    TP.name AS test_name,
    ss.*
  FROM dbotestresultapproval AS dta
      INNER JOIN test_ascension AS ta ON dta.ascensionid = ta.id
    INNER JOIN billing AS b ON ta.billingid = b.billingid
    INNER JOIN new_patients AS np ON np.patientid = b.patientid
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
    INNER JOIN test_panels AS tp ON tp.id = ta.testid
    LEFT JOIN roles AS r ON r.employeeid = ta.resultEnteredBy
`;

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
export const q_get_pending_ascension_cases = `SELECT COUNT(*) AS pendingcases FROM test_ascension WHERE collection = 'false' AND ascension_date = CURRENT_DATE`;
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
      b.clientstatus,
      ts.collectionStartDate,
      ts.id as ascensionid,
      ts.collectionEndDate
    FROM new_patients AS p
    INNER JOIN billing AS b ON p.patientid = b.patientid
    INNER JOIN test_ascension AS ts ON ts.billingid = b.billingid
    INNER JOIN test_panels AS tp ON tp.id = ts.testid
    LEFT JOIN departments AS c ON c.id = tp.category
    WHERE (ts.collectionEndDate IS NULL OR ts.collectionStartDate IS NULL) AND (c.department IS NOT NULL AND c.department <> 'Ultrasound')

    `;


export const q_transaction_ascension_phelobotomy_details: string = `
  SELECT 
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
  LEFT JOIN samplestatus AS s ON s.ascensionid = t.id
  LEFT  JOIN sampletype AS st ON st.id = p.sample
  WHERE t.billingid = ? AND (t.collectionStartDate IS NULL OR t.collectionEndDate IS NULL)
  `




export const q_update_general_ascension_test_edit_count: string = "UPDATE dbogeneraltesteditcount SET counter = ? WHERE ascensionid = ? AND billingid = ?";




export const q_get_date_for_tat_analysis: string = `SELECT 
          ta.*, 
          ss.*,
          tp.name AS testname,
          td.pre_tat,
          td.tat,
          td.post_Tat,
          bb.billedon, 
          ta.id AS ascensionid, 
          np.* 
      FROM test_ascension AS ta
      INNER JOIN dboservices AS ss ON ss.serviceid = ta.serviceid
      INNER JOIN billing AS bb ON bb.billingid = ss.billingid
      INNER JOIN new_patients AS np ON np.patientid = bb.patientid
      INNER JOIN test_panels AS tp ON tp.id = ta.testid
      INNER JOIN testdetails AS td ON td.testid = tp.id
      INNER JOIN dbotestresultapproval AS dta ON dta.ascensionid = ta.id
      WHERE `;



export const q_test_multi_create_testConditionDefinition = "INSERT INTO testConditionDefinitions (conditionName, testId) VALUES (?, ?)";
export const q_test_multi_read_testConditionDefinition = "SELECT * FROM testConditionDefinitions WHERE id = ?";
export const q_test_multi_update_testConditionDefinition = "UPDATE testConditionDefinitions SET conditionName = ?, testId = ? WHERE id = ?";
export const q_test_multi_delete_testConditionDefinition = "DELETE FROM testConditionDefinitions WHERE id = ?";

export const q_test_multi_read_testCondition = "SELECT * FROM testConditions WHERE id = ?";
export const q_test_multi_update_testCondition = "UPDATE testConditions SET testId = ?, parameter = ?, conditionId = ?, target = ?, inRange = ?, createdBy = ? WHERE id = ?";
export const q_test_multi_delete_testCondition = "DELETE FROM testConditions WHERE id = ?";


export const q_test_definition_conditions = `SELECT * FROM testconditions WHERE conditionid = ?`



export const q_get_test_conditions = `SELECT * FROM testconditiondefinitions WHERE testid = ?`