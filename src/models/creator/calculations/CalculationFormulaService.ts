import KnexConnection from '../../../database/KnexConnections';
import { evaluateFormula } from './FormulaEngine';

export interface FormulaInputParameter {
     fieldId: number;
     token: string;
     unit?: string;
}

export interface CalculationFormulaConfig {
     testId: number;
     outputFieldId: number;
     expression: string;
     inputParameters: FormulaInputParameter[];
     unit?: string;
     decimalPrecision?: number;
     conditions?: FormulaCondition[] | null;
     effectiveFrom?: string;
     active?: boolean;
}

export interface FormulaCondition {
     inputToken: string;
     operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';
     value: number;
}

interface FormulaAuditRecord {
     formulaId: number;
     formulaVersion: number;
     fieldId: number;
     resultValue: string;
     inputValues: Record<string, number>;
}

export class CalculationInputError extends Error {
     readonly statusCode = 422;

     constructor(message: string) {
          super(message);
          this.name = 'CalculationInputError';
     }
}

function parseJson<T>(value: T | string): T {
     if (typeof value !== 'string') return value;
     return JSON.parse(value) as T;
}

function dateOnly(value: Date): string {
     return value.toISOString().slice(0, 10);
}

function previousDate(value: string): string {
     const date = new Date(`${value}T00:00:00.000Z`);
     date.setUTCDate(date.getUTCDate() - 1);
     return dateOnly(date);
}

export class CalculationFormulaService {
     async getFormulas(tenantId: number, testId: number): Promise<any[]> {
          const connection = await KnexConnection(tenantId);
          const formulas = await connection('calculated_parameter_formulas')
               .where({ testid: testId })
               .orderBy('output_field_id', 'asc')
               .orderBy('version', 'desc');
          return formulas.map((formula: any) => ({
               ...formula,
               input_parameters: parseJson(formula.input_parameters),
               conditions: formula.conditions ? parseJson(formula.conditions) : null,
          }));
     }

     async saveFormula(
          tenantId: number,
          config: CalculationFormulaConfig,
          employeeId: number
     ): Promise<number> {
          const precision = config.decimalPrecision ?? 2;
          const effectiveFrom = config.effectiveFrom || dateOnly(new Date());
          if (!Number.isInteger(config.testId) || config.testId <= 0 || !Number.isInteger(config.outputFieldId) || config.outputFieldId <= 0) {
               throw new Error('testId and outputFieldId must be positive integers.');
          }
          if (!Number.isInteger(precision) || precision < 0 || precision > 12) {
               throw new Error('decimalPrecision must be an integer between 0 and 12.');
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || Number.isNaN(Date.parse(`${effectiveFrom}T00:00:00Z`))) {
               throw new Error('effectiveFrom must be a valid YYYY-MM-DD date.');
          }
          if (!Array.isArray(config.inputParameters) || config.inputParameters.length === 0 || config.inputParameters.length > 32) {
               throw new Error('A formula must define between 1 and 32 input parameters.');
          }

          const tokens = new Set<string>();
          const inputFieldIds = new Set<number>();
          for (const input of config.inputParameters) {
               if (!Number.isInteger(input.fieldId) || input.fieldId <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(input.token)) {
                    throw new Error('Each formula input requires a valid fieldId and identifier token.');
               }
               if (tokens.has(input.token) || inputFieldIds.has(input.fieldId) || input.fieldId === config.outputFieldId) {
                    throw new Error('Formula input tokens and field IDs must be unique and cannot be the output field.');
               }
               tokens.add(input.token);
               inputFieldIds.add(input.fieldId);
          }
          if (config.conditions && !Array.isArray(config.conditions)) {
               throw new Error('Formula conditions must be an array of numeric input requirements.');
          }
          for (const condition of config.conditions || []) {
               if (!tokens.has(condition.inputToken) || !['eq', 'neq', 'gt', 'gte', 'lt', 'lte'].includes(condition.operator) || !Number.isFinite(condition.value)) {
                    throw new Error('Each formula condition must reference an input token and use a supported numeric comparison.');
               }
          }
          evaluateFormula(config.expression, Object.fromEntries([...tokens].map((token) => [token, 1])));

          const connection = await KnexConnection(tenantId);
          const fieldIds = [config.outputFieldId, ...inputFieldIds];
          const fields = await connection('testcreationrules')
               .select('id', 'testid', 'name', 'field', 'units')
               .where({ testid: config.testId })
               .whereIn('id', fieldIds);
          if (fields.length !== fieldIds.length) {
               throw new Error('The output and input parameters must belong to the configured test.');
          }

          const fieldsById = new Map<number, any>(fields.map((field: any) => [Number(field.id), field]));
          if (config.unit && fieldsById.get(config.outputFieldId)?.units) {
               const configured = String(config.unit).trim().toLowerCase();
               const fieldUnit = String(fieldsById.get(config.outputFieldId).units).trim().toLowerCase();
               if (configured !== fieldUnit) throw new Error('Formula output unit must match the configured result parameter unit.');
          }
          for (const input of config.inputParameters) {
               const fieldUnit = String(fieldsById.get(input.fieldId)?.units || '').trim().toLowerCase();
               const configuredUnit = String(input.unit || '').trim().toLowerCase();
               if (configuredUnit && fieldUnit && configuredUnit !== fieldUnit) {
                    throw new Error(`Formula input unit does not match parameter ${input.fieldId}.`);
               }
          }

          return connection.transaction(async (trx: any) => {
               const previousFormula = await trx('calculated_parameter_formulas')
                    .where({ testid: config.testId, output_field_id: config.outputFieldId })
                    .orderBy('version', 'desc')
                    .first();
               if (previousFormula?.effective_from && effectiveFrom < String(previousFormula.effective_from).slice(0, 10)) {
                    throw new Error('A new formula version cannot become effective before the latest version starts.');
               }

               if (previousFormula?.active) {
                    await trx('calculated_parameter_formulas')
                         .where({ testid: config.testId, output_field_id: config.outputFieldId, active: 1 })
                         .update({ active: 0, effective_to: previousDate(effectiveFrom) });
               }

               const [id] = await trx('calculated_parameter_formulas').insert({
                    testid: config.testId,
                    output_field_id: config.outputFieldId,
                    expression: config.expression.trim(),
                    input_parameters: JSON.stringify(config.inputParameters),
                    unit: config.unit || null,
                    decimal_precision: precision,
                    conditions: config.conditions ? JSON.stringify(config.conditions) : null,
                    version: Number(previousFormula?.version || 0) + 1,
                    effective_from: effectiveFrom,
                    active: config.active === false ? 0 : 1,
                    created_by: employeeId,
               });
               return Number(id);
          });
     }

     async prepareResultEntry(
          tenantId: number,
          testId: number,
          ascensionId: number,
          fields: any[]
     ): Promise<{ fields: any[]; auditRecords: FormulaAuditRecord[] }> {
          const connection = await KnexConnection(tenantId);
          const today = dateOnly(new Date());
          const formulas = await connection('calculated_parameter_formulas')
               .where({ testid: testId, active: 1 })
               .where('effective_from', '<=', today)
               .andWhere((query: any) => query.whereNull('effective_to').orWhere('effective_to', '>=', today))
               .orderBy('version', 'asc');
          if (formulas.length === 0) return { fields, auditRecords: [] };

          const ruleIds = new Set<number>();
          for (const formula of formulas) {
               ruleIds.add(Number(formula.output_field_id));
               for (const input of parseJson<FormulaInputParameter[]>(formula.input_parameters)) ruleIds.add(Number(input.fieldId));
          }
          const rules = await connection('testcreationrules').select('id', 'name', 'field').where({ testid: testId }).whereIn('id', [...ruleIds]);
          const rulesById = new Map<number, any>(rules.map((rule: any) => [Number(rule.id), rule]));
          const incomingById = new Map<number, any>(fields.map((field) => [Number(field.fieldid), field]));
          const missingStoredIds = [...ruleIds].filter((fieldId) => !incomingById.has(fieldId));
          const storedRows = missingStoredIds.length > 0
               ? await connection('test_results')
                    .select('fieldid', 'originalvalue')
                    .where({ ascensionid: ascensionId, testid: testId })
                    .whereIn('fieldid', missingStoredIds)
               : [];
          const storedById = new Map<number, any>(storedRows.map((row: any) => [Number(row.fieldid), row]));
          const outputIds = new Set(formulas.map((formula: any) => Number(formula.output_field_id)));
          const computedFields: any[] = [];
          const auditRecords: FormulaAuditRecord[] = [];

          for (const formula of formulas) {
               const inputs = parseJson<FormulaInputParameter[]>(formula.input_parameters);
               const variables: Record<string, number> = {};
               const inputValues: Record<string, number> = {};
               for (const input of inputs) {
                    const incoming = incomingById.get(Number(input.fieldId));
                    const rawValue = incoming?.value ?? incoming?.originalvalue ?? storedById.get(Number(input.fieldId))?.originalvalue;
                    const value = rawValue === null || rawValue === undefined || String(rawValue).trim() === '' ? NaN : Number(rawValue);
                    if (!Number.isFinite(value)) {
                         throw new CalculationInputError(`Cannot calculate ${rulesById.get(Number(formula.output_field_id))?.name || 'result'}: input ${input.token} is missing or invalid.`);
                    }
                    variables[input.token] = value;
                    inputValues[input.token] = value;
               }

               const conditions = formula.conditions ? parseJson<FormulaCondition[]>(formula.conditions) : [];
               const conditionsMet = conditions.every((condition) => {
                    const value = variables[condition.inputToken];
                    switch (condition.operator) {
                         case 'eq': return value === condition.value;
                         case 'neq': return value !== condition.value;
                         case 'gt': return value > condition.value;
                         case 'gte': return value >= condition.value;
                         case 'lt': return value < condition.value;
                         case 'lte': return value <= condition.value;
                    }
               });
               if (!conditionsMet) {
                    throw new CalculationInputError(`Calculation conditions are not met for ${rulesById.get(Number(formula.output_field_id))?.name || 'the calculated parameter'}.`);
               }

               const result = evaluateFormula(formula.expression, variables);
               const precision = Math.min(12, Math.max(0, Number(formula.decimal_precision ?? 2)));
               const resultValue = result.toFixed(precision);
               const outputRule = rulesById.get(Number(formula.output_field_id));
               if (!outputRule) throw new Error('Configured calculated output parameter no longer exists.');
               computedFields.push({
                    field: outputRule.field || outputRule.name,
                    fieldid: Number(formula.output_field_id),
                    value: resultValue,
                    originalvalue: resultValue,
                    entrymode: 'calculated',
               });
               auditRecords.push({
                    formulaId: Number(formula.id),
                    formulaVersion: Number(formula.version),
                    fieldId: Number(formula.output_field_id),
                    resultValue,
                    inputValues,
               });
          }

          return {
               fields: [...fields.filter((field) => !outputIds.has(Number(field.fieldid))), ...computedFields],
               auditRecords,
          };
     }

     async recordCalculatedResults(
          trx: any,
          auditRecords: FormulaAuditRecord[],
          context: { testId: number; billingId: number; patientId: number; ascensionId: number; employeeId: number }
     ): Promise<void> {
          if (auditRecords.length === 0) return;
          await trx('calculated_parameter_audit').insert(auditRecords.map((record) => ({
               formula_id: record.formulaId,
               formula_version: record.formulaVersion,
               testid: context.testId,
               fieldid: record.fieldId,
               billingid: context.billingId,
               patientid: context.patientId,
               ascensionid: context.ascensionId,
               result_value: record.resultValue,
               input_values: JSON.stringify(record.inputValues),
               employeeid: context.employeeId,
          })));
     }
}