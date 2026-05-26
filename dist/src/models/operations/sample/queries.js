"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_sample_update_dispute = exports.a_sample_dispute_query = exports.q_get_logs_rejectedsampledisputelog = exports.q_update_sample_status_validation = exports.q_sample_assessment_list = void 0;
exports.q_sample_assessment_list = ` SELECT 
           tt.name,
            tt.sample,
            t.testid,
            t.billingid,
            t.id,
            t.collectionStartDate,
            t.collectionEndDate,
            sc.name As sampleContainerName,
            st.name AS sampleType,
            ss.rejectionmessage,
            dd.department AS category,
            ss.approvalstatus
          from test_ascension AS t
            LEFT JOIN samplestatus AS ss ON ss.ascensionid = t.id
            LEFT JOIN test_panels AS tt ON tt.id = t.testid
            LEFT JOIN sampletype AS st  ON tt.sample = st.id
            LEFT JOIN samplecontainer AS sc ON tt.sample_container = sc.id
            LEFT JOIN departments AS dd ON dd.id = tt.category
          WHERE t.billingid = ?
            AND ss.approvalstatus IS NULL
            AND t.collectionStartDate IS NOT NULL
            AND t.collectionStartDate IS NOT NULL
            AND t.processingStartDate IS NULL
            AND ss.rejectionmessage IS NULL
            AND dd.department <> 'ultrasound'
          AND t.collectionStartDate IS NOT NULL AND t.collectionEndDate IS NOT NULL
        `;
exports.q_update_sample_status_validation = `
                              UPDATE samplestatus SET approvalstatus=?,
                                             rejectionmessage=?,
                                             samplevalidatedon=?,
                                             validatedby=?
                              WHERE ascensionid = ?
`;
exports.q_get_logs_rejectedsampledisputelog = `
  SELECT * FROM rejectedsampledisputelog AS lg
  INNER JOIN roles AS rl ON rl.employeeid = lg.disputedby
  WHERE ascensionid = ? 
  ORDER BY lg.id
  LIMIT ? OFFSET ?
`;
exports.a_sample_dispute_query = `INSERT INTO rejectedsampledisputelog (ascensionid, disputereason, disputedby, disputedon)
VALUES (?, ?, ?, ?)`;
exports.q_sample_update_dispute = `UPDATE samplestatus SET disputereason = ?, disputedby = ?, disputedon = ?
WHERE ascensionid = ?`;
