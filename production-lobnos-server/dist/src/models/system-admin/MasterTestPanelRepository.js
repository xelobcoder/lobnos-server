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
        this.connection = connection_1.systemConfigConnection;
        this.tableName = 'test_panels';
        this.creationRulesTable = 'testcreationrules';
    }
}
exports.default = MasterTestPanelRepository;
