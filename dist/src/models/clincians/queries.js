"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SQLQueries = {
    getAllClinicians: "SELECT * FROM clinicianbasicinfo",
    getAllCliniciansWithPaymentInfo: `
    SELECT cbi.*, cpi.*
    FROM clinicianbasicinfo AS cbi
    LEFT JOIN clinicianpaymentinfo AS cpi ON cbi.id = cpi.clinicianid
    ORDER BY cbi.name ASC
  `,
    getClinicianBasicInfo: `SELECT * FROM clinicianBasicInfo WHERE id = ?`,
    getCliniciansWithPagination: `SELECT * FROM clinicianbasicinfo
   LIMIT ? OFFSET ?`,
    getCliniciansWithExtendedPagination: `SELECT * FROM clinicianbasicinfo AS  cbi
  LEFT JOIN clinicianpaymentinfo AS cpi ON cbi.id = cpi.clinicianid
   LIMIT ? OFFSET ?`,
    updateClinicianBasicInfo: `UPDATE clinicianbasicinfo SET NAME = ?, PHONE = ?, EMAIL = ?, LOCATION = ?,
     ADDRESS = ?,OCCUPATION = ? WHERE ID = ?`,
    deleteClinicianById: "DELETE FROM clinicianbasicinfo WHERE id = ?",
    insertClinicianBasicInfo: `INSERT INTO clinicianbasicinfo 
            (name,phone,email,location,address,
            occupation,organization) 
            VALUES (?,?,?,?,?,?,?)`,
    getSingleClinicianById: "SELECT * FROM clinicianbasicinfo WHERE ID = ?",
    getClinicianResult: `
    SELECT 
      b.billingid,
      np.patientid,
      tp.name,
      tt.testid,
      tt.approvalStatus AS approval,
      tt.collection,
      tt.ready,
      tt.processing,
      np.firstname,
      np.lastname,
      np.middlename,
      b.clinician,
      b.billedon
    FROM test_ascension AS tt 
    INNER JOIN billing AS b ON tt.billingid = b.billingid
    INNER JOIN new_patients AS np ON np.patientid = b.patientid 
    INNER JOIN test_panels AS tp ON tp.ID = tt.testid
    WHERE b.clinician = ?
    AND DATE(b.billedon) BETWEEN ? AND ?`,
    getBillingTestBasedByClinician: `
    SELECT 
      b.billingid,
      np.patientid,
      tp.name,
      tt.testid,
      tt.approvalStatus AS approval,
      tt.collection,
      tt.ready,
      tt.processing,
      np.firstname,
      np.lastname,
      np.middlename,
      b.clinician,
      b.billedon
    FROM test_ascension AS tt 
    INNER JOIN billing AS b ON tt.billingid = b.billingid
    INNER JOIN new_patients AS np ON np.patientid = b.patientid 
    INNER JOIN test_panels AS tp ON tp.ID = tt.testid
    WHERE b.clinician = ?
    AND b.billingid = ?`,
};
exports.default = SQLQueries;
