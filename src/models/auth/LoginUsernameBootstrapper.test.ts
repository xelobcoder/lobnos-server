import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Knex } from 'knex';

const mocks = vi.hoisted(() => ({ connect: vi.fn(), requireTenant: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('../../hooks/configuration', () => ({ effectiveTenantId: (id: number) => id }));
vi.mock('../../hooks/logger', () => ({ default: { info: vi.fn() } }));
vi.mock('../Tenancy/TenantRegistry', () => ({
     TenantRegistry: class { requireTenant = mocks.requireTenant; },
}));

import { bootstrapLoginUsernames } from './LoginUsernameBootstrapper';

interface AccountRow {
     [key: string]: string | number | null;
}
interface Expression {
     sql: string;
     values: string[];
}

function database() {
     const rows: Record<string, AccountRow[]> = {
          roles: [{ employeeid: 4, username: 'Staff Name', password: 'staff-hash', login_username: 'oldstaff' }],
          patients_credentials: [{ patientid: 5, username: 'oldpatient', password: 'patient-hash' }],
          clinicianscredentials: [{ clinicianid: 6, identifier: 'oldclinician', password: 'clinician-hash' }],
     };
     const columns = new Set(['roles.login_username']);
     const writes = vi.fn();
     let invalid = false;
     const db = (table: string) => {
          const filters: Array<(row: AccountRow) => boolean> = [];
          const query = {
               whereNull: (column: string) => {
                    filters.push((row) => row[column] === null || row[column] === undefined);
                    return query;
               },
               orWhere: (_column: string, _operator: string, _value: number) => query,
               whereRaw: (_sql: string, values: string[]) => {
                    const [prefix, id] = values;
                    filters.push((row) => row.login_username !== `${prefix}${String(row[id]).padStart(3, '0')}`);
                    return query;
               },
               first: async (_column?: string) => invalid
                    ? { invalid: true } : rows[table].find((row) => filters.every((filter) => filter(row))),
               update: async (changes: Record<string, null | Expression>) => {
                    writes(table, changes);
                    rows[table].filter((row) => filters.every((filter) => filter(row))).forEach((row) => {
                         for (const [key, expression] of Object.entries(changes)) {
                              if (expression === null) row[key] = null;
                              else if (expression.sql.startsWith('COALESCE')) {
                                   row[key] = row[expression.values[0]] ?? row[expression.values[1]] ?? null;
                              } else if (expression.sql.startsWith('CONCAT')) {
                                   row[key] = `${expression.values[0]}${String(row[expression.values[1]]).padStart(3, '0')}`;
                              } else row[key] = row[expression.values[0]] ?? null;
                         }
                    });
               },
          };
          return query;
     };
     const connection = Object.assign(db, {
          schema: {
               hasTable: async (table: string) => table in rows,
               hasColumn: async (table: string, column: string) => columns.has(`${table}.${column}`) ||
                    ['username', 'identifier'].includes(column),
               alterTable: async (table: string, action: (builder: Knex.CreateTableBuilder) => void) => {
                    const builder = { string: (column: string) => {
                         columns.add(`${table}.${column}`);
                         return { nullable: () => undefined };
                    } };
                    action(builder as unknown as Knex.CreateTableBuilder);
               },
          },
          raw: (sql: string, values: string[]): Expression => ({ sql, values }),
          ref: (column: string): Expression => ({ sql: 'ref', values: [column] }),
          transaction: async (action: (trx: typeof connection) => Promise<void>) => {
               const snapshot = JSON.parse(JSON.stringify(rows)) as typeof rows;
               try { await action(connection); } catch (error) {
                    Object.assign(rows, snapshot);
                    throw error;
               }
          },
     });
     return { connection, rows, columns, writes, markInvalid: () => { invalid = true; } };
}

describe('automatic existing-user migration', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.requireTenant.mockResolvedValue({ platformId: 'PLS20154', tenantId: 397773 });
     });

     it('migrates every account type, preserves old names/passwords/IDs, and is idempotent', async () => {
          const db = database();
          mocks.connect.mockResolvedValue(db.connection);
          await bootstrapLoginUsernames(397773);
          expect(mocks.requireTenant).toHaveBeenCalledWith(397773);
          expect(db.rows.roles[0]).toMatchObject({
               employeeid: 4, username: 'Staff Name', password: 'staff-hash',
               login_username: 'PLS20154S004', legacy_login_username: 'oldstaff',
          });
          expect(db.rows.patients_credentials[0]).toMatchObject({
               patientid: 5, username: 'oldpatient', password: 'patient-hash',
               login_username: 'PLS20154P005', legacy_login_username: 'oldpatient',
          });
          expect(db.rows.clinicianscredentials[0]).toMatchObject({
               clinicianid: 6, identifier: 'oldclinician', password: 'clinician-hash',
               login_username: 'PLS20154C006', legacy_login_username: 'oldclinician',
          });
          expect(db.columns.size).toBe(6);
          db.writes.mockClear();
          await bootstrapLoginUsernames(397773);
          expect(db.writes).not.toHaveBeenCalled();
     });

     it('migrates an account added since the previous startup without losing historical usernames', async () => {
          const db = database();
          mocks.connect.mockResolvedValue(db.connection);
          await bootstrapLoginUsernames(397773);
          db.rows.roles.push({ employeeid: 12345, username: 'New Staff', password: 'new-hash' });
          await bootstrapLoginUsernames(397773);
          expect(db.rows.roles[1]).toMatchObject({
               login_username: 'PLS20154S12345', legacy_login_username: 'New Staff', password: 'new-hash',
          });
          expect(db.rows.roles[0].legacy_login_username).toBe('oldstaff');
     });

     it('surfaces invalid records instead of partially rewriting credentials', async () => {
          const db = database();
          mocks.connect.mockResolvedValue(db.connection);
          db.markInvalid();
          await expect(bootstrapLoginUsernames(397773)).rejects.toThrow('Cannot migrate roles');
          expect(db.writes).not.toHaveBeenCalled();
          expect(db.rows.roles[0].login_username).toBe('oldstaff');
     });
});
