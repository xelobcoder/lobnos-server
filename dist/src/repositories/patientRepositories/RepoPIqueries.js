"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_delete_patient_image = exports.q_update_patient_image = exports.q_find_patient_image_by_id = exports.q_create_patient_image = void 0;
exports.q_create_patient_image = `INSERT INTO patientimages (patientid, imagepath) VALUES (?, ?)`;
exports.q_find_patient_image_by_id = `SELECT imagepath FROM patientimages WHERE patientid = ? `;
exports.q_update_patient_image = `UPDATE patientimages SET imagepath = ? WHERE patientid = ? `;
exports.q_delete_patient_image = `DELETE FROM patientimages WHERE patientid = ? `;
