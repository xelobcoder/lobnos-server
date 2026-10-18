import { describe, expect, it, vi } from 'vitest';
import { up, down } from '../../../cron/command-line-tool-database/migrations/20261018_staff_pin_security';

function schemaFixture(legacyAttempts = false) {
     const tables = new Map<string, Set<string>>([
          ['applicationsettings', new Set(['keyid'])], ['roles', new Set(['employeeid'])],
     ]);
     if (legacyAttempts) tables.set('financial_authorization_attempts', new Set(['actor_employeeid']));
     const definitions: any[] = [];
     const builder = (tableName: string) => {
          const column = (name: string, kind: string) => {
               tables.get(tableName)!.add(name);
               const definition: any = { tableName, name, kind };
               definitions.push(definition);
               const chain: any = {
                    unsigned: () => chain, primary: () => chain, nullable: () => chain, notNullable: () => chain,
                    defaultTo: (value: any) => { definition.default = value; return chain; },
               };
               return chain;
          };
          return {
               integer: (name: string) => column(name, 'integer'),
               datetime: (name: string) => column(name, 'datetime'),
               increments: (name: string) => column(name, 'increments'),
               enum: (name: string) => column(name, 'enum'),
               string: (name: string) => column(name, 'string'),
               index: vi.fn(),
               dropColumn: (name: string) => tables.get(tableName)!.delete(name),
          };
     };
     const first = vi.fn().mockResolvedValue({ pinAttemptLimit: 5 });
     const db: any = vi.fn(() => ({ where: () => ({ first }) }));
     db.fn = { now: () => 'database timestamp' };
     db.raw = vi.fn();
     db.schema = {
          hasTable: async (name: string) => tables.has(name),
          hasColumn: async (table: string, name: string) => tables.get(table)?.has(name) || false,
          alterTable: async (table: string, callback: any) => callback(builder(table)),
          createTable: async (table: string, callback: any) => { tables.set(table, new Set()); callback(builder(table)); },
          dropTableIfExists: async (table: string) => { tables.delete(table); },
     };
     return { db, tables, definitions };
}

describe('staff PIN security schema rollout', () => {
     it('creates tenant-local policy, state and audit schema idempotently without touching PINs', async () => {
          const { db, tables, definitions } = schemaFixture();
          await up(db);
          const firstDefinitions = definitions.length;
          await up(db);
          expect(definitions).toHaveLength(firstDefinitions);
          expect(tables.get('roles')).toEqual(new Set(['employeeid']));
          expect(tables.has('staff_pin_security')).toBe(true);
          expect(tables.has('staff_pin_security_events')).toBe(true);
          expect(definitions.find(column => column.name === 'pinAttemptLimit')).toMatchObject({ default: 5 });
          expect(db.raw).not.toHaveBeenCalled();
     });

     it('imports only the old active failure window once and never reimports after resets', async () => {
          const { db } = schemaFixture(true);
          await up(db);
          await up(db);
          expect(db.raw).toHaveBeenCalledTimes(1);
          const [sql, bindings] = db.raw.mock.calls[0];
          expect(sql).toContain('INNER JOIN roles');
          expect(sql).toContain('GROUP BY a.actor_employeeid');
          expect(sql).not.toContain('ip_address');
          expect(bindings).toEqual([5, expect.any(Date), 'failure', 'rate_limited']);
     });

     it('can remove only its own schema without changing staff accounts', async () => {
          const { db, tables } = schemaFixture();
          await up(db);
          await down(db);
          expect(tables.has('staff_pin_security')).toBe(false);
          expect(tables.has('staff_pin_security_events')).toBe(false);
          expect(tables.get('applicationsettings')).toEqual(new Set(['keyid']));
          expect(tables.get('roles')).toEqual(new Set(['employeeid']));
     });
});
