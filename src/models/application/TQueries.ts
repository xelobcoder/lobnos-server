export const checkTaxNameExistQuery = `SELECT * FROM tax WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))`;
export const addTaxQuery = `INSERT INTO tax (name, value) VALUES (?, ?)`;
export const getAllTaxesQuery = `SELECT * FROM tax`;
export const updateTaxQuery = `UPDATE tax SET name = ?, value = ? WHERE id = ?`;
export const changeTaxStatusQuery = `UPDATE tax SET apply = ? WHERE id = ?`;
export const deleteTaxQuery = `DELETE FROM tax WHERE id = ?`;
export const activatedTaxes = `SELECT * FROM tax WHERE apply = 'YES'`;
export const getTaxIdsOfActivated = `SELECT id FROM tax WHERE apply  = 'YES'`;