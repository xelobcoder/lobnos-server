import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionalDatabase } from '../../testSupport/transactionalDatabase';
import knex from 'knex';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../application/notifications/services/NotificationDispatcher', () => ({ NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../accountingModule/integrations/InventoryAccounting', () => ({ enqueueStockMovement: vi.fn().mockResolvedValue(undefined) }));

import KnexConnection from '../../database/KnexConnections';
import { enqueueStockMovement } from '../../accountingModule/integrations/InventoryAccounting';
import { NotificationDispatcher } from '../application/notifications/services/NotificationDispatcher';
import { InventoryTransactionModel } from './InventoryTransaction';

function setup(stock = 10) {
     const store = transactionalDatabase({ inv_inventory_items: [{ id: 'item', is_active: true, current_stock: stock, consumption_unit: 'unit', min_stock: 2, cost_price: 3 }] });
     vi.mocked(KnexConnection).mockResolvedValue(store.db);
     return { store, model: new InventoryTransactionModel(1) };
}
const request = (quantity: number): any => ({ item_id: 'item', transaction_type: 'consumption', quantity });

beforeEach(() => { vi.clearAllMocks(); vi.mocked(enqueueStockMovement).mockResolvedValue(undefined); });

describe('inventory stock integrity', () => {
     it('casts unsigned stock columns before subtraction in availability and summary queries', async () => {
          const db = knex({ client: 'mysql2' });
          const statements: string[] = [];
          vi.spyOn(db.client, 'runner').mockImplementation((builder: any) => ({
               run: async () => {
                    const sql = builder.toSQL().sql;
                    statements.push(sql);
                    if (sql.includes('from `inv_inventory_items`')) return { id: 'item', is_active: true, current_stock: 10 };
                    if (sql.includes('group by')) return [{ batch_number: 'batch', total_received: 10, total_consumed: 0 }];
                    return { total_additions: 10, total_consumptions: 0, net_change: 10 };
               },
          }) as any);
          vi.mocked(KnexConnection).mockResolvedValue(db);
          const model = new InventoryTransactionModel(1);
          await model.getAvailableStockDetails('item');
          await model.getTransactionSummary();
          const queries = statements.filter(sql => sql.includes('inv_inventory_transactions'));
          expect(queries).toHaveLength(2);
          for (const sql of queries) {
               expect(sql).not.toMatch(/\b(?:previous_stock|new_stock)\s*-\s*(?:previous_stock|new_stock)\b/);
               expect(sql).toContain('CAST(new_stock AS DECIMAL(20, 6)) - CAST(previous_stock AS DECIMAL(20, 6))');
               expect(sql).toContain('CAST(previous_stock AS DECIMAL(20, 6)) - CAST(new_stock AS DECIMAL(20, 6))');
          }
     });
     it.each([-1, 0, NaN, Infinity, '2'])('rejects invalid quantity %s before any stock write', async quantity => {
          const { store, model } = setup();
          await expect(model.create(request(quantity as any))).rejects.toThrow();
          expect(store.rows('inv_inventory_items')[0].current_stock).toBe(10);
          expect(store.rows('inv_inventory_transactions')).toEqual([]);
     });

     it('converts bulk purchases and handles repeated items using the running stock balance', async () => {
          const { store, model } = setup();
          const rows = await model.createBulk([
               { ...request(2), transaction_type: 'addition', unit_type: 'purchase', purchase_unit: 'box', units_per_purchase_unit: 12 },
               request(4),
          ]);
          expect(rows.map(row => [row.previous_stock, row.new_stock])).toEqual([[10, 34], [34, 30]]);
          expect(rows[0].total_cost).toBe(72);
          expect(new Set(rows.map(row => row.id)).size).toBe(2);
          expect(store.rows('inv_inventory_items')[0].current_stock).toBe(30);
          expect(enqueueStockMovement).toHaveBeenCalledTimes(2);
          expect(store.events[0]).toBe('lock:inv_inventory_items');
     });

     it('does not allow two simultaneous issues to consume the same stock', async () => {
          const { store, model } = setup();
          const results = await Promise.allSettled([model.create(request(7)), model.create(request(7))]);
          expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(store.rows('inv_inventory_items')[0].current_stock).toBe(3);
          expect(store.rows('inv_inventory_transactions')).toHaveLength(1);
     });

     it('rolls back an entire bulk operation and emits no alerts when accounting fails', async () => {
          const { store, model } = setup();
          vi.mocked(enqueueStockMovement).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('outbox unavailable'));
          await expect(model.createBulk([request(2), request(2)])).rejects.toThrow('outbox unavailable');
          expect(store.rows('inv_inventory_items')[0].current_stock).toBe(10);
          expect(store.rows('inv_inventory_transactions')).toEqual([]);
          expect(NotificationDispatcher.dispatch).not.toHaveBeenCalled();
          expect(store.events).toContain('rollback');
     });
});
