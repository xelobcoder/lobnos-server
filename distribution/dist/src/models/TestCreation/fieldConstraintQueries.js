"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFieldConstraintQuery = exports.updateFieldConstraintQuery = exports.findFieldConstraintsByTestIdQuery = exports.createFieldConstraintQuery = void 0;
exports.createFieldConstraintQuery = `
    INSERT INTO field_constraints (
        testid, action, constraint_type, replacement_text,
        value, prefix, suffix
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
`;
exports.findFieldConstraintsByTestIdQuery = `
    SELECT * FROM field_constraints 
    WHERE testid = ?
`;
exports.updateFieldConstraintQuery = `
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
exports.deleteFieldConstraintQuery = `
    DELETE FROM field_constraints 
    WHERE id = ?
`;
