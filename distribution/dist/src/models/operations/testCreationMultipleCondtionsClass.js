"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helper_1 = require("../../hooks/helper");
const queries_1 = require("./queries");
class TestCreationMultipleConditionsClass {
    async createTestConditionDefinition(tenantId, conditionName, testId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_create_testConditionDefinition, [conditionName, testId]);
        return result;
    }
    async getTestConditionDefinitionById(tenantId, id) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_read_testConditionDefinition, [tenantId, id]);
        return rows;
    }
    async updateTestConditionDefinition(tenantId, id, conditionName, testId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_update_testConditionDefinition, [tenantId, conditionName, testId, id]);
        return (0, helper_1.rowAffected)(result);
    }
    async deleteTestConditionDefinition(tenantId, id) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_delete_testConditionDefinition, [tenantId, id]);
        return (0, helper_1.rowAffected)(result);
    }
    generateBulkInsertQuery(rows) {
        const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        return `
				INSERT INTO testConditions 
				(testId, parameter, conditionId, target, inRange, conditionConstraint, createdBy) 
				VALUES ${placeholders}
				ON DUPLICATE KEY UPDATE
				testId = VALUES(testId),
				parameter = VALUES(parameter),
				target = VALUES(target),
				inRange = VALUES(inRange),
				createdBy = VALUES(createdBy);
    `;
    }
    async createTestCondition(tenantId, testId, conditionId, fieldConstraints, createdBy) {
        if (!conditionId) {
            throw new Error('Condition ID is null or undefined');
        }
        const values = fieldConstraints.map((constraint) => [
            testId,
            constraint.parameter,
            conditionId,
            constraint.target,
            constraint.inRange,
            constraint.conditionConstraint,
            createdBy || null,
        ]);
        const query = this.generateBulkInsertQuery(values);
        const flattenedValues = values.flat();
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, query, flattenedValues);
            return (0, helper_1.rowAffected)(result);
        }
        catch (error) {
            console.error('Error inserting/updating test conditions:', error);
            throw new Error('Failed to insert/update test conditions');
        }
    }
    async getTestConditionById(tenantId, id) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_read_testCondition, [tenantId, id]);
        return rows;
    }
    async updateTestCondition(tenantId, id, testId, parameter, conditionId, target, inRange, createdBy) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_update_testCondition, [tenantId, testId, parameter, conditionId, target, inRange, createdBy || null, id]);
        return result;
    }
    async deleteTestCondition(tenantId, id) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_multi_delete_testCondition, [tenantId, id]);
        return result;
    }
    async getTestDefinitionConditions(tenantId, conditionId) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_test_definition_conditions, [conditionId]);
    }
    static async getTestDefinitions(tenantId, testid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_test_conditions, [tenantId, testid]);
    }
}
exports.default = TestCreationMultipleConditionsClass;
