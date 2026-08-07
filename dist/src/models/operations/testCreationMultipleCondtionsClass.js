"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const helper_1 = require("../../hooks/helper");
const queries_1 = require("./queries");
const TableName = 'testConditionDefinitions';
class TestCreationMultipleConditionsClass {
    async createTestConditionDefinition(tenantId, conditionName, testId, createdBy) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection(TableName).insert({
            conditionName,
            createdBy,
            testId
        });
        return result;
    }
    async getTestConditionDefinitionById(tenantId, id) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const rows = await connection(TableName)
            .leftJoin("roles", "roles.employeeid", `testConditionDefinitions.createdBy`)
            .where({ id }).select(`${TableName}.*`, 'roles.username as createdBy');
        return rows;
    }
    async updateTestConditionDefinition(tenantId, id, conditionName, testId) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection(TableName)
            .update({
            conditionName,
            testId
        })
            .where({ id });
        return Number(result) > 0;
    }
    async deleteTestConditionDefinition(tenantId, id) {
        const result = await (0, KnexConnections_1.default)(tenantId);
        await result(TableName).where({ id }).del();
        return true;
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
            await this.overRideAndGetRidOfExistingConditions(tenantId, testId, conditionId, fieldConstraints);
            return (0, helper_1.rowAffected)(result);
        }
        catch (error) {
            console.error('Error inserting/updating test conditions:', error);
            throw new Error('Failed to insert/update test conditions');
        }
    }
    async overRideAndGetRidOfExistingConditions(tenantId, testId, conditionId, fieldConstraints) {
        const existingConstraints = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_test_conditions, [testId, conditionId]);
        const existingConstraintIds = existingConstraints.map((c) => c.id);
        const newConstraintIds = fieldConstraints.map((c) => c.id).filter((id) => id !== undefined);
        const idsToDelete = existingConstraintIds.filter((id) => !newConstraintIds.includes(id));
        if (idsToDelete.length > 0) {
            const deleteQuery = `DELETE FROM testConditions WHERE id IN (${idsToDelete.map(() => '?').join(', ')})`;
            await (0, helper_1.promisifyQuery)(tenantId, deleteQuery, idsToDelete);
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
        try {
            const connection = await (0, KnexConnections_1.default)(tenantId);
            return await connection('testConditionDefinitions')
                .leftJoin('roles', 'roles.employeeid', 'testConditionDefinitions.createdBy')
                .where({ testId: testid })
                .select('testConditionDefinitions.*', 'roles.username as createdBy');
        }
        catch (error) {
            throw new Error('Failed to fetch test definitions');
        }
    }
}
exports.default = TestCreationMultipleConditionsClass;
