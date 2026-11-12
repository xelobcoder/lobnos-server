import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'crypto';

interface Row {
     id?: number;
     entity_type?: string;
     entity_id?: number;
     code_hash?: string;
     expires_at?: Date;
     attempts?: number;
     verified_at?: Date | null;
     created_at?: Date;
     password?: string;
     [key: string]: unknown;
}

const mocks = vi.hoisted(() => ({
     connect: vi.fn(),
     send: vi.fn(),
     provider: vi.fn(),
     hash: vi.fn(async (password: string) => `hashed:${password}`),
}));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('bcrypt', () => ({ default: { hash: mocks.hash } }));
vi.mock('../application/email/repositories/EmailProvidersRepo', () => ({
     EmailProvidersRepo: class { findDefault = mocks.provider; },
}));
vi.mock('../application/email/services/ProviderFactory', () => ({
     ProviderFactory: class { create() { return { send: mocks.send }; } },
}));

import { PasswordRecoveryService } from './PasswordRecoveryService';

function database(accounts: Record<string, Row[]>) {
     const tables: Record<string, Row[]> = { password_reset_otps: [], login_attempt_security: [], portal_login_attempt_security: [], ...accounts };
     const failures = { revoke: false };
     const connection = (table: string) => {
          const name = table.split(' as ')[0];
          const filters: Array<(row: Row) => boolean> = [];
          const matches = (row: Row) => filters.every((filter) => filter(row));
          const query = {
               select: (..._columns: string[]) => query,
               leftJoin: (..._columns: string[]) => query,
               where: (column: string | Record<string, unknown>, value?: unknown) => {
                    if (typeof column === 'string') filters.push((row) => row[column.split('.').pop()!] === value);
                    else filters.push((row) => Object.entries(column).every(([key, entry]) => row[key] === entry));
                    return query;
               },
               whereNotNull: (column: string) => {
                    filters.push((row) => row[column] !== null && row[column] !== undefined);
                    return query;
               },
               andWhere: (column: string, operator: string, value: Date | number) => {
                    filters.push((row) => {
                         const actual = row[column] instanceof Date ? Number(row[column]) : Number(row[column]);
                         return operator === '>' ? actual > Number(value) : actual < Number(value);
                    });
                    return query;
               },
               forUpdate: () => query,
               first: async () => tables[name].find(matches),
               update: async (changes: Row) => {
                    if (name === 'loginlogs' && failures.revoke) throw new Error('Session storage unavailable');
                    const rows = tables[name].filter(matches);
                    rows.forEach((row) => Object.assign(row, changes));
                    return rows.length;
               },
               increment: async (column: string, value: number) => {
                    tables[name].filter(matches).forEach((row) => { row[column] = Number(row[column]) + value; });
               },
               del: async () => {
                    tables[name] = tables[name].filter((row) => !matches(row));
               },
               insert: (row: Row) => ({
                    onConflict: (_columns: string[]) => ({
                         merge: async (_columns: string[]) => {
                              const existing = tables[name].find((entry) => entry.entity_type === row.entity_type && entry.entity_id === row.entity_id);
                              if (existing) Object.assign(existing, row);
                              else tables[name].push({ ...row, id: 1 });
                         },
                    }),
               }),
          };
          return query;
     };
     let pending = Promise.resolve();
     const transaction = <T>(action: (trx: typeof connection) => Promise<T>) => {
          const next = pending.then(async () => {
               const snapshot = structuredClone(tables);
               try { return await action(connection); }
               catch (error) { Object.assign(tables, snapshot); throw error; }
          });
          pending = next.then(() => undefined, () => undefined);
          return next;
     };
     return {
          connection: Object.assign(connection, { schema: { hasTable: async () => true }, transaction }),
          tables,
          failures,
     };
}

describe('tenant-local password recovery', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('ACCESS_TOKEN_SECRET', 'recovery-test-secret');
          mocks.provider.mockResolvedValue({ id: 1, from_email: 'sender@example.test', from_name: 'Lab' });
          mocks.send.mockResolvedValue({ success: true });
     });

     const setup = () => {
          const db = database({
               roles: [{ employeeid: 42, email: 'staff@example.test', password: 'old' }],
               patients_credentials: [{ patientid: 42, email: 'patient@example.test', password: 'old' }],
               clinicianscredentials: [{ clinicianid: 42, clinician_email: 'doctor@example.test', password: 'old' }],
               loginlogs: [
                    { employeeid: 42, loginSessionId: 'browser', loggedout: false },
                    { employeeid: 42, loginSessionId: 'device-manager:one', loggedout: false },
                    { employeeid: 99, loginSessionId: 'other-user', loggedout: false },
               ],
               patient_portal_accounts: [{ patientid: 42, session_version: 3 }, { patientid: 99, session_version: 7 }],
          });
          mocks.connect.mockResolvedValue(db.connection);
          return { ...db, service: new PasswordRecoveryService(123) };
     };

     const seed = (tables: Record<string, Row[]>, overrides: Row = {}) => {
          tables.password_reset_otps.push({
               id: 1, entity_type: 'staff', entity_id: 42,
               code_hash: createHmac('sha256', 'recovery-test-secret').update('123456').digest('hex'),
               expires_at: new Date(Date.now() + 600_000), attempts: 0,
               verified_at: null, created_at: new Date(Date.now() - 61_000), ...overrides,
          });
     };

     it.each([
          ['staff', 'staff@example.test'],
          ['patient', 'patient@example.test'],
          ['clinician', 'doctor@example.test'],
     ] as const)('sends OTP only to the matching %s email in the selected tenant', async (type, email) => {
          const { service } = setup();
          expect(await service.sendOtp(type, 42, email.toUpperCase())).toBe(true);
          expect(mocks.connect).toHaveBeenCalledWith(123);
          expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: [email] }));
     });

     it('does not send a code for a mismatched email or absent account', async () => {
          const { service } = setup();
          expect(await service.sendOtp('staff', 42, 'wrong@example.test')).toBe(false);
          expect(await service.sendOtp('staff', 99, 'staff@example.test')).toBe(false);
          expect(mocks.send).not.toHaveBeenCalled();
     });

     it('enforces the resend delay and stores only a hashed code', async () => {
          const { service, tables } = setup();
          await service.sendOtp('staff', 42, 'staff@example.test');
          expect(await service.sendOtp('staff', 42, 'staff@example.test')).toBe(false);
          expect(mocks.send).toHaveBeenCalledTimes(1);
          expect(tables.password_reset_otps[0].code_hash).toMatch(/^[a-f0-9]{64}$/);
          expect(Number(tables.password_reset_otps[0].expires_at) - Number(tables.password_reset_otps[0].created_at)).toBe(600_000);
     });

     it('cleans up the code and surfaces email delivery errors', async () => {
          const { service, tables } = setup();
          mocks.send.mockResolvedValueOnce({ success: false, failureReason: 'Provider unavailable' });
          await expect(service.sendOtp('staff', 42, 'staff@example.test')).rejects.toThrow('Provider unavailable');
          expect(tables.password_reset_otps).toHaveLength(0);
     });

     it('requires verification before reset, then consumes the code exactly once', async () => {
          const { service, tables } = setup();
          seed(tables);
          expect(await service.resetPassword('staff', 42, '123456', 'New-Password2026')).toBe(false);
          expect(await service.verifyOtp('staff', 42, '123456')).toBe(true);
          const results = await Promise.all([
               service.resetPassword('staff', 42, '123456', 'New-Password2026'),
               service.resetPassword('staff', 42, '123456', 'Other-Password2026'),
          ]);
          expect(results).toEqual([true, false]);
          expect(tables.roles[0].password).toBe('hashed:New-Password2026');
          expect(tables.roles[0].refresh_token).toBeNull();
          expect(tables.loginlogs.map(row => row.loggedout)).toEqual([true, true, false]);
          expect(tables.loginlogs[0].actualLogout).toBeInstanceOf(Date);
          expect(tables.password_reset_otps).toHaveLength(0);
     });

     it('locks out after five wrong codes and rejects expired or wrong-account codes', async () => {
          const { service, tables } = setup();
          seed(tables);
          expect(await service.verifyOtp('patient', 42, '123456')).toBe(false);
          for (let attempt = 0; attempt < 5; attempt++) expect(await service.verifyOtp('staff', 42, '999999')).toBe(false);
          expect(await service.verifyOtp('staff', 42, '123456')).toBe(false);
          tables.password_reset_otps[0].attempts = 0;
          tables.password_reset_otps[0].expires_at = new Date(Date.now() - 1);
          expect(await service.verifyOtp('staff', 42, '123456')).toBe(false);
          await expect(service.resetPassword('staff', 42, '123456', 'short')).rejects.toThrow('at least 12');
     });

     it.each([
          ['patient', 'patients_credentials', { updated: 'true' }],
          ['clinician', 'clinicianscredentials', { ispasswordUpdated: 1 }],
     ] as const)('updates %s password flags without changing other accounts', async (type, table, flags) => {
          const { service, tables } = setup();
          tables.portal_login_attempt_security.push({account_type:type,account_id:42,level:2}, {account_type:type,account_id:43,level:3}, {account_type:type==='patient'?'clinician':'patient',account_id:42,level:4});
          seed(tables, { entity_type: type, verified_at: new Date() });
          expect(await service.resetPassword(type, 42, '123456', 'New-Password2026')).toBe(true);
          expect(tables[table][0]).toMatchObject({ password: 'hashed:New-Password2026', ...flags });
          expect(tables.roles[0].password).toBe('old');
          expect(tables.patient_portal_accounts.map(row => row.session_version)).toEqual(type === 'patient' ? [4, 7] : [3, 7]);
          expect(tables.portal_login_attempt_security).toHaveLength(2);
          expect(tables.portal_login_attempt_security.some(row=>row.account_type===type&&row.account_id===42)).toBe(false);
     });

     it('rolls back the password and preserves the OTP if session revocation fails', async () => {
          const { service, tables, failures } = setup();
          seed(tables, { verified_at: new Date() });
          failures.revoke = true;
          await expect(service.resetPassword('staff', 42, '123456', 'New-Password2026')).rejects.toThrow('Session storage unavailable');
          expect(tables.roles[0].password).toBe('old');
          expect(tables.password_reset_otps).toHaveLength(1);
          expect(tables.loginlogs.every(row => row.loggedout === false)).toBe(true);
     });

     it('leaves sessions untouched for an invalid reset code', async () => {
          const { service, tables } = setup();
          seed(tables, { verified_at: new Date() });
          expect(await service.resetPassword('staff', 42, '654321', 'New-Password2026')).toBe(false);
          expect(tables.loginlogs.every(row => row.loggedout === false)).toBe(true);
          expect(tables.roles[0].password).toBe('old');
     });
});
