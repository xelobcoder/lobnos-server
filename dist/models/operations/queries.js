"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_qualifiedToProcessByDepartment = exports.q_billing_test_collection = exports.q_approved_samples = exports.q_checkbillingid = void 0;
exports.q_checkbillingid = "SELECT * FROM billing WHERE billingid = ?";
exports.q_approved_samples = "SELECT * FROM samplestatus WHERE billingid = ? AND approvalstatus= 1";
exports.q_billing_test_collection = `SELECT ta.testid,
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
exports.q_qualifiedToProcessByDepartment = `SELECT CONCAT(np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
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
