import knex from 'knex';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
import { up, down } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_layout';
import { bootstrapApplicationSettings } from './ApplicationSettingsBootstrapper';

describe('tenant workspace layout migration', () => {
     beforeEach(() => vi.clearAllMocks());
     function database(hasTable = true, hasColumn = false) {
          const column = { notNullable: vi.fn().mockReturnThis(), defaultTo: vi.fn().mockReturnThis(), alter: vi.fn().mockReturnThis() };
          const table = { enu: vi.fn(() => column), dropColumn: vi.fn() };
          const schema = {
               hasTable: vi.fn().mockResolvedValue(hasTable),
               hasColumn: vi.fn().mockResolvedValue(hasColumn),
               alterTable: vi.fn(async (_name, action) => action(table)),
          };
          const raw = vi.fn().mockResolvedValue([[{ Type: "enum('classic','zoho','claude','ribbon','slack')" }]]);
          return { db: { schema, raw } as any, table, column, schema };
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
     it('propagates migration failure instead of marking a tenant ready', async () => {
          const t = database();
          t.schema.alterTable.mockRejectedValue(new Error('DDL failed'));
          mocks.connection.mockResolvedValue(t.db);
          await expect(bootstrapApplicationSettings(42)).rejects.toThrow('DDL failed');
     });
});
