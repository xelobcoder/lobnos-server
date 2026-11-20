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

     getMasterSampleTypeById = async (id: number) => this.connection('sampletype').where({id}).first();

     getMasterFieldConstraintsByRuleIds = async (ruleIds: number[]) => {
          if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
               return [];
          }

          const columns = await this.connection('field_constraints').columnInfo();
          const rows = await this.connection('field_constraints')
               .select('*')
               .whereIn(columns.rule_id ? 'rule_id' : 'fieldid', ruleIds)
               .orderBy('id', 'asc');
          return rows;
     }

     getSupplementalSetup = async (testid: number) => {
          const setup: Record<string, any[]> = {};
          for (const table of ['customtestcreation','field_constraints','proceduremanual','test_report_settings','calculated_parameter_formulas','testconditiondefinitions','testconditions']) {
               setup[table] = await this.connection.schema.hasTable(table) ? await this.connection(table).where({testid}) : [];
          }
          return setup;
     }
}
