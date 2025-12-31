"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_getPatientVitalSign = exports.q_deleteVitalSign = exports.q_createVitalSign = exports.q_updateVitalSign = void 0;
exports.q_updateVitalSign = 'UPDATE dbovitalsigns SET patientid=?,bp=?,temperature=?,pulse=?,respiration=?,employeeid=?,date=?,time=? WHERE id  = ?';
exports.q_createVitalSign = "INSERT INTO  dbovitalsigns  (patientid, bp, temperature, pulse, respiration,spo2, employeeid) VALUES (?,?,?,?,?,?,?)";
exports.q_deleteVitalSign = `DELETE FROM dbovitalsigns WHERE patientid = ? AND vitalsignid = ?`;
exports.q_getPatientVitalSign = "SELECT * FROM  dbovitalsigns  WHERE patientid = ?";
