import { afterEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
const state = vi.hoisted(() => ({ db: null as any }));
vi.mock('../../models/inventory/InventoryTransaction', () => ({ InventoryTransactionModel: class { connection = Promise.resolve(state.db); } }));
vi.mock('../../models/inventory', () => ({ InventoryTemplateModel: class {} }));
import { InventoryConsumptionController } from './InventoryConsumptionController';
import { consumptionReportType } from '../../models/inventory/ConsumptionReportSource';

afterEach(async () => { await state.db?.destroy(); });
describe('inventory consumption report', () => {
     it('queries legacy history and workflow movements together for rows, pagination and numeric totals', async () => {
          const db = knex({ client: 'mysql2' }); state.db = db;
          const queries: string[] = [];
          const rows = [
               { id: 'TXN-1', item_id: 'tube', item_name: 'Tube', quantity_consumed: '2.000000', consumption_reason: 'Phlebotomy actual supply usage', consumed_by: 7, patientid: 4, ascensionid: 10, reference_id: 'PHL-20-key', notes: 'Physical sample 20: collection', consumption_date: '2026-10-23' },
               { id: 'CH-1', item_id: 'reagent', quantity_consumed: '1.500000', consumption_reason: 'Laboratory actual material usage', consumption_date: '2026-10-23' },
          ];
          (db.client as any).acquireConnection = async () => ({});
          (db.client as any).releaseConnection = async () => {};
          (db.client as any)._query = async (_connection: any, query: any) => {
               queries.push(query.sql);
               query.response = [query.sql.includes('count(*)') ? [{ count: 2 }] : rows, []];
               return query;
          };
          const res: any = { json: vi.fn(), status: vi.fn().mockReturnThis() };
          await new InventoryConsumptionController().getConsumptionReport({ query: { tenantId: '1', page: '1', count: '10', performed_by: '7' } } as any, res);
          const response = res.json.mock.calls[0][0];
          expect(response.success).toBe(true);
          expect(response.data.consumptions[0]).toMatchObject({ consumption_type: 'phlebotomy', quantity: 2, patientid: 4, reference_id: 'PHL-20-key' });
          expect(response.data.summary).toMatchObject({ total_consumptions: 2, phlebotomy_consumptions: 1, test_consumptions: 1, manual_consumptions: 0, total_quantity_consumed: 3.5 });
          expect(queries).toHaveLength(3);
          for (const sql of queries) {
               expect(sql).toContain('union all');
               expect(sql).toContain('inv_inventory_transactions');
               expect(sql).toContain('not exists');
               expect(sql).toContain('consumed_by');
          }
          expect(queries.some(sql => /insert|update|delete/i.test(sql))).toBe(false);
     });
     it('distinguishes collection usage from laboratory, manual and wastage', () => {
          expect(['Phlebotomy actual supply usage', 'Laboratory actual material usage', 'Manual consumption', 'Test consumption - CBC', 'Wastage - broken'].map(consumption_reason => consumptionReportType({ consumption_reason }))).toEqual(['phlebotomy', 'test', 'manual', 'test', 'wastage']);
     });
});
