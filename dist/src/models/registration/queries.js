"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_patient_update_personal_information = exports.q_patient_update_emmergency_information = exports.getPatientIDQuery = exports.insertPersonalInformationQuery = exports.isClientSameQuery = exports.q_patient_update_patient_addressing = exports.q_filter_patient_using_billingid_query = exports.q_filter_patients = exports.q_patient_data = exports.q_new_registation = void 0;
exports.q_new_registation = `INSERT INTO new_patients (firstname, lastname, middlename, email, age, agetype, dob, marital_status, mobile_number, occupation, gender, organization,fullpatientid,contactpointer)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
exports.q_patient_data = "SELECT * FROM new_patients WHERE patientid = ?";
exports.q_filter_patients = `  SELECT *, 
         CONCAT(firstname, ' ', COALESCE(middlename, ''), ' ', lastname) AS fullname,
         mobile_number AS contact
  FROM new_patients`;
exports.q_filter_patient_using_billingid_query = `SELECT np.firstname, np.lastname, np.middlename, np.email, np.age, np.agetype, np.dob, np.marital_status, np.mobile_number, np.occupation, np.gender, np.organization, np.patientid, np.fullpatientid, np.contactpointer FROM new_patients AS np INNER JOIN billing AS b ON b.patientid = np.patientid WHERE b.billingid = ?`;
exports.q_patient_update_patient_addressing = `UPDATE patientsaddress 
      SET area = ?,
      country= ?,
      district= ?,
      region = ?,
      gpsLocation = ?,
      address = ? 
      WHERE patientid = ?`;
exports.isClientSameQuery = `SELECT * FROM patients WHERE mobile = ? OR email = ?`;
exports.insertPersonalInformationQuery = `INSERT INTO patients (name, mobile, email, ...) VALUES (?, ?, ?, ...)`;
exports.getPatientIDQuery = `SELECT patientid FROM patients WHERE id = ?`;
exports.q_patient_update_emmergency_information = `UPDATE patientemmergencycontactinformation 
SET emmergencyContactName = ?,
emmergencyContactNumber = ?, 
relationship = ?,
occupation = ?, 
address = ? 
WHERE patientid = ?
`;
exports.q_patient_update_personal_information = `UPDATE new_patients 
                   SET firstname = ?,designation = ?, lastname = ?, middlename = ?, email = ?,age = ?, agetype = ?, dob = ?, marital_status = ?, mobile_number = ?, occupation = ?, gender = ?, organization = ?,whatAppcontact = ?
                   WHERE patientid = ?`;
