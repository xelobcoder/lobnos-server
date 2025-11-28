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
}