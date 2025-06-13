import { PrimeLimsTablesetupliteraturereview } from "../database/DatabaseTableSchema";
import { promisifyQuery } from "../hooks/helper";
import logger from "../hooks/logger";
import { q_get_literature_review_by_testid, q_insert_literature_review, q_select_literature_review, q_update_literature_review_by_testid } from "./queries";

const setups: { [key: string]: string } = {};

class TestLiteratureSetup {
     private testname: string;

     constructor(testname: string) {
          this.testname = testname;
     }

     isValidTestname(): boolean {
          return this.testname in setups;
     }

     async getSetupLiterature(tenantId: number, testid: number): Promise<PrimeLimsTablesetupliteraturereview[]> {
          return await promisifyQuery(tenantId, q_get_literature_review_by_testid, [testid]);
     }

     async updateSetupLiterature(tenantId: number, literature: string, testid: number): Promise<any> {
          return await promisifyQuery(tenantId, q_update_literature_review_by_testid, [literature, testid]);
     }

     async canUseLiterature(tenantId: number, testid: number): Promise<boolean> {
          const data = await promisifyQuery(tenantId, q_select_literature_review, [testid]);
          if (data.length === 0) return false;
          const { useLiterature } = data[0];
          return useLiterature === 1;
     }

     async getResultLiterature(tenantId: number, testid: number): Promise<{ can: boolean, literature?: string }> {
          if (await this.canUseLiterature(tenantId, testid)) {
               const dataset = await this.getSetupLiterature(tenantId, testid);
               if (dataset.length > 0) {
                    return { can: true, literature: dataset[0]['literature'] };
               }
          }
          return { can: false };
     }

     async createSetupLiterature(tenantId: number, literature: string, testid: number): Promise<any> {
          try {
               const isNameExist = await this.getSetupLiterature(tenantId, testid);
               if (isNameExist.length > 0) {
                    return await this.updateSetupLiterature(tenantId, literature, testid);
               } else {
                    return await promisifyQuery(tenantId, q_insert_literature_review, [testid, literature]);
               }
          } catch (err) {
               logger.error(err);
               throw new Error(err?.message || 'Something went wrong');
          }
     }

     async getSetupRecords(tenantId: number): Promise<any[]> {
          try {
               return await promisifyQuery(tenantId, `SELECT * FROM ${setups[this.testname]}`);
          } catch (err) {
               logger.error(err);
               return [];
          }
     }

     async validateRecords(records: any[]): Promise<boolean> {
          if (Array.isArray(records) && records.length > 0) {
               const result = records.map((item) => {
                    const values = Object.values(item.toString().trim());
                    return (values.includes(undefined) || values.includes(null) || values.includes('') || values.length === 0) ? false : true;
               });
               return !result.includes(false);
          }
          return false;
     }
}

export default TestLiteratureSetup
