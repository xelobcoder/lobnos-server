import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { ensurePharmacySeparationSchema } from './PharmacySeparationSchema';
import { ensurePharmacyOperationsSchema } from './PharmacyOperationsSchema';

describe('pharmacy separation schema', () => {
     it('creates independent storage and guarded additions without changing lab balances', async () => {
          const compiler = knex({ client: 'mysql2' }); const statements: string[] = []; const tables = new Set<string>(), columns = new Set<string>();
          const db: any = { fn: compiler.fn, schema: {
               hasTable: async (table: string) => tables.has(table),
               hasColumn: async (table: string, column: string) => columns.has(`${table}.${column}`),
               createTable: async (table: string, callback: any) => { statements.push(...compiler.schema.createTable(table, callback).toSQL().map(s => s.sql)); tables.add(table); },
               alterTable: async (table: string, callback: any) => {
                    const sql = compiler.schema.alterTable(table, callback).toSQL().map(s => s.sql); statements.push(...sql);
                    for (const statement of sql) for (const match of statement.matchAll(/add `([^`]+)`/g)) columns.add(`${table}.${match[1]}`);
               },
          } };
          await ensurePharmacySeparationSchema(db); await ensurePharmacyOperationsSchema(db); const count = statements.length;
          await ensurePharmacySeparationSchema(db); await ensurePharmacyOperationsSchema(db); expect(statements).toHaveLength(count);
          expect(tables.has('pharmacy_inventory_items')).toBe(true); expect(tables.has('pharmacy_journal_lines')).toBe(true); expect(tables.has('pharmacy_purchase_orders')).toBe(true);
          expect(statements.join('\n')).not.toMatch(/references `(?:inv_|acc_|payment_accounts)/);
          expect(statements.join('\n')).toContain('decimal(14, 3)');
          expect(statements.join('\n')).toContain('decimal(18, 6)');
          expect(statements.join('\n')).toContain('opened_by');
          await compiler.destroy();
     });
});
