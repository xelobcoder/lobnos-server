"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTestCreationRuleQuery = exports.getUpdateTestCreationRuleQuery = exports.findTestCreationRulesByTestIdQuery = exports.createTestCreationRuleQuery = void 0;
exports.createTestCreationRuleQuery = `
    INSERT INTO testcreationrules (
        testid, name, field, value, hasunits, units, plan, plain, 
        ordering, isValueTracked, textReference, upperlimit, 
        lowerlimit, category, undercategory, categoryid, 
        valueAlert, alert
    ) VALUES ?
`;
exports.findTestCreationRulesByTestIdQuery = `
    SELECT * FROM testcreationrules 
    WHERE testid = ? 
    ORDER BY ordering ASC
`;
exports.getUpdateTestCreationRuleQuery = `
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
exports.deleteTestCreationRuleQuery = `
    DELETE FROM testcreationrules 
    WHERE id = ?
`;
