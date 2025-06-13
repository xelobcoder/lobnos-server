export const q_medical_records_create = `
    INSERT INTO medicalrecords (
        complaints, hpc, pmh, sh, odq, dhx, se, fh, obsGynecHistory, oe, record_type,patientid,consulationby,associatedTransactionid
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?,?,?)
`;

export const q_medical_records_getById = 'SELECT * FROM medicalrecords WHERE id = ?';

export const q_medical_records_update = `UPDATE medicalrecords SET complaints = ?, hpc = ?, pmh = ?, sh = ?, odq = ?, dhx = ?, se = ?, fh = ?, obsGynecHistory = ?, oe = ?, record_type = ?, id = ?, created_at = ?, consulationby = ?, patientid = ?, associatedTransactionid = ? WHERE id = ?
`

export const q_medical_records_delete = 'DELETE FROM medicalrecords WHERE id = ?';

export const q_medical_records_getAll = `
  SELECT mr.*, rr.username AS consultationby, rr.employeeid  
  FROM medicalrecords AS mr 
  INNER JOIN roles AS rr ON rr.employeeid = mr.consulationby
  LIMIT ? OFFSET ?
`;
