export const createFieldConstraintQuery = `
    INSERT INTO field_constraints (
        testid, action, constraint_type, replacement_text,
        value, prefix, suffix
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export const findFieldConstraintsByTestIdQuery = `
    SELECT * FROM field_constraints 
    WHERE testid = ?
`;

export const updateFieldConstraintQuery = `
    UPDATE field_constraints 
    SET testid = ?,
        action = ?,
        constraint_type = ?,
        replacement_text = ?,
        value = ?,
        prefix = ?,
        suffix = ?
    WHERE id = ?
`;

export const deleteFieldConstraintQuery = `
    DELETE FROM field_constraints 
    WHERE id = ?
`;