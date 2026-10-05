import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     connectionMock: vi.fn(),
     formulas: [] as any[],
     rules: [] as any[],
     storedRows: [] as any[],
}));

vi.mock('../../../database/KnexConnections', () => ({ default: state.connectionMock }));

import { CalculationFormulaService } from './CalculationFormulaService';

function makeDatabase() {
     return ((table: string) => {
          const records = table === 'calculated_parameter_formulas' ? state.formulas
               : table === 'testcreationrules' ? state.rules
                    : state.storedRows;
          const query: any = {
               select: () => query,
               where: () => query,
               whereIn: () => query,
               orderBy: () => query,
               andWhere: (callback: (builder: any) => void) => { callback(query); return query; },
               whereNull: () => query,
               orWhere: () => query,
               then: (resolve: any, reject: any) => Promise.resolve(records).then(resolve, reject),
          };
          return query;
     }) as any;
}

describe('CalculationFormulaService.prepareResultEntry', () => {
     beforeEach(() => {
          state.formulas = [{
               id: 5,
               version: 2,
               output_field_id: 3,
               expression: '(A * B) / D',
               input_parameters: [
                    { fieldId: 1, token: 'A' },
                    { fieldId: 2, token: 'B' },
                    { fieldId: 4, token: 'D' },
               ],
               decimal_precision: 2,
               conditions: [{ inputToken: 'A', operator: 'gte', value: 1 }],
          }];
          state.rules = [
               { id: 1, name: 'A', field: 'A' },
               { id: 2, name: 'B', field: 'B' },
               { id: 3, name: 'C', field: 'C' },
               { id: 4, name: 'D', field: 'D' },
          ];
          state.storedRows = [];
          state.connectionMock.mockResolvedValue(makeDatabase());
     });

     it('replaces submitted calculated values and returns formula provenance', async () => {
          const result = await new CalculationFormulaService().prepareResultEntry(1, 10, 20, [
               { fieldid: 1, value: '10', originalvalue: '10' },
               { fieldid: 2, value: '5', originalvalue: '5' },
               { fieldid: 3, value: '999', originalvalue: '999' },
               { fieldid: 4, value: '2', originalvalue: '2' },
          ]);

          expect(result.fields.find((field) => field.fieldid === 3)).toMatchObject({
               value: '25.00',
               originalvalue: '25.00',
               entrymode: 'calculated',
          });
          expect(result.auditRecords).toEqual([expect.objectContaining({
               formulaId: 5,
               formulaVersion: 2,
               resultValue: '25.00',
               inputValues: { A: 10, B: 5, D: 2 },
          })]);
     });

     it('refuses to calculate when an input is missing', async () => {
          await expect(new CalculationFormulaService().prepareResultEntry(1, 10, 20, [
               { fieldid: 1, value: '10' },
               { fieldid: 2, value: '5' },
          ])).rejects.toThrow('input D is missing or invalid');
     });
});