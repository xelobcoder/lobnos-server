import { systemConfigConnection } from "../../database/connection";

export default class MasterTestPanelRepository {
     private connection: any;
     private tableName: string;
     private creationRulesTable: string;
     constructor() {
          this.connection = systemConfigConnection;
          this.tableName = 'test_panels';
          this.creationRulesTable = 'testcreationrules';
     }

     getMasterPanels = async () => {
          const rows = await this.connection
               .select('*').from(this.tableName);
          return rows;
     }


     getTestCreationRulesByTestId = async (testId: number) => {
          const rows = await this.connection
               .select('*')
               .from(this.creationRulesTable)
               .where({ testid: testId });
          return rows;
     }

     getMasterPanelByTestId = async (testId: number) => {
          const row = await this.connection('test_panels as tp')
               .leftJoin('departments as d', 'd.id', 'tp.category')
               .select('tp.*', 'd.department as departmentName')
               .where('tp.id', testId)
               .first();
          return row;
     }

     getMasterTestDetailsByTestId = async (testId: number) => {
          const row = await this.connection('testdetails')
               .select('*')
               .where({ testid: testId })
               .first();
          return row;
     }

     getMasterTestDetailCategoriesByTestId = async (testId: number) => {
          const rows = await this.connection('testdetailcategory')
               .select('*')
               .where({ testid: testId, deleted: 0 })
               .orderBy('categoryid', 'asc');
          return rows;
     }

     getMasterSetupLiteratureByTestId = async (testId: number) => {
          const row = await this.connection('setupliteraturereview')
               .select('*')
               .where({ testid: testId })
               .first();
          return row;
     }

     getMasterSampleContainerById = async (containerId: number) => {
          const row = await this.connection('samplecontainer')
               .select('*')
               .where({ id: containerId })
               .first();
          return row;
     }

     getMasterFieldConstraintsByRuleIds = async (ruleIds: number[]) => {
          if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
               return [];
          }

          const rows = await this.connection('field_constraints')
               .select('*')
               .whereIn('rule_id', ruleIds)
               .orderBy('id', 'asc');
          return rows;
     }
}