import knex, { Knex } from 'knex';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     tables: new Map<string, string>(),
     writes: [] as string[],
     backfill: vi.fn(),
}));

vi.mock('../database/connection', () => {
     const sql = knex({ client: 'mysql2' });
     const db = Object.assign(
          () => ({ whereNull: () => ({ update: mocks.backfill }) }),
          { fn: sql.fn },
     );
     Object.defineProperty(db, 'schema', {
          get() {
               let used = false;
               const consume = () => {
                    if (used) throw new Error('Knex schema builders must not be reused');
                    used = true;
               };
               return {
                    hasTable: async (name: string) => { consume(); return mocks.tables.has(name); },
                    createTable: async (name: string, callback: (table: Knex.CreateTableBuilder) => void) => {
                         consume();
                         if (mocks.tables.has(name)) throw new Error('Table already exists');
                         const statements = sql.schema.createTable(name, callback).toSQL();
                         const text = statements.map(statement => statement.sql).join('\n');
                         mocks.tables.set(name, text);
                         mocks.writes.push(text);
                    },
                    hasColumn: async (name: string, column: string) => {
                         consume();
                         const text = mocks.tables.get(name);
                         if (!text) throw new Error('Table does not exist');
                         return text.includes(`\`${column}\``);
                    },
                    alterTable: async (name: string, callback: (table: Knex.AlterTableBuilder) => void) => {
                         consume();
                         if (!mocks.tables.has(name)) throw new Error('Table does not exist');
                         const text = sql.schema.alterTable(name, callback).toSQL().map(statement => statement.sql).join('\n');
                         mocks.tables.set(name, `${mocks.tables.get(name)}\n${text}`);
                         mocks.writes.push(text);
                    },
               };
          },
     });
     return { systemConfigConnection: db };
});

import { bootstrapMarketplace } from './MarketplaceBootstrapper';

beforeEach(() => {
     mocks.tables.clear();
     mocks.writes.length = 0;
     mocks.backfill.mockReset();
});

describe('marketplace schema bootstrap', () => {
     it('creates every table using fresh schema builders before checking upgrade columns', async () => {
          await bootstrapMarketplace();
          expect(mocks.tables.size).toBe(15);
          expect(mocks.tables.has('platform_enquiries')).toBe(true);
          expect(mocks.tables.has('marketplace_bookings')).toBe(true);
          expect(mocks.tables.has('marketplace_core_booking_links')).toBe(true);
          expect(mocks.writes).toHaveLength(15);
          expect(mocks.backfill).not.toHaveBeenCalled();
     });

     it('can run again without recreating or changing current tables', async () => {
          await bootstrapMarketplace();
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('upgrades older existing profile and booking tables once', async () => {
          await bootstrapMarketplace();
          mocks.tables.set('marketplace_facilities', 'legacy profile');
          mocks.tables.set('marketplace_bookings', 'legacy bookings');
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(5);
          expect(mocks.backfill).toHaveBeenCalledWith({ opening_hours: '{}' });
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });
});
