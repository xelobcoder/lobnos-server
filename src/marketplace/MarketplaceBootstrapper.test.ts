import knex, { Knex } from 'knex';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     tables: new Map<string, string>(),
     writes: [] as string[],
     backfill: vi.fn(),
     constraintWrite: vi.fn(),
}));

vi.mock('../database/connection', () => {
     const sql = knex({ client: 'mysql2' });
     const db = Object.assign(
          () => ({ whereNull: () => ({ update: mocks.backfill }) }),
          {
               fn: sql.fn,
               raw: async (query: string) => [query.includes('INFORMATION_SCHEMA.STATISTICS')
                    ? [...mocks.tables].flatMap(([table, ddl]) =>
                         [...ddl.matchAll(/add (unique|index) `[^`]+`\(([^)]+)\)/g)].map(match => ({
                              TABLE_NAME: table, NON_UNIQUE: match[1] === 'unique' ? 0 : 1,
                              INDEX_COLUMNS: match[2].replace(/`/g, '').replace(/ /g, ''),
                         })))
                    : [...mocks.tables].flatMap(([table, ddl]) =>
                    [...ddl.matchAll(/foreign key \(`([^`]+)`\) references `([^`]+)` \(`([^`]+)`\)/g)]
                         .map(match => ({
                              TABLE_NAME: table, COLUMN_NAME: match[1],
                              REFERENCED_TABLE_NAME: match[2], REFERENCED_COLUMN_NAME: match[3],
                         }))),
               ],
          },
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
                         for (const match of text.matchAll(/`([^`]+)`/g)) {
                              if (match[1].length > 64) throw new Error(`Identifier exceeds MySQL limit: ${match[1]}`);
                         }
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
                         for (const match of text.matchAll(/`([^`]+)`/g)) {
                              if (match[1].length > 64) throw new Error(`Identifier exceeds MySQL limit: ${match[1]}`);
                         }
                         if (text.includes('foreign key')) mocks.constraintWrite(text);
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
     mocks.constraintWrite.mockReset();
});

describe('marketplace schema bootstrap', () => {
     it('creates every table using fresh schema builders before checking upgrade columns', async () => {
          await bootstrapMarketplace();
          expect(mocks.tables.size).toBe(15);
          expect(mocks.tables.has('platform_enquiries')).toBe(true);
          expect(mocks.tables.has('marketplace_bookings')).toBe(true);
          expect(mocks.tables.has('marketplace_core_booking_links')).toBe(true);
          expect(mocks.writes).toHaveLength(27);
          expect(mocks.constraintWrite).toHaveBeenCalledTimes(12);
          expect(mocks.backfill).not.toHaveBeenCalled();
     });

     it('can run again without recreating or changing current tables', async () => {
          await bootstrapMarketplace();
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('keeps every generated MySQL identifier within the 64-character limit', async () => {
          expect('marketplace_catalog_mappings_facility_id_core_item_type_core_item_id_unique'.length).toBeGreaterThan(64);
          expect('marketplace_catalog_price_history_facility_id_catalog_item_id_created_at_index'.length).toBeGreaterThan(64);
          await bootstrapMarketplace();
          const names = mocks.writes.flatMap(sql => [...sql.matchAll(/`([^`]+)`/g)].map(match => match[1]));
          expect(names.length).toBeGreaterThan(0);
          expect(names.every(name => name.length <= 64)).toBe(true);
          expect(mocks.tables.get('marketplace_catalog_mappings')).toContain('add unique `uq_marketplace_mapping_core`');
          expect(mocks.tables.get('marketplace_catalog_price_history')).toContain('add index `idx_marketplace_price_history_lookup`');
     });

     it('restores indexes omitted by interrupted DDL without recreating tables', async () => {
          await bootstrapMarketplace();
          for (const name of ['marketplace_catalog_mappings', 'marketplace_catalog_price_history']) {
               mocks.tables.set(name, mocks.tables.get(name)!.split('\n')
                    .filter(line => !line.includes('uq_marketplace_mapping_core') && !line.includes('idx_marketplace_price_history_lookup'))
                    .join('\n'));
          }
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toEqual([
               'alter table `marketplace_catalog_mappings` add unique `uq_marketplace_mapping_core`(`facility_id`, `core_item_type`, `core_item_id`)',
               'alter table `marketplace_catalog_price_history` add index `idx_marketplace_price_history_lookup`(`facility_id`, `catalog_item_id`, `created_at`)',
          ]);
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('accepts equivalent existing indexes regardless of their names', async () => {
          await bootstrapMarketplace();
          mocks.tables.set('marketplace_catalog_mappings', mocks.tables.get('marketplace_catalog_mappings')!
               .replace('uq_marketplace_mapping_core', 'legacy_mapping_unique'));
          mocks.tables.set('marketplace_catalog_price_history', mocks.tables.get('marketplace_catalog_price_history')!
               .replace('idx_marketplace_price_history_lookup', 'legacy_price_lookup'));
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('does not mistake a nonunique mapping index for the required uniqueness constraint', async () => {
          await bootstrapMarketplace();
          mocks.tables.set('marketplace_catalog_mappings', mocks.tables.get('marketplace_catalog_mappings')!
               .replace('add unique `uq_marketplace_mapping_core`', 'add index `legacy_mapping_lookup`'));
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toEqual([
               'alter table `marketplace_catalog_mappings` add unique `uq_marketplace_mapping_core`(`facility_id`, `core_item_type`, `core_item_id`)',
          ]);
     });

     it('upgrades older existing profile and booking tables once', async () => {
          await bootstrapMarketplace();
          mocks.tables.set('marketplace_facilities', mocks.tables.get('marketplace_facilities')!
               .replace(/`opening_hours`/g, '`old_opening_hours`').replace(/`payment_instructions`/g, '`old_payment_instructions`'));
          mocks.tables.set('marketplace_bookings', mocks.tables.get('marketplace_bookings')!
               .replace(/`branch_id`/g, '`old_branch_id`').replace(/`scheduled_at`/g, '`old_scheduled_at`')
               .replace(/`schedule_instructions`/g, '`old_schedule_instructions`'));
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(5);
          expect(mocks.backfill).toHaveBeenCalledWith({ opening_hours: '{}' });
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('repairs a staff table left without its foreign key by an interrupted startup', async () => {
          await bootstrapMarketplace();
          mocks.tables.set('marketplace_staff', mocks.tables.get('marketplace_staff')!.split('\n')
               .filter(line => !line.includes('foreign key')).join('\n'));
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toEqual([
               'alter table `marketplace_staff` add constraint `marketplace_staff_facility_id_foreign` foreign key (`facility_id`) references `marketplace_facilities` (`id`) on delete CASCADE',
          ]);
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('retains the original cascade and restrictive relationships', async () => {
          await bootstrapMarketplace();
          const foreignKeys = mocks.writes.filter(sql => sql.includes('foreign key'));
          expect(foreignKeys.filter(sql => sql.endsWith('on delete CASCADE'))).toHaveLength(8);
          expect(foreignKeys.filter(sql => !sql.includes('on delete'))).toHaveLength(4);
          expect(foreignKeys).toContain(
               'alter table `marketplace_core_booking_links` add constraint `marketplace_core_booking_links_booking_id_foreign` foreign key (`booking_id`) references `marketplace_bookings` (`id`)',
          );
     });

     it('surfaces missing REFERENCES privileges and resumes after the operator grants them', async () => {
          const denied = Object.assign(new Error('REFERENCES command denied'), { code: 'ER_TABLEACCESS_DENIED_ERROR' });
          mocks.constraintWrite.mockImplementationOnce(() => { throw denied; });
          await expect(bootstrapMarketplace()).rejects.toBe(denied);
          expect(mocks.tables.has('marketplace_staff')).toBe(true);
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(12);
          expect(mocks.writes.every(sql => sql.includes('foreign key'))).toBe(true);
          mocks.writes.length = 0;
          await bootstrapMarketplace();
          expect(mocks.writes).toHaveLength(0);
     });

     it('surfaces constraint failures rather than silently accepting an unconstrained schema', async () => {
          const orphan = Object.assign(new Error('Cannot add foreign key constraint'), { code: 'ER_NO_REFERENCED_ROW_2' });
          mocks.constraintWrite.mockImplementationOnce(() => { throw orphan; });
          await expect(bootstrapMarketplace()).rejects.toBe(orphan);
     });
});
