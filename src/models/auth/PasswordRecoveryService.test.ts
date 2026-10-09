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
     const tables: Record<string, Row[]> = { password_reset_otps: [], ...accounts };
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
          const next = pending.then(() => action(connection));
          pending = next.then(() => undefined, () => undefined);
          return next;
     };
     return {
          connection: Object.assign(connection, { schema: { hasTable: async () => true }, transaction }),
          tables,
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
          expect(await service.resetPassword('staff', 42, '123456', 'new-password')).toBe(false);
          expect(await service.verifyOtp('staff', 42, '123456')).toBe(true);
          const results = await Promise.all([
               service.resetPassword('staff', 42, '123456', 'new-password'),
               service.resetPassword('staff', 42, '123456', 'other-password'),
          ]);
          expect(results).toEqual([true, false]);
          expect(tables.roles[0].password).toBe('hashed:new-password');
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
          await expect(service.resetPassword('staff', 42, '123456', 'short')).rejects.toThrow('at least 8');
     });

     it.each([
          ['patient', 'patients_credentials', { updated: 'true' }],
          ['clinician', 'clinicianscredentials', { ispasswordUpdated: 1 }],
     ] as const)('updates %s password flags without changing other accounts', async (type, table, flags) => {
          const { service, tables } = setup();
          seed(tables, { entity_type: type, verified_at: new Date() });
          expect(await service.resetPassword(type, 42, '123456', 'new-password')).toBe(true);
          expect(tables[table][0]).toMatchObject({ password: 'hashed:new-password', ...flags });
          expect(tables.roles[0].password).toBe('old');
     });
});
