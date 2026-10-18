export const q_insert_drug_category_sql = 'INSERT INTO drugscategory (categoryName, description, createdBy) VALUES (?, ?, ?)';

export const q_get_drugs_category = 'SELECT * FROM drugscategory';

export const q_check_drug_category_exists = `
    SELECT 1 FROM drugscategory WHERE categoryName = ? LIMIT 1
`;

export const q_update_drug_category_sql = `
    UPDATE drugscategory
    SET categoryName = ?, description = ?, createdBy = ?
    WHERE id = ?
`;

export const q_delete_drug_category_sql = `
    DELETE FROM drugscategory
    WHERE id = ?
`;


// DRUGS 


export const q_insert_drug_sql = 'INSERT INTO drugs (drug, addedOn, category, createdBy) VALUES (?, ?, ?, ?)';
export const q_update_drug_sql = 'UPDATE drugs SET drug = ?, addedOn = ?, category = ?, createdBy = ? WHERE id = ?';
export const q_check_drug_exists = 'SELECT * FROM drugs WHERE drug = ? AND category = ?';
export const q_delete_drug_sql = 'DELETE FROM drugs WHERE id = ?';
export const q_get_drugs = 'SELECT d.id,d.drug,r.username AS createdBy,dc.categoryName,d.addedOn,dc.id AS categoryid FROM drugs AS d INNER JOIN drugscategory AS dc ON dc.id = d.category INNER JOIN roles AS r on r.employeeid = d.createdby';
