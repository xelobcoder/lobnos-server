"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUERIES = exports.q_update_literature_review_by_testid = exports.q_get_literature_review_by_testid = exports.q_select_literature_review = exports.q_insert_literature_review = exports.q_ultrasound_list = void 0;
exports.q_ultrasound_list = `
SELECT tp.name, dp.department ,tp.id FROM test_panels AS tp INNER JOIN departments AS dp ON dp.id = tp.category WHERE dp.department = 'ultrasound' 
`;
exports.q_insert_literature_review = `INSERT INTO setupliteraturereview (testid, literature) VALUES (?, ?)`;
exports.q_select_literature_review = `SELECT useLiterature FROM testdetails WHERE testid = ?`;
exports.q_get_literature_review_by_testid = `SELECT * FROM setupliteraturereview WHERE testid = ?`;
exports.q_update_literature_review_by_testid = `UPDATE setupliteraturereview SET literature = ? WHERE testid = ?`;
exports.QUERIES = {
    SELECT_CATEGORY_BY_ID: `SELECT * FROM test_categories WHERE ID = ?`,
    SELECT_ALL_CATEGORIES: `SELECT * FROM test_categories`,
    INSERT_CATEGORY: `INSERT INTO test_categories (CATEGORY, DESCRIPTION) VALUES (?, ?)`,
    UPDATE_CATEGORY: `UPDATE test_categories SET CATEGORY = ?, DESCRIPTION = ? WHERE ID = ?`,
    DELETE_CATEGORY: `DELETE FROM test_categories WHERE ID = ?`,
};
