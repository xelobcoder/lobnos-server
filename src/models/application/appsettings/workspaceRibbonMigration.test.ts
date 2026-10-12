import knex, { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { up, down } from '../../../cron/command-line-tool-database/migrations/20261012_workspace_ribbon';

describe('ribbon layout enum upgrade', () => {
     function database(type = "enum('classic','zoho','claude')", hasTable = true, hasColumn = true) {
          const sql = knex({ client: 'mysql2' });
          const statements: string[] = [];
          const update = vi.fn().mockResolvedValue(1);
          const where = vi.fn(() => ({ update }));
          const connection = Object.assign(vi.fn(() => ({ where })), {
               raw: vi.fn().mockResolvedValue([[{ Type: type }]]),
               schema: {
                    hasTable: vi.fn().mockResolvedValue(hasTable),
                    hasColumn: vi.fn().mockResolvedValue(hasColumn),
                    alterTable: vi.fn(async (name: string, action: (table: Knex.CreateTableBuilder) => void) => {
                         statements.push(...sql.schema.alterTable(name, action).toSQL().map(statement => statement.sql));
                    }),
               },
          });
          return { connection: connection as unknown as Knex, raw: connection.raw, alterTable: connection.schema.alterTable, statements, update, where };
     }

     it('widens the existing MySQL enum without dropping values or the column', async () => {
          const t = database();
          await up(t.connection);
          expect(t.statements).toEqual([
               "alter table `applicationsettings` modify `workspaceLayout` enum('classic', 'zoho', 'claude', 'ribbon') not null default 'classic'",
          ]);
          expect(t.update).not.toHaveBeenCalled();
     });
     it.each([[false, false], [true, false], [true, true]])('skips absent or already upgraded schemas (%s, %s)', async (table, column) => {
          const t = database("enum('classic','zoho','claude','ribbon')", table, column);
          await up(t.connection);
          expect(t.statements).toEqual([]);
     });
     it('normalizes only ribbon rows before narrowing the enum on rollback', async () => {
          const t = database("enum('classic','zoho','claude','ribbon')");
          await down(t.connection);
          expect(t.where).toHaveBeenCalledWith({ workspaceLayout: 'ribbon' });
          expect(t.update).toHaveBeenCalledWith({ workspaceLayout: 'classic' });
          expect(t.statements).toEqual([
               "alter table `applicationsettings` modify `workspaceLayout` enum('classic', 'zoho', 'claude') not null default 'classic'",
          ]);
          expect(t.update.mock.invocationCallOrder[0]).toBeLessThan(t.alterTable.mock.invocationCallOrder[0]);
     });
     it('skips repeated rollback', async () => {
          const t = database();
          await down(t.connection);
          expect(t.statements).toEqual([]);
          expect(t.update).not.toHaveBeenCalled();
     });
     it('propagates inspection and normalization failures', async () => {
          const t = database();
          t.raw.mockRejectedValue(new Error('inspection failed'));
          await expect(up(t.connection)).rejects.toThrow('inspection failed');
          const rollback = database("enum('classic','zoho','claude','ribbon')");
          rollback.update.mockRejectedValue(new Error('write failed'));
          await expect(down(rollback.connection)).rejects.toThrow('write failed');
          expect(rollback.statements).toEqual([]);
     });
});
