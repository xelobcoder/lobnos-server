export const q_new_registation = `INSERT INTO new_patients (firstname, lastname, middlename, email, age, agetype, dob, marital_status,
 mobile_number, occupation, gender, organization,fullpatientid,contactpointer,designation,registeredby,relativecontactname,relativecontactnumber, whatsapp_country_code, mobile_country_code,whatAppContact)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

export const q_patient_data = "SELECT np.* FROM new_patients AS np LEFT JOIN roles AS rr ON rr.employeeid = np.registeredby WHERE patientid = ?";

export const q_filter_patients = `  SELECT np.*,
rr.username AS registeredbyusername, 
         CONCAT(np.firstname, ' ', COALESCE(np.middlename, ''), ' ', np.lastname) AS fullname,
         np.mobile_number AS contact
  FROM new_patients AS np LEFT JOIN roles AS rr ON rr.employeeid = np.registeredby`

export const q_filter_patient_using_billingid_query = `SELECT np.firstname, np.lastname, np.middlename, np.email, np.age, np.agetype, np.dob, np.marital_status, np.mobile_number, np.occupation, np.gender, np.organization, np.patientid, np.fullpatientid, np.contactpointer FROM new_patients AS np INNER JOIN billing AS b ON b.patientid = np.patientid WHERE b.billingid = ?`;

export const q_totalpatientcountQuery = `SELECT COUNT(*) AS total FROM new_patients`;
export const q_patient_update_patient_addressing = `UPDATE patientsaddress 
      SET area = ?,
      country= ?,
      district= ?,
      region = ?,
      gpsLocation = ?,
      address = ? 
      WHERE patientid = ?`;

export const isClientSameQuery = `SELECT * FROM patients WHERE mobile = ? OR email = ?`;
export const insertPersonalInformationQuery = `INSERT INTO patients (name, mobile, email, ...) VALUES (?, ?, ?, ...)`;
export const getPatientIDQuery = `SELECT patientid FROM patients WHERE id = ?`;
export const q_patient_info_pagination = `SELECT * FROM patients LIMIT ?  OFFSET ?`;

export const q_patient_update_emmergency_information = `UPDATE patientemmergencycontactinformation 
SET emmergencyContactName = ?,
emmergencyContactNumber = ?, 
relationship = ?,
occupation = ?, 
address = ? 
WHERE patientid = ?
`

export const q_patient_update_personal_information = `UPDATE new_patients 
                   SET firstname = ?,designation = ?, lastname = ?, middlename = ?, email = ?,age = ?, agetype = ?, dob = ?, marital_status = ?, mobile_number = ?, occupation = ?, gender = ?, organization = ?,whatAppcontact = ?
                   WHERE patientid = ?`