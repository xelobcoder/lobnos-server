import { describe, expect, it } from 'vitest';
import knex from 'knex';
import { expiredInventoryBatchQuery } from './InventoryBatchQuery';

describe('expired batch accounting query', () => {
     it('aggregates by item and batch before filtering expiry, so outflows without expiry metadata count', () => {
          const connection = knex({ client: 'mysql2' });
          const query = expiredInventoryBatchQuery(connection).toSQL();
          expect(query.sql).toContain('group by `movement`.`item_id`, `movement`.`batch_number`');
          expect(query.sql).toContain('having `expiry_date` < ?');
          expect(query.sql).not.toContain('where `movement`.`expiry_date`');
          expect(query.sql).toContain('SUM(CAST(movement.new_stock AS DECIMAL(20, 6)) - CAST(movement.previous_stock AS DECIMAL(20, 6))) > 0');
          expect(query.sql).not.toContain('SUM(quantity)');
          expect(query.sql).not.toMatch(/\bmovement\.(?:previous_stock|new_stock)\s*-\s*movement\.(?:previous_stock|new_stock)\b/);
          expect(query.sql).toContain('CAST(movement.previous_stock AS DECIMAL(20, 6)) - CAST(movement.new_stock AS DECIMAL(20, 6))');
     });
});
