import { promisifyQuery, rowAffected } from '../../hooks/helper';
import {
	q_test_multi_create_testConditionDefinition,
	q_test_multi_read_testConditionDefinition,
	q_test_multi_update_testConditionDefinition,
	q_test_multi_delete_testConditionDefinition,
	q_test_multi_read_testCondition,
	q_test_multi_update_testCondition,
	q_test_multi_delete_testCondition,
	q_test_definition_conditions,
	q_get_test_conditions
} from './queries';

export default class TestCreationMultipleConditionsClass {
	async createTestConditionDefinition(tenantId: number, conditionName: string, testId: number): Promise<any> {
		const result = await promisifyQuery(tenantId, q_test_multi_create_testConditionDefinition, [ conditionName, testId]);
		return result;
	}

	async getTestConditionDefinitionById(tenantId: number, id: number): Promise<any> {
		const rows = await promisifyQuery(tenantId, q_test_multi_read_testConditionDefinition, [tenantId, id]);
		return rows;
	}

	async updateTestConditionDefinition(tenantId: number, id: number, conditionName: string, testId: number): Promise<any> {
		const result = await promisifyQuery(tenantId, q_test_multi_update_testConditionDefinition, [tenantId, conditionName, testId, id]);
		return rowAffected(result);
	}

	async deleteTestConditionDefinition(tenantId: number, id: number): Promise<any> {
		const result = await promisifyQuery(tenantId, q_test_multi_delete_testConditionDefinition, [tenantId, id]);
		return rowAffected(result);
	}

	generateBulkInsertQuery(rows: any[][]) {
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

	async createTestCondition(
		tenantId: number,
		testId: number,
		conditionId: number,
		fieldConstraints: {
			parameter: string;
			inRange: boolean | number;
			conditionConstraint: string;
			target: string;
		}[],
		createdBy?: number
	): Promise<any> {
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
			const result = await promisifyQuery(tenantId, query, flattenedValues);
			return rowAffected(result);
		} catch (error) {
			console.error('Error inserting/updating test conditions:', error);
			throw new Error('Failed to insert/update test conditions');
		}
	}

	async getTestConditionById(tenantId: number, id: number): Promise<any> {
		const rows = await promisifyQuery(tenantId, q_test_multi_read_testCondition, [tenantId, id]);
		return rows;
	}

	async updateTestCondition(
		tenantId: number,
		id: number,
		testId: number,
		parameter: string,
		conditionId: number,
		target: string,
		inRange: boolean,
		createdBy?: string
	): Promise<any> {
		const result = await promisifyQuery(tenantId, q_test_multi_update_testCondition, [tenantId, testId, parameter, conditionId, target, inRange, createdBy || null, id]);
		return result;
	}

	async deleteTestCondition(tenantId: number, id: number): Promise<any> {
		const result = await promisifyQuery(tenantId, q_test_multi_delete_testCondition, [tenantId, id]);
		return result;
	}

	async getTestDefinitionConditions(tenantId: number, conditionId: number) {
		return await promisifyQuery(tenantId, q_test_definition_conditions, [conditionId]);
	}

	static async getTestDefinitions(tenantId: number, testid: number) {
		return await promisifyQuery(tenantId, q_get_test_conditions, [tenantId, testid]);
	}
}
