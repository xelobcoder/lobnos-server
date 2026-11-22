import {definitionForSave} from './parameterDefinition';
import {unitForSave} from './UnitCatalogue';
import {ensureParameterDefinitionSchema} from './parameterSchema';
import KnexConnection from "../../database/KnexConnections";
const parameterError = (message:string) => Object.assign(new Error(message),{statusCode:400});
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
     isRequired?: boolean | number | string;
     manual_rerun_enabled?: boolean | number | string;
     result_type?: string | null;
     reference_mode?: string | null;
     unit_code?: string | null;
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
          const conn = await this.connection;
          await ensureParameterDefinitionSchema(conn);
          if (!Array.isArray(rulesData) || !rulesData.length) throw parameterError('Add at least one parameter');
          return conn.transaction(async (trx: any) => {
               const panel = await trx('test_panels').where({id:testid}).forUpdate().first('id');
               if (!panel) throw parameterError('Test panel not found');
               const existingRules = await trx('testcreationrules').where({testid}).select('*');
               const names = new Set<string>(), ids = new Set<number>();
               const resolved = rulesData.map(rule => {
                    const name = String(rule.name || '').trim();
                    const key = name.toLocaleLowerCase();
                    if (!name || names.has(key)) throw parameterError('Parameter names must be present and unique within the panel');
                    names.add(key);
                    let existing: any;
                    if (rule.id !== undefined && rule.id !== null) {
                         const id = Number(rule.id);
                         if (!Number.isSafeInteger(id) || id <= 0) throw parameterError('Invalid parameter ID');
                         existing = existingRules.find((row:any) => Number(row.id) === id);
                         if (!existing) throw parameterError('Parameter ID does not belong to this test panel. Refresh and retry.');
                    } else {
                         // Compatibility with older callers that submit unchanged definitions without IDs.
                         existing = existingRules.find((row:any) => row.name === name);
                    }
                    if (existing) {
                         if (ids.has(Number(existing.id))) throw parameterError('A parameter ID may appear only once');
                         ids.add(Number(existing.id));
                    }
                    return {rule:{...rule,name:existing && rule.name===existing.name ? existing.name : name},existing};
               });
               const removed = existingRules.filter((row:any) => !ids.has(Number(row.id)));
               if (removed.length) {
                    const removedIds = removed.map((row:any) => row.id);
                    for (const table of ['test_results','test_results_ultrasound','test_results_audit_log']) {
                         if (await trx.schema.hasTable(table) && await trx(table).whereIn('fieldid',removedIds).first())
                              throw parameterError('A parameter with historical results cannot be removed');
                    }
                    await trx('testcreationrules').where({testid}).whereIn('id',removedIds).delete();
               }
               const insertedIds: number[] = [];

               for (const {rule:ruleData,existing:existingRule} of resolved) {

                    const updateData = {
                         ...definitionForSave(ruleData),
                         ...await unitForSave(ruleData),
                         name: ruleData.name,
                         isRequired: this.toTinyInt(ruleData.isRequired, this.toTinyInt(existingRule?.isRequired)),
                         manual_rerun_enabled: this.toTinyInt(ruleData.manual_rerun_enabled, this.toTinyInt(existingRule?.manual_rerun_enabled)),
                         field: ruleData.field,
                         value: ruleData.value,
                         hasunits: ruleData.hasunits == null && existingRule ? existingRule.hasunits : this.toTinyInt(ruleData.hasunits),
                         units: ruleData.units,
                         plan: definitionForSave(ruleData).plan ?? ruleData.plan,
                         plain: ruleData.plain,
                         ordering: this.toNullableNumber(ruleData.ordering),
                         isValueTracked: ruleData.isValueTracked == null && existingRule ? existingRule.isValueTracked : this.toTinyInt(ruleData.isValueTracked),
                         textReference: ruleData.textReference,
                         upperlimit: ruleData.upperlimit ?? ruleData.upperLimit,
                         lowerlimit: ruleData.lowerlimit ?? ruleData.lowerLimit,
                         category: ruleData.category,
                         options: ruleData.options,
                         undercategory: ruleData.undercategory == null && existingRule ? existingRule.undercategory : this.toTinyInt(ruleData.undercategory),
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
                         await trx('testcreationrules')
                              .where({ testid, id: existingRule.id })
                              .update(updateData);
                         insertedIds.push(existingRule.id);
                    } else {
                         const insertData = {
                              testid,
                              name: ruleData.name,
                              ...updateData
                         };
                         const result = await trx('testcreationrules')
                              .insert(insertData);
                         insertedIds.push(Array.isArray(result) ? result[0] : result);
                    }
               }

               return insertedIds;
          });
     }

     async findByTestId(testId: number): Promise<TestCreationRule[]> {
          try {
               const conn = await this.connection;
               await ensureParameterDefinitionSchema(conn);
               const result = await conn('testcreationrules')
                    .where('testid', testId)
                    .orderBy('ordering', 'asc');
               return result;
          } catch (error) {
               throw error;
          }
     }

     async findByTestIdAndId(testId: number, ruleId: number): Promise<TestCreationRule | undefined> {
          try {
               const conn = await this.connection;
               await ensureParameterDefinitionSchema(conn);
               const result = await conn('testcreationrules')
                    .where({ testid: testId, id: ruleId })
                    .first();
               return result;
          } catch (error) {
               throw error;
          }
     }

     async update(id: number, updates: Partial<TestCreationRule>): Promise<boolean> {
          try {
               const conn = await this.connection;
               await ensureParameterDefinitionSchema(conn);
               const result = await conn('testcreationrules')
                    .where('id', id)
                    .update(updates);
               return result > 0;
          } catch (error) {
               throw error;
          }
     }

     async delete(id: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               await ensureParameterDefinitionSchema(conn);
               const result = await conn('testcreationrules')
                    .where('id', id)
                    .delete();
               return result > 0;
          } catch (error) {
               throw error;
          }
     }

     async deleteByTestId(testId: number): Promise<boolean> {
          try {
               const conn = await this.connection;
               await ensureParameterDefinitionSchema(conn);
               const result = await conn('testcreationrules')
                    .where('testid', testId)
                    .delete();
               return result > 0;
          } catch (error) {
               throw error;
          }
     }
}

export default TestCreationRulesRepository;