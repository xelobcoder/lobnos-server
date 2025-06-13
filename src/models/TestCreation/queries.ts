export const createTestCreationRuleQuery = `
    INSERT INTO testcreationrules (
        testid, name, field, value, hasunits, units, plan, plain, 
        ordering, isValueTracked, textReference, upperlimit, 
        lowerlimit, category, undercategory, categoryid, 
        valueAlert, alert
    ) VALUES ?
`;

export const findTestCreationRulesByTestIdQuery = `
    SELECT * FROM testcreationrules 
    WHERE testid = ? 
    ORDER BY ordering ASC
`;

export const getUpdateTestCreationRuleQuery  = `
    UPDATE testcreationrules 
    SET testid = ?,
        name = ?,
        field = ?,
        value = ?,
        hasunits = ?,
        units = ?,
        plan = ?,
        plain = ?,
        ordering = ?,
        isValueTracked = ?,
        textReference = ?,
        upperlimit = ?,
        lowerlimit = ?,
        category = ?,
        undercategory = ?,
        categoryid = ?,
        valueAlert = ?,
        alert = ?
    WHERE id = ?
`;

export const deleteTestCreationRuleQuery = `
    DELETE FROM testcreationrules 
    WHERE id = ?
`;