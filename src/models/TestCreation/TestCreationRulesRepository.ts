import KnexConnection from "../../database/KnexConnections";
export interface TestCreationRule {
     id?: number;
     testid: number;
     name: string;
     field?: string;
     value?: string;
     hasunits?: boolean;
     units?: string;
     plan: 'input' | 'textReference' | 'options' | 'plain' | 'limits';
     plain?: string;
     ordering?: number;
     isValueTracked?: boolean;
     textReference?: string;
     upperlimit?: string;
     lowerlimit?: string;
     category?: string;
     options?: string;
     fieldid?: number;
     undercategory?: boolean;
     categoryid?: number;
     valueAlert?: string;
     hasGenderVariation: boolean;
     alert?: string;
}

class TestCreationRulesRepository {
     private tenantId: number;
     private connection: any;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     async create(rulesData: TestCreationRule[], testid: number): Promise<number[]> {
          try {
               const conn = await this.connection;
               const existingRules = await conn('testcreationrules')
                    .where('testid', testid)
                    .select('id', 'name');

               const newRuleNames = rulesData.map(rule => rule.name);
               const rulesToDelete = existingRules.filter(rule =>
                    !newRuleNames.includes(rule.name)
               );

               if (rulesToDelete.length > 0) {
                    await conn('testcreationrules')
                         .whereIn('id', rulesToDelete.map(rule => rule.id))
                         .delete();
               }


               const insertedIds: number[] = [];

               for (const ruleData of rulesData) {
                    const existingRule = await conn('testcreationrules')
                         .where({ testid, name: ruleData.name })
                         .first();

                    const updateData = {
                         field: ruleData.field,
                         value: ruleData.value,
                         hasunits: ruleData.hasunits,
                         units: ruleData.units,
                         plan: ruleData.plan,
                         plain: ruleData.plain,
                         ordering: ruleData.ordering,
                         isValueTracked: ruleData.isValueTracked,
                         textReference: ruleData.textReference,
                         upperlimit: ruleData.upperlimit ,
                         lowerlimit: ruleData.lowerlimit,
                         category: ruleData.category,
                         options: ruleData.options,
                         undercategory: ruleData.undercategory,
                         categoryid: ruleData.categoryid,
                         valueAlert: ruleData.valueAlert,
                         alert: ruleData.alert
                    };

                    if (existingRule) {
                         await conn('testcreationrules')
                              .where({ testid, name: ruleData.name })
                              .update(updateData);
                         insertedIds.push(existingRule.id);
                    } else {
                         const insertData = {
                              testid,
                              name: ruleData.name,
                              ...updateData
                         };
                         const result = await conn('testcreationrules')
                              .insert(insertData);
                         insertedIds.push(Array.isArray(result) ? result[0] : result);
                    }
               }

               return insertedIds;
          } catch (error) {
               console.error('Test creation rules bulk creation error:', error);
               throw error;
          }
     }

     async findByTestId(testId: number): Promise<TestCreationRule[]> {
          try {
               const conn = await this.connection;
               const result = await conn('testcreationrules')
                    .where('testid', testId)
                    .orderBy('ordering', 'asc');
               return result;
          } catch (error) {
               console.error('Test creation rule find by test error:', error);
               throw error;
          }
     }

     async findByTestIdAndId(testId: number, ruleId: number): Promise<TestCreationRule | undefined> {
          try {
               const conn = await this.connection;
               const result = await conn('testcreationrules')
                    .where({ testid: testId, id: ruleId })
                    .first();
               return result;
          } catch (error) {
               console.error('Test creation rule find by test and id error:', error);
               throw error;
          }
     }

     async update(id: number, updates: Partial<TestCreationRule>): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('testcreationrules')
                    .where('id', id)
                    .update(updates);
               return result > 0;
          } catch (error) {
               console.error('Test creation rule update error:', error);
               throw error;
          }
     }

     async delete(id: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('testcreationrules')
                    .where('id', id)
                    .delete();
               return result > 0;
          } catch (error) {
               console.error('Test creation rule delete error:', error);
               throw error;
          }
     }

     async deleteByTestId(testId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               const result = await conn('testcreationrules')
                    .where('testid', testId)
                    .delete();
               return result > 0;
          } catch (error) {
               console.error('Test creation rule delete by test error:', error);
               throw error;
          }
     }
}

export default TestCreationRulesRepository;