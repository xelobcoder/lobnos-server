export const q_checkbillingid = "SELECT * FROM billing WHERE billingid = ?";

export const q_approved_samples = "SELECT * FROM samplestatus WHERE billingid = ? AND approvalstatus= 1";

export const q_billing_test_collection = `SELECT ta.testid,
                tp.name,
                ta.billingid,
                tp.category,
                ta.processing,
                ta.processing_date,
                ta.ready,
                ta.ready_date
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

export const q_startProcessingTest: string = `UPDATE test_ascension SET processing_date = NOW(),
    processing = 'true'  WHERE billingid = ? AND testid = ?`;

export const q_log_result_entry: string = `UPDATE test_ascension SET ready_date = NOW(),ready = 'true'  WHERE billingid = ? AND testid = ?`;

export const q_get_all_result_entry: string = `SELECT 
          CONCAT( np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
          CONCAT(np.age," ",np.agetype) AS age,
          np.patientid,
          b.billingid ,
          tp.category,
          d.department,
          tp.name,
          b.clinician,
          ss.approvalstatus,
          ta.ready,
          ta.processing,
          tp.id,
          b.clientstatus,
           CASE WHEN b.organization <> 0 THEN
          ( SELECT name FROM organization WHERE id = b.organization)
          END AS organization,
          CASE WHEN b.clinician <> 0 THEN
           (SELECT name FROM clinicianbasicinfo WHERE id = b.clinician)
          END AS clinicianName
      FROM new_patients AS np
        INNER JOIN billing AS b ON np.patientid = b.patientid
        INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
        INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
        INNER JOIN test_panels AS tp ON tp.id = ss.testid
        INNER JOIN departments AS d ON d.id = tp.category 
        WHERE ss.approvalstatus = 1 AND ta.collection = 'true'
        AND d.department <> 'ultrasound'
      `;
