export const q_updateVitalSign = 'UPDATE dbovitalsigns SET bp=?,temperature=?,pulse=?,respiration=?,spo2=?,employeeid=? WHERE patientid=? AND vitalsignid=?';

export const q_createVitalSign = "INSERT INTO  dbovitalsigns  (patientid, bp, temperature, pulse, respiration,spo2, employeeid) VALUES (?,?,?,?,?,?,?)"

export const q_deleteVitalSign = `DELETE FROM dbovitalsigns WHERE patientid = ? AND vitalsignid = ?`;

export const q_getPatientVitalSign = "SELECT * FROM  dbovitalsigns  WHERE patientid = ?";