import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));

import { FinancialPinVerificationService } from '../../accountingModule/services/FinancialPinVerificationService';
import { FinancialDayCloseService } from '../../accountingModule/services/FinancialDayCloseService';
import { isPinAttemptLimit, pinAttemptLimit, StaffPinSecurity } from './StaffPinSecurity';
import { AuthUser } from '../../middleware/authority';

// Transactional test double: queued transactions model the account-row lock, and a failed
// transaction restores all writes. No external database, credentials or patient data are used.
function database(limit = 3) {
     const tables: Record<string, any[]> = {
          roles: [
               { employeeid: 7, username: 'staff', pin_hash: bcrypt.hashSync('0123', 4), pin: null },
               { employeeid: 8, username: 'other', pin_hash: bcrypt.hashSync('4567', 4), pin: null },
          ],
          applicationsettings: [{ keyid: 1, pinAttemptLimit: limit }],
          staff_pin_security: [], staff_pin_security_events: [], financial_authorization_attempts: [],
     };
     let queue = Promise.resolve();
     let failAudit = false;
     const lockCalls: string[] = [];
     const db: any = (table: string) => {
          let filter: any = {};
          const query: any = {
               where(values: any) { filter = { ...filter, ...values }; return query; },
               select() { return query; },
               forUpdate() { lockCalls.push(table); return query; },
               async first() {
                    const row = tables[table].find(row => Object.keys(filter).every(key => row[key] === filter[key]));
                    return row ? { ...row } : undefined;
               },
               async insert(row: any) {
                    if (failAudit && (table === 'staff_pin_security_events' || table === 'financial_authorization_attempts')) {
                         throw new Error('simulated audit outage');
                    }
                    tables[table].push({ ...row });
               },
               async update(values: any) {
                    tables[table].filter(row => Object.keys(filter).every(key => row[key] === filter[key]))
                         .forEach(row => Object.assign(row, values));
               },
          };
          return query;
     };
     db.transaction = (callback: any) => {
          const result = queue.then(async () => {
               const snapshot = JSON.parse(JSON.stringify(tables));
               try { return await callback(db); }
               catch (error) {
                    Object.keys(tables).forEach(key => { tables[key] = snapshot[key]; });
                    throw error;
               }
          });
          queue = result.then(() => undefined, () => undefined);
          return result;
     };
     return { db, tables, lockCalls, failAudit: () => { failAudit = true; } };
}

const actor: AuthUser = { employeeid: 7, email: 'staff@example.test', role: 'scientist', tenantId: 42, branch: 1 };
const admin: AuthUser = { ...actor, employeeid: 1, role: 'admin' };
const context = { purpose: 'identity_confirmation', ipAddress: '127.0.0.1' };
const verify = (pin: string, user = actor) => new FinancialPinVerificationService(user.tenantId).verify(user, pin, context);

describe('staff authorization PIN counters', () => {
     it.each(['clinician', 'patient', 'organization', 'outsourced'])('rejects %s identities before looking up overlapping staff IDs', async role => {
          const data = database();
          mocks.connection.mockResolvedValue(data.db);
          await expect(new FinancialPinVerificationService(42).verify({ ...actor, role }, 'wrong', { purpose: 'generic' } as any)).rejects.toMatchObject({ code: 'INVALID_PIN' });
          expect(data.tables.staff_pin_security).toHaveLength(0);
          expect(data.tables.financial_authorization_attempts).toHaveLength(0);
     });
     let data: ReturnType<typeof database>;
     beforeEach(() => {
          vi.clearAllMocks();
          data = database();
          mocks.connection.mockResolvedValue(data.db);
     });

     it('exhausts at the configured boundary, commits failures, and blocks even the correct PIN', async () => {
          await expect(verify('9999')).rejects.toMatchObject({ code: 'INVALID_PIN' });
          await expect(verify('9999')).rejects.toMatchObject({ code: 'INVALID_PIN' });
          await expect(verify('9999')).rejects.toMatchObject({ code: 'PIN_RATE_LIMITED' });
          await expect(verify('0123')).rejects.toMatchObject({ code: 'PIN_RATE_LIMITED' });
          expect(data.tables.staff_pin_security[0]).toMatchObject({ failed_attempts: 3, locked_at: expect.any(Date) });
          expect(data.tables.financial_authorization_attempts.map(row => row.result)).toEqual(['failure', 'failure', 'failure', 'rate_limited']);
          expect(data.lockCalls).toEqual(['roles', 'roles', 'roles', 'roles']);
     });

     it('counts malformed PINs and clears consecutive failures on a successful PIN before exhaustion', async () => {
          await expect(verify('bad')).rejects.toMatchObject({ code: 'INVALID_PIN' });
          await expect(verify('0123')).resolves.toMatchObject({ valid: true, verifiedAt: expect.any(Date) });
          expect(data.tables.staff_pin_security[0]).toMatchObject({ failed_attempts: 0, locked_at: null });
          expect(data.tables.financial_authorization_attempts[0].failure_category).toBe('invalid_format');
     });

     it('does not share counters across staff on a shared IP', async () => {
          for (let i = 0; i < 3; i++) await verify('9999').catch(() => {});
          await expect(verify('4567', { ...actor, employeeid: 8 })).resolves.toMatchObject({ valid: true });
     });

     it('serializes concurrent wrong and correct PIN requests without losing attempts or unlocking', async () => {
          const outcomes = await Promise.allSettled([verify('9999'), verify('9999'), verify('9999'), verify('0123'), verify('9999')]);
          expect(outcomes.every(result => result.status === 'rejected')).toBe(true);
          expect(data.tables.staff_pin_security[0].failed_attempts).toBe(3);
          expect(data.tables.financial_authorization_attempts).toHaveLength(5);
     });

     it('persists exhaustion across time, service instances, and policy increases', async () => {
          for (let i = 0; i < 3; i++) await verify('9999').catch(() => {});
          data.tables.staff_pin_security[0].locked_at = new Date(2000, 0, 1);
          await new StaffPinSecurity(42).updatePolicy(admin, 20, 'Policy review');
          await expect(verify('0123')).rejects.toMatchObject({ code: 'PIN_RATE_LIMITED' });
     });

     it('audits an administrator reset without changing the PIN hash; the original correct PIN works', async () => {
          const hash = data.tables.roles[0].pin_hash;
          for (let i = 0; i < 3; i++) await verify('9999').catch(() => {});
          await new StaffPinSecurity(42).reset(admin, 7, 'Support ticket verified');
          expect(data.tables.roles[0].pin_hash).toBe(hash);
          expect(data.tables.roles[0].pin).toBeNull();
          expect(data.tables.staff_pin_security_events[0]).toMatchObject({
               event_type: 'reset', actor_employeeid: 1, target_employeeid: 7, previous_attempts: 3,
               reason: 'Support ticket verified',
          });
          await expect(verify('0123')).resolves.toMatchObject({ valid: true });
          expect(JSON.stringify(data.tables.staff_pin_security_events)).not.toContain(hash);
          expect(JSON.stringify(data.tables.financial_authorization_attempts)).not.toContain('0123');
     });

     it('serializes reset against verification and refuses duplicate/non-exhausted resets', async () => {
          for (let i = 0; i < 3; i++) await verify('9999').catch(() => {});
          const service = new StaffPinSecurity(42);
          const outcomes = await Promise.allSettled([service.reset(admin, 7, 'Verified contact'), verify('9999'), service.reset(admin, 7, 'Duplicate contact')]);
          expect(outcomes.map(result => result.status)).toEqual(['fulfilled', 'rejected', 'rejected']);
          expect(data.tables.staff_pin_security[0]).toMatchObject({ failed_attempts: 1, locked_at: null });
          expect(data.tables.staff_pin_security_events).toHaveLength(1);
     });

     it('rolls back reset and policy updates when their audit insert fails', async () => {
          for (let i = 0; i < 3; i++) await verify('9999').catch(() => {});
          data.failAudit();
          await expect(new StaffPinSecurity(42).reset(admin, 7, 'Verified contact')).rejects.toThrow();
          expect(data.tables.staff_pin_security[0].failed_attempts).toBe(3);
          expect(data.tables.staff_pin_security[0].locked_at).toBeTruthy();
          await expect(new StaffPinSecurity(42).updatePolicy(admin, 10, 'Policy review')).rejects.toThrow();
          expect(data.tables.applicationsettings[0].pinAttemptLimit).toBe(3);
     });

     it('fails closed when PIN attempt auditing fails', async () => {
          data.failAudit();
          await expect(verify('0123')).rejects.toMatchObject({ code: 'PIN_AUDIT_FAILED' });
          expect(data.tables.staff_pin_security).toEqual([]);
          expect(data.tables.financial_authorization_attempts).toEqual([]);
     });

     it('keeps attempts committed when a caller later rolls back its business transaction', async () => {
          const business = database();
          await expect(new FinancialDayCloseService(42, business.db).submit(
               { ...actor, role: 'accountant' }, 1, '2026-10-18', { pin: '9999' }
          )).rejects.toMatchObject({ code: 'INVALID_PIN' });
          // Independent connection is always obtained, not a caller-owned transaction.
          expect(mocks.connection).toHaveBeenCalledWith(42);
          expect(data.tables.staff_pin_security[0].failed_attempts).toBe(1);
     });

     it('sanitizes unexpected database errors before financial controllers can return them', async () => {
          mocks.connection.mockRejectedValue(new Error('SQL internal details and credentials'));
          await expect(verify('0123')).rejects.toMatchObject({ code: 'PIN_AUDIT_FAILED', message: 'Unable to validate PIN' });
     });

     it('migrates a legacy PIN only on successful verification', async () => {
          data.tables.roles[0] = { employeeid: 7, pin: 1234, pin_hash: null };
          await expect(verify('1234')).resolves.toMatchObject({ valid: true });
          expect(data.tables.roles[0].pin).toBeNull();
          expect(await bcrypt.compare('1234', data.tables.roles[0].pin_hash)).toBe(true);
     });

     it('isolates tenant connections and rejects actor/tenant mismatches before database access', async () => {
          const second = database(1);
          mocks.connection.mockImplementation(async tenant => tenant === 42 ? data.db : second.db);
          await expect(verify('9999', { ...actor, tenantId: 43 })).rejects.toMatchObject({ code: 'PIN_RATE_LIMITED' });
          await expect(verify('0123')).resolves.toMatchObject({ valid: true });
          expect(data.tables.staff_pin_security[0].failed_attempts).toBe(0);
          expect(second.tables.staff_pin_security[0].failed_attempts).toBe(1);
          mocks.connection.mockClear();
          await expect(new FinancialPinVerificationService(43).verify(actor, '0123', context)).rejects.toMatchObject({ code: 'INVALID_PIN' });
          await expect(new StaffPinSecurity(43).reset(admin, 7, 'Contact verified')).rejects.toMatchObject({ statusCode: 403 });
          expect(mocks.connection).not.toHaveBeenCalled();
     });

     it.each(['manager', 'accountant', 'scientist', 'patient', 'clinician'])('denies %s reset and policy changes', async role => {
          await expect(new StaffPinSecurity(42).reset({ ...admin, role }, 7, 'Contact verified')).rejects.toMatchObject({ statusCode: 403 });
          await expect(new StaffPinSecurity(42).updatePolicy({ ...admin, role }, 4, 'Policy review')).rejects.toMatchObject({ statusCode: 403 });
          expect(mocks.connection).not.toHaveBeenCalled();
     });

     it.each([0, -1, 21, 1.5, '5', null, undefined, true, NaN, Infinity])('rejects invalid policy value %s', async value => {
          expect(isPinAttemptLimit(value)).toBe(false);
          await expect(new StaffPinSecurity(42).updatePolicy(admin, value as any, 'Policy review')).rejects.toMatchObject({ statusCode: 400 });
     });

     it('defaults to five, accepts both boundaries, validates reason and fails closed on corrupt settings', async () => {
          expect(pinAttemptLimit(null)).toBe(5);
          expect(isPinAttemptLimit(1)).toBe(true);
          expect(isPinAttemptLimit(20)).toBe(true);
          expect(() => pinAttemptLimit({ pinAttemptLimit: 0 })).toThrow('unavailable');
          for (const reason of [null, '', '  ', 'ab', 'x'.repeat(256)]) {
               await expect(new StaffPinSecurity(42).reset(admin, 7, reason as any)).rejects.toMatchObject({ statusCode: 400 });
          }
          await expect(new StaffPinSecurity(42).reset(admin, 999, 'Contact verified')).rejects.toMatchObject({ statusCode: 404 });
     });
});
