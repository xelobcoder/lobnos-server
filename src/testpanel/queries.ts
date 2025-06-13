export const q_ultrasound_list: string = `
SELECT tp.name, dp.department ,tp.id FROM test_panels AS tp INNER JOIN departments AS dp ON dp.id = tp.category WHERE dp.department = 'ultrasound' 
`


export const q_insert_literature_review = `INSERT INTO setupliteraturereview (testid, literature) VALUES (?, ?)`

export const q_select_literature_review = `SELECT useLiterature FROM testdetails WHERE testid = ?`

export const q_get_literature_review_by_testid = `SELECT * FROM setupliteraturereview WHERE testid = ?`


export const q_update_literature_review_by_testid = `UPDATE setupliteraturereview SET literature = ? WHERE testid = ?`


export const QUERIES = {
     SELECT_CATEGORY_BY_ID: `SELECT * FROM test_categories WHERE ID = ?`,
     SELECT_ALL_CATEGORIES: `SELECT * FROM test_categories`,
     INSERT_CATEGORY: `INSERT INTO test_categories (CATEGORY, DESCRIPTION) VALUES (?, ?)`,
     UPDATE_CATEGORY: `UPDATE test_categories SET CATEGORY = ?, DESCRIPTION = ? WHERE ID = ?`,
     DELETE_CATEGORY: `DELETE FROM test_categories WHERE ID = ?`,
};