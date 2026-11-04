import { beforeEach, describe, expect, it, vi } from 'vitest';
import knex, { Knex } from 'knex';

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
     const checks = vi.fn();
     let invalid = false;
     const historyTypes = new Map<string, string>();
     const db = (table: string) => {
          const filters: Array<(row: AccountRow) => boolean> = [];
          const query = {
               columnInfo: async () => ({ type: historyTypes.get(table) || 'varchar' }),
               whereNull: (column: string) => {
                    filters.push((row) => row[column] === null || row[column] === undefined);
                    return query;
               },
               orWhere: (_column: string, _operator: string, _value: number) => query,
               whereRaw: (sql: string, values: string[]) => {
                    checks(sql, values);
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
                    const builder = {
                         string: (column: string) => { columns.add(`${table}.${column}`); return { nullable: () => undefined }; },
                         text: (column: string) => {
                              columns.add(`${table}.${column}`); historyTypes.set(table, 'longtext');
                              return { nullable: () => ({ alter: () => undefined }) };
                         },
                    };
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
     return { connection, rows, columns, writes, checks, historyTypes, markInvalid: () => { invalid = true; } };
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

     it('widens legacy history fields and preserves historical usernames beyond the former 64-character limit', async () => {
          const db = database();
          db.columns.add('patients_credentials.legacy_login_username');
          db.rows.patients_credentials[0].username = 'p'.repeat(100);
          mocks.connect.mockResolvedValue(db.connection);
          await bootstrapLoginUsernames(397773);
          expect(db.historyTypes.get('patients_credentials')).toBe('longtext');
          expect(db.rows.patients_credentials[0].legacy_login_username).toBe('p'.repeat(100));
     });

     it('explicitly preserves automatic account update timestamps during login migration', async () => {
          const db = database();
          db.columns.add('patients_credentials.updated_on');
          db.rows.patients_credentials[0].updated_on = '2020-02-03 10:20:30';
          mocks.connect.mockResolvedValue(db.connection);
          await bootstrapLoginUsernames(397773);
          expect(db.rows.patients_credentials[0].updated_on).toBe('2020-02-03 10:20:30');
          const changes = db.writes.mock.calls.filter(([table]) => table === 'patients_credentials').map(([, change]) => change);
          expect(changes).toHaveLength(3);
          expect(changes.every(change => change.updated_on?.sql === 'ref')).toBe(true);
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

     it('compiles collation-independent comparisons and explicitly collated historical username copies for every account type', async () => {
          const db = database();
          mocks.connect.mockResolvedValue(db.connection);
          await bootstrapLoginUsernames(397773);
          const sql = knex({ client: 'mysql2' });
          for (const [query, bindings] of db.checks.mock.calls) {
               const compiled = sql.raw(query, bindings).toSQL();
               expect(compiled.sql).toMatch(/CAST\(login_username AS BINARY\) <> CAST\(CONCAT\(\?, LPAD\(CAST\(`/);
               expect(compiled.bindings).toHaveLength(1);
          }
          const historical = db.writes.mock.calls.filter(([, changes]) => changes.legacy_login_username);
          expect(historical).toHaveLength(3);
          for (const [, changes] of historical) {
               const expression: Expression = changes.legacy_login_username;
               const compiled = sql.raw(expression.sql, expression.values).toSQL();
               expect(compiled.sql).toMatch(/^COALESCE\(CONVERT\(`login_username` USING utf8mb4\) COLLATE utf8mb4_bin, CONVERT\(`/);
               expect(compiled.sql).toMatch(/USING utf8mb4\) COLLATE utf8mb4_bin\)$/);
               expect(compiled.bindings).toHaveLength(0);
          }
          await sql.destroy();
     });

     it('preserves Unicode historical usernames and canonicalizes case and padding without changing passwords', async () => {
          const db = database();
          db.rows.roles[0].login_username = 'pls20154s004 ';
          db.rows.patients_credentials[0].username = 'Ren\u00e9 \u4e2d';
          mocks.connect.mockResolvedValue(db.connection);
          await bootstrapLoginUsernames(397773);
          expect(db.rows.roles[0]).toMatchObject({
               login_username: 'PLS20154S004', legacy_login_username: 'pls20154s004 ', password: 'staff-hash',
          });
          expect(db.rows.patients_credentials[0]).toMatchObject({
               login_username: 'PLS20154P005', legacy_login_username: 'Ren\u00e9 \u4e2d', password: 'patient-hash',
          });
          db.writes.mockClear();
          await bootstrapLoginUsernames(397773);
          expect(db.writes).not.toHaveBeenCalled();
     });
});
