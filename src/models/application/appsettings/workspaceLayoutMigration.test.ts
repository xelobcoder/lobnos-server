import knex from 'knex';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('./repositories/regions-districts-repo', () => ({
     default: class {
          async hasRegionsAndDistrictsTables() { return true; }
          async regionsAndDistrictsHaveData() { return true; }
     },
}));
import { up, down } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_layout';
import { bootstrapApplicationSettings } from './ApplicationSettingsBootstrapper';
import { DEFAULT_BILLING_SETTINGS } from './billingSettingsDefaults';

describe('tenant workspace layout migration', () => {
     beforeEach(() => vi.clearAllMocks());
     function database(hasTable = true, hasColumn = false) {
          const column = {
               notNullable: vi.fn().mockReturnThis(),
               nullable: vi.fn().mockReturnThis(),
               defaultTo: vi.fn().mockReturnThis(),
               alter: vi.fn().mockReturnThis(),
          };
          const table = { enu: vi.fn(() => column), json: vi.fn(() => column), string: vi.fn(() => column), dropColumn: vi.fn() };
          const schema = {
               hasTable: vi.fn().mockResolvedValue(hasTable),
               hasColumn: vi.fn().mockResolvedValue(hasColumn),
               alterTable: vi.fn(async (_name, action) => action(table)),
          };
          const raw = vi.fn().mockResolvedValue([[{ Type: "enum('classic','zoho','claude','ribbon','slack')" }]]);
          const applicationFirst = vi.fn().mockResolvedValue({ keyid: 1, regioncode: 1, districtcode: 2 });
          const insert = vi.fn().mockResolvedValue([1]);
          const db: any = vi.fn((name: string) => {
               const builder = {
                    where: vi.fn().mockReturnThis(),
                    count: vi.fn(() => ({ first: vi.fn().mockResolvedValue({ count: 1 }) })),
                    first: name === 'applicationsettings' ? applicationFirst : vi.fn().mockResolvedValue({ id: name === 'regions' ? 1 : 2 }),
                    insert,
               };
               return builder;
          });
          db.schema = schema;
          db.raw = raw;
          return { db, table, column, schema, raw, applicationFirst, insert };
     }
     it('adds the exact non-null enum and defaults existing/new rows to classic', async () => {
          const t = database();
          await up(t.db);
          expect(t.schema.hasTable).toHaveBeenCalledWith('applicationsettings');
          expect(t.schema.hasColumn).toHaveBeenCalledWith('applicationsettings', 'workspaceLayout');
          expect(t.schema.alterTable).toHaveBeenCalledWith('applicationsettings', expect.any(Function));
          expect(t.table.enu).toHaveBeenCalledWith('workspaceLayout', ['classic', 'zoho', 'claude', 'ribbon', 'slack']);
          expect(t.column.notNullable).toHaveBeenCalledOnce();
          expect(t.column.defaultTo).toHaveBeenCalledWith('classic');
     });
     it.each([[false, false], [true, true]])('does not alter absent tables or existing columns (%s, %s)', async (table, column) => {
          const t = database(table, column);
          await up(t.db);
          expect(t.schema.alterTable).not.toHaveBeenCalled();
     });
     it('compiles an additive MySQL ENUM ALTER without changing identifiers or indexes', async () => {
          const db = knex({ client: 'mysql2' });
          const statements: string[] = [];
          await up({
               schema: {
                    hasTable: async () => true,
                    hasColumn: async () => false,
                    alterTable: async (name:any, action:any) => {
                         statements.push(...db.schema.alterTable(name, action).toSQL().map(statement => statement.sql));
                    },
               },
          } as any);
          expect(statements).toEqual(["alter table `applicationsettings` add `workspaceLayout` enum('classic', 'zoho', 'claude', 'ribbon', 'slack') not null default 'classic'"]);
          await db.destroy();
     });
     it('rolls back only the new column and safely skips repeated rollback', async () => {
          const t = database(true, true);
          await down(t.db);
          expect(t.table.dropColumn).toHaveBeenCalledWith('workspaceLayout');
          t.schema.hasColumn.mockResolvedValue(false);
          t.schema.alterTable.mockClear();
          await down(t.db);
          expect(t.schema.alterTable).not.toHaveBeenCalled();
     });
     it('runs the same migration through the existing tenant bootstrap', async () => {
          const t = database();
          t.schema.hasColumn.mockImplementation(async (_table, column) => column !== 'workspaceLayout');
          mocks.connection.mockResolvedValue(t.db);
          await bootstrapApplicationSettings(42);
          expect(mocks.connection).toHaveBeenCalledWith(42);
          expect(t.table.enu).toHaveBeenCalledWith('workspaceLayout', ['classic', 'zoho', 'claude', 'ribbon', 'slack']);
          expect(t.schema.alterTable).toHaveBeenCalledOnce();
     });
     it('adds ageVariationLimits when upgrading an existing application settings table', async () => {
          const t = database();
          t.schema.hasColumn.mockImplementation(async (_table, column) => column !== 'ageVariationLimits');
          t.raw.mockResolvedValue([[{ Type: "enum('classic','zoho','claude','ribbon','slack','portal')" }]]);
          mocks.connection.mockResolvedValue(t.db);

          await bootstrapApplicationSettings(42);

          expect(t.schema.alterTable).toHaveBeenCalledWith('applicationsettings', expect.any(Function));
          expect(t.table.json).toHaveBeenCalledWith('ageVariationLimits');
          expect(t.column.nullable).toHaveBeenCalled();
     });
     it('propagates migration failure instead of marking a tenant ready', async () => {
          const t = database();
          t.schema.alterTable.mockRejectedValue(new Error('DDL failed'));
          mocks.connection.mockResolvedValue(t.db);
          await expect(bootstrapApplicationSettings(42)).rejects.toThrow('DDL failed');
     });
     it('upgrades an existing tenant with Portal through normal settings bootstrap', async () => {
          const t = database(true, true);
          mocks.connection.mockResolvedValue(t.db);
          await bootstrapApplicationSettings(42);
          expect(t.table.enu).toHaveBeenCalledWith('workspaceLayout', ['classic', 'zoho', 'claude', 'ribbon', 'slack', 'portal']);
          expect(t.column.alter).toHaveBeenCalledOnce();
          expect(t.column.defaultTo).toHaveBeenCalledWith('classic');
          expect(t.schema.alterTable).toHaveBeenCalledOnce();
     });
     it('includes disabled billing defaults when a missing settings row is provisioned', async () => {
          const t = database(true, true);
          t.applicationFirst.mockResolvedValue(undefined);
          mocks.connection.mockResolvedValue(t.db);
          await bootstrapApplicationSettings(42);
          expect(t.insert).toHaveBeenCalledWith(expect.objectContaining({
               keyid: 1, billingsettings: JSON.stringify(DEFAULT_BILLING_SETTINGS),
          }));
     });
});
