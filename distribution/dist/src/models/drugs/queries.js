"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_get_drugs = exports.q_delete_drug_sql = exports.q_check_drug_exists = exports.q_update_drug_sql = exports.q_insert_drug_sql = exports.q_delete_drug_category_sql = exports.q_update_drug_category_sql = exports.q_check_drug_category_exists = exports.q_get_drugs_category = exports.q_insert_drug_category_sql = void 0;
exports.q_insert_drug_category_sql = 'INSERT INTO drugsCategory (categoryName, description, createdBy) VALUES (?, ?, ?)';
exports.q_get_drugs_category = 'SELECT * FROM drugsCategory';
exports.q_check_drug_category_exists = `
    SELECT 1 FROM drugsCategory WHERE categoryName = ? LIMIT 1
`;
exports.q_update_drug_category_sql = `
    UPDATE drugsCategory
    SET categoryName = ?, description = ?, createdBy = ?
    WHERE id = ?
`;
exports.q_delete_drug_category_sql = `
    DELETE FROM drugsCategory
    WHERE id = ?
`;
// DRUGS 
exports.q_insert_drug_sql = 'INSERT INTO drugs (drug, addedOn, category, createdBy) VALUES (?, ?, ?, ?)';
exports.q_update_drug_sql = 'UPDATE drugs SET drug = ?, addedOn = ?, category = ?, createdBy = ? WHERE id = ?';
exports.q_check_drug_exists = 'SELECT * FROM drugs WHERE drug = ? AND category = ?';
exports.q_delete_drug_sql = 'DELETE FROM drugs WHERE id = ?';
exports.q_get_drugs = 'SELECT d.id,d.drug,r.username AS createdBy,dc.categoryName,d.addedOn,dc.id AS categoryid FROM drugs AS d INNER JOIN drugsCategory AS dc ON dc.id = d.category INNER JOIN roles AS r on r.employeeid = d.createdby';
