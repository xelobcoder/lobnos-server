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
               raw: async () => [[...mocks.tables].flatMap(([table, ddl]) =>
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
