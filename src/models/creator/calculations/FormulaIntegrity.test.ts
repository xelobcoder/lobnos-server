import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../../database/KnexConnections';
import { transactionalDatabase } from '../../../testSupport/transactionalDatabase';
import { encrypt_value } from '../../../utils/encryptionModels';
import { CalculationFormulaService } from './CalculationFormulaService';
const rules = [{ id: 1, testid: 10, name: 'A' }, { id: 2, testid: 10, name: 'B' }, { id: 3, testid: 10, name: 'C' }];
const formula = (output: number, input: number, expression: string, extra: any = {}) => ({ id: output + 10, testid: 10, output_field_id: output, input_parameters: [{ fieldId: input, token: 'X' }], expression, version: 1, active: 1, effective_from: '2026-01-01', effective_to: null, decimal_precision: 2, ...extra });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('calculation integrity', () => {
     it('orders chained outputs and ignores tampered submitted intermediate results', async () => {
          const store = transactionalDatabase({ calculated_parameter_formulas: [formula(3, 2, 'X*2'), formula(2, 1, 'X+1')], testcreationrules: rules });
          const result = await store.db.transaction((trx: any) => new CalculationFormulaService().prepareResultEntry(1, 10, 20, [{ fieldid: 1, value: '2' }, { fieldid: 2, value: '99' }], trx));
          expect(result.fields.find(row => row.fieldid === 2).value).toBe('3.00');
          expect(result.fields.find(row => row.fieldid === 3).value).toBe('6.00');
          expect(result.auditRecords.map(row => row.fieldId)).toEqual([2, 3]);
     });
     it('decrypts saved inputs when a result update omits those fields', async () => {
          const store = transactionalDatabase({ calculated_parameter_formulas: [formula(2, 1, 'X*2')], testcreationrules: rules, test_results: [{ fieldid: 1, testid: 10, ascensionid: 20, originalvalue: encrypt_value('7.5') }] });
          const result = await store.db.transaction((trx: any) => new CalculationFormulaService().prepareResultEntry(1, 10, 20, [], trx));
          expect(result.fields[0].value).toBe('15.00');
     });
     it('rejects circular dependencies before calculating any output', async () => {
          const store = transactionalDatabase({ calculated_parameter_formulas: [formula(2, 3, 'X+1'), formula(3, 2, 'X+1')] });
          await expect(store.db.transaction((trx: any) => new CalculationFormulaService().prepareResultEntry(1, 10, 20, [], trx))).rejects.toThrow('circular');
     });
     it('keeps today’s formula effective when scheduling its next version', async () => {
          vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T12:00:00Z'));
          const store = transactionalDatabase({ test_panels: [{ id: 10 }], calculated_parameter_formulas: [formula(2, 1, 'X+1')], testcreationrules: rules });
          const connection: any = () => { const query: any = { select: () => query, where: () => query, whereIn: () => query, then: (resolve: any) => resolve(rules.filter(row => row.id <= 2)) }; return query; };
          connection.transaction = store.db.transaction;
          vi.mocked(KnexConnection).mockResolvedValue(connection);
          await new CalculationFormulaService().saveFormula(1, { testId: 10, outputFieldId: 2, inputParameters: [{ fieldId: 1, token: 'X' }], expression: 'X+2', effectiveFrom: '2026-11-01' }, 8);
          expect(store.rows('calculated_parameter_formulas').find(row => row.version === 1)).toMatchObject({ active: 1, effective_to: '2026-10-31' });
          const result = await store.db.transaction((trx: any) => new CalculationFormulaService().prepareResultEntry(1, 10, 20, [{ fieldid: 1, value: '2' }], trx));
          expect(result.fields.find(row => row.fieldid === 2).value).toBe('3.00');
          vi.setSystemTime(new Date('2026-11-01T12:00:00Z'));
          const future = await store.db.transaction((trx: any) => new CalculationFormulaService().prepareResultEntry(1, 10, 20, [{ fieldid: 1, value: '2' }], trx));
          expect(future.fields.find(row => row.fieldid === 2).value).toBe('4.00');
     });
});
