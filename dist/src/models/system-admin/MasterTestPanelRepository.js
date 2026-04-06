"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../../database/connection");
class MasterTestPanelRepository {
    constructor() {
        this.getMasterPanels = async () => {
            const rows = await this.connection
                .select('*').from(this.tableName);
            return rows;
        };
        this.getTestCreationRulesByTestId = async (testId) => {
            const rows = await this.connection
                .select('*')
                .from(this.creationRulesTable)
                .where({ testid: testId });
            return rows;
        };
        this.getMasterPanelByTestId = async (testId) => {
            const row = await this.connection('test_panels as tp')
                .leftJoin('departments as d', 'd.id', 'tp.category')
                .select('tp.*', 'd.department as departmentName')
                .where('tp.id', testId)
                .first();
            return row;
        };
        this.getMasterTestDetailsByTestId = async (testId) => {
            const row = await this.connection('testdetails')
                .select('*')
                .where({ testid: testId })
                .first();
            return row;
        };
        this.getMasterTestDetailCategoriesByTestId = async (testId) => {
            const rows = await this.connection('testdetailcategory')
                .select('*')
                .where({ testid: testId, deleted: 0 })
                .orderBy('categoryid', 'asc');
            return rows;
        };
        this.getMasterSetupLiteratureByTestId = async (testId) => {
            const row = await this.connection('setupliteraturereview')
                .select('*')
                .where({ testid: testId })
                .first();
            return row;
        };
        this.getMasterSampleContainerById = async (containerId) => {
            const row = await this.connection('samplecontainer')
                .select('*')
                .where({ id: containerId })
                .first();
            return row;
        };
        this.getMasterFieldConstraintsByRuleIds = async (ruleIds) => {
            if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
                return [];
            }
            const rows = await this.connection('field_constraints')
                .select('*')
                .whereIn('rule_id', ruleIds)
                .orderBy('id', 'asc');
            return rows;
        };
        this.connection = connection_1.systemConfigConnection;
        this.tableName = 'test_panels';
        this.creationRulesTable = 'testcreationrules';
    }
}
exports.default = MasterTestPanelRepository;
