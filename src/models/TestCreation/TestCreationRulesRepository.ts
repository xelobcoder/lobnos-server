import KnexConnection from "../../database/KnexConnections";
export interface TestCreationRule {
     id?: number;
     testid: number;
     name: string;
     field?: string;
     value?: string;
     hasunits?: boolean | number | string;
     units?: string;
     plan: 'input' | 'textReference' | 'options' | 'plain' | 'limits' | 'greaterLess' | 'ultrasoundFields' | 'greaterLessEqualTo' | 'time' | 'date' | 'datetime';
     plain?: string;
     ordering?: number | string;
     isValueTracked?: boolean | number | string;
     textReference?: string;
     upperlimit?: string;
     lowerlimit?: string;
     upperLimit?: string;
     lowerLimit?: string;
     category?: string;
     options?: string;
     fieldid?: number;
     undercategory?: boolean | number | string;
     categoryid?: number | string;
     valueAlert?: string;
     hasGenderVariation?: boolean;
     alert?: string;
     upperLimitFemale?: string;
     lowerLimitFemale?: string;
     upperLimitMale?: string;
     lowerLimitMale?: string;
     upperLimitChildren?: string;
     lowerLimitChildren?: string;
     upperLimitNeonates?: string;
     lowerLimitNeonates?: string;
}

class TestCreationRulesRepository {
     private tenantId: number;
     private connection: any;
     constructor(tenantId: number) {
          this.tenantId = tenantId;
          this.connection = KnexConnection(tenantId);
     }

     private toNullableNumber(value: unknown): number | null {
          if (value === undefined || value === null || value === '') {
               return null;
          }

          const parsedValue = Number(value);
          return Number.isFinite(parsedValue) ? parsedValue : null;
     }

     private toTinyInt(value: unknown, fallback = 0): number {
          if (value === undefined || value === null || value === '') {
               return fallback;
          }

          if (typeof value === 'boolean') {
               return value ? 1 : 0;
          }

          const parsedValue = Number(value);
          if (!Number.isFinite(parsedValue)) {
               return fallback;
          }

          return parsedValue > 0 ? 1 : 0;
     }

     async create(rulesData: TestCreationRule[], testid: number): Promise<number[]> {
          try {
               const conn = await this.connection;
               const existingRules: Array<{ id: number; name: string }> = await conn('testcreationrules')
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
                         hasunits: this.toTinyInt(ruleData.hasunits),
                         units: ruleData.units,
                         plan: ruleData.plan,
                         plain: ruleData.plain,
                         ordering: this.toNullableNumber(ruleData.ordering),
                         isValueTracked: this.toTinyInt(ruleData.isValueTracked),
                         textReference: ruleData.textReference,
                         upperlimit: ruleData.upperlimit ?? ruleData.upperLimit,
                         lowerlimit: ruleData.lowerlimit ?? ruleData.lowerLimit,
                         category: ruleData.category,
                         options: ruleData.options,
                         undercategory: this.toTinyInt(ruleData.undercategory),
                         categoryid: this.toNullableNumber(ruleData.categoryid),
                         valueAlert: ruleData.valueAlert,
                         alert: ruleData.alert,
                         upperLimitFemale: ruleData.upperLimitFemale,
                         lowerLimitFemale: ruleData.lowerLimitFemale,
                         upperLimitMale: ruleData.upperLimitMale,
                         lowerLimitMale: ruleData.lowerLimitMale,
                         upperLimitChildren: ruleData.upperLimitChildren,
                         lowerLimitChildren: ruleData.lowerLimitChildren,
                         upperLimitNeonates: ruleData.upperLimitNeonates,
                         lowerLimitNeonates: ruleData.lowerLimitNeonates
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