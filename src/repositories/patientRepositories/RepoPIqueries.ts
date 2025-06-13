export const q_create_patient_image = `INSERT INTO patientimages (patientid, imagepath) VALUES (?, ?)`;
export const q_find_patient_image_by_id = `SELECT imagepath FROM patientimages WHERE patientid = ? `;
export const q_update_patient_image = `UPDATE patientimages SET imagepath = ? WHERE patientid = ? `;
export const q_delete_patient_image = `DELETE FROM patientimages WHERE patientid = ? `;