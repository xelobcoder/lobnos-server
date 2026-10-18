import knex, { Knex } from 'knex';
import bcrypt from 'bcrypt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     connection: vi.fn(), settings: vi.fn(), tenant: vi.fn(), send: vi.fn(), provider: vi.fn(),
     smsConfig: vi.fn(), smsSend: vi.fn(), audit: vi.fn(),
}));
vi.mock('../../hooks/configuration', () => ({ configuration: { isMultiTenant: false } }));
vi.mock('./PatientPortalAudit', () => ({ recordPortalAudit: mocks.audit }));
vi.mock('../application/sms/services/SmsProviderSettingsService', () => ({
     SmsProviderSettingsService: class { getActiveConfiguration = mocks.smsConfig; },
}));
vi.mock('../application/integrations/Arkesel', () => ({ SmsService: class { sendSms = mocks.smsSend; } }));
vi.mock('./PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: mocks.connection }));
vi.mock('./PatientPortalSettings', () => ({ PatientPortalSettingsService: class { get = mocks.settings; } }));
vi.mock('../Tenancy/TenantRegistry', () => ({ TenantRegistry: class { getTenant = mocks.tenant; } }));
vi.mock('../auth/TenantLoginUsername', () => ({ formatTenantLoginUsername: vi.fn(async () => 'PLS123-P21') }));
vi.mock('../application/email/repositories/EmailProvidersRepo', () => ({
     EmailProvidersRepo: class { findDefault = mocks.provider; },
}));
vi.mock('../application/email/services/ProviderFactory', () => ({
     ProviderFactory: class { create() { return { send: mocks.send }; } },
}));

import { invitationStatus, PatientPortalAccountService } from './PatientPortalAccountService';

interface Query {
     sql: string;
     bindings: unknown[];
     response?: unknown;
}

describe('patient portal accounts and invitation management', () => {
     let db: Knex;
     let queries: Query[];
     let respond: (query: Query) => unknown;

     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('PATIENT_PORTAL_URL', 'https://portal.example.test');
          db = knex({ client: 'mysql2' });
          queries = [];
          respond = () => [];
          vi.spyOn(db.client, 'acquireConnection').mockResolvedValue({});
          vi.spyOn(db.client, 'releaseConnection').mockResolvedValue(undefined);
          vi.spyOn(Object.getPrototypeOf(db.client), '_query').mockImplementation(async (_connection, query: Query) => {
               queries.push({ sql: query.sql, bindings: query.bindings });
               query.response = [respond(query), []];
               return query;
          });
          mocks.connection.mockResolvedValue(db);
          mocks.settings.mockResolvedValue({ portal_enabled: true, staff_invitations_enabled: true, invitation_expiry_hours: 72 });
          mocks.tenant.mockResolvedValue({ platformId: 'PLS123' });
          mocks.send.mockResolvedValue({ success: true });
          mocks.provider.mockResolvedValue({ id: 1, provider_type: 'smtp', host: 'smtp.example.test', port: 587,
               username: 'lab@example.test', password: 'synthetic', from_email: 'lab@example.test' });
          mocks.smsConfig.mockResolvedValue({ apiKey: 'synthetic', defaultSender: 'Lab', baseUrl: 'https://sms.example.test' });
          mocks.smsSend.mockResolvedValue({ status: 'success' });
     });

     afterEach(async () => {
          await db.destroy();
          vi.restoreAllMocks();
          vi.unstubAllEnvs();
     });

     it('classifies used, revoked and expired invitations independently of pending', () => {
          const now = new Date('2026-10-18T12:00:00Z');
          const future = { expires_at: '2026-10-19T12:00:00Z' };
          expect(invitationStatus(future, now)).toBe('pending');
          expect(invitationStatus({ expires_at: now }, now)).toBe('expired');
          expect(invitationStatus({ ...future, revoked_at: now }, now)).toBe('revoked');
          expect(invitationStatus({ ...future, used_at: now, revoked_at: now }, now)).toBe('accepted');
     });

     it('returns a paginated, masked list without invitation tokens or hashes', async () => {
          respond = query => query.sql.includes('count(') ? [{ total: 23 }] : [{
               id: 5, patientid: 21, created_by: 7, firstname: 'Ama', lastname: 'Mensah', fullpatientid: 'PT0021',
               email: 'ama@example.com', expires_at: new Date(Date.now() + 60_000),
               accepted_at: null, revoked_at: null, token_hash: 'must-not-be-returned',
          }];
          const result = await new PatientPortalAccountService(4).listFacilityInvitations({
               status: 'pending', search: "Ama_%' OR 1=1", page: 2, pageSize: 20,
          });
          expect(mocks.connection).toHaveBeenCalledWith(4);
          expect(result).toMatchObject({ total: 23, page: 2, pageSize: 20, invitations: [{
               patientName: 'Ama Mensah', patientNumber: 'PT0021', email: 'a**@example.com', status: 'pending',
          }] });
          expect(result.invitations[0]).not.toHaveProperty('token_hash');
          expect(result.invitations[0]).not.toHaveProperty('token');
          const list = queries.find(query => query.sql.includes('order by'));
          expect(list?.sql).toContain('`invitation`.`used_at` is null');
          expect(list?.sql).toContain('`invitation`.`revoked_at` is null');
          expect(list?.sql).toContain('`invitation`.`expires_at` > ?');
          expect(list?.sql).not.toContain("OR 1=1");
          expect(list?.bindings).toContain("%Ama!_!%' OR 1=1%");
          expect(list?.bindings.slice(-2)).toEqual([20, 20]);
     });

     it.each(['accepted', 'revoked', 'expired', 'all'] as const)('filters %s at the database, including the count', async status => {
          respond = query => query.sql.includes('count(') ? [{ total: 0 }] : [];
          await new PatientPortalAccountService(4).listFacilityInvitations({ status, search: '', page: 1, pageSize: 20 });
          const invitationQueries = queries.filter(query => query.sql.includes('`patient_portal_invitations`'));
          expect(invitationQueries).toHaveLength(2);
          for (const query of invitationQueries) {
               if (status === 'accepted') expect(query.sql).toContain('`invitation`.`used_at` is not null');
               if (status === 'revoked') {
                    expect(query.sql).toContain('`invitation`.`used_at` is null');
                    expect(query.sql).toContain('`invitation`.`revoked_at` is not null');
               }
               if (status === 'expired') {
                    expect(query.sql).toContain('`invitation`.`used_at` is null');
                    expect(query.sql).toContain('`invitation`.`revoked_at` is null');
                    expect(query.sql).toContain('`invitation`.`expires_at` <= ?');
               }
               if (status === 'all') expect(query.sql).not.toContain(' where ');
          }
     });

     it.each(['pending', 'expired'])('replaces a %s invitation under locks and invalidates old links', async state => {
          respond = query => {
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21, firstname: 'Ama', email: 'ama@example.com' }];
               if (query.sql.includes('from `patient_portal_invitations`')) return [{
                    id: 5, patientid: 21, used_at: null, revoked_at: null,
                    expires_at: new Date(Date.now() + (state === 'expired' ? -60_000 : 60_000)),
               }];
               if (query.sql.startsWith('insert')) return { insertId: 6 };
               if (query.sql.startsWith('update')) return { affectedRows: 1 };
               return [];
          };
          const result = await new PatientPortalAccountService(4).resendInvitation(5, 7);
          expect(result).toMatchObject({ id: 6, patientid: 21, emailed: true, deliveryError: null });
          expect(result.token).toMatch(/^PLS123\.[A-Za-z0-9_-]{43}$/);
          const patientLock = queries.findIndex(query => query.sql.includes('`new_patients`') && query.sql.includes('for update'));
          const invitationLock = queries.findIndex(query => query.sql.includes('`patient_portal_invitations`') && query.sql.includes('for update'));
          expect(patientLock).toBeGreaterThan(0);
          expect(invitationLock).toBeGreaterThan(patientLock);
          const revoked = queries.find(query => query.sql.startsWith('update `patient_portal_invitations`'));
          expect(revoked?.sql).toContain('`used_at` is null');
          expect(revoked?.sql).toContain('`revoked_at` is null');
          const inserted = queries.find(query => query.sql.startsWith('insert'));
          expect(inserted?.bindings).not.toContain(result.token);
          expect(inserted?.bindings).toContainEqual(expect.stringMatching(/^[a-f0-9]{64}$/));
          expect(mocks.send).toHaveBeenCalledOnce();
     });

     it.each(['used_at', 'revoked_at'])('rejects replacement of an invitation with %s set', async field => {
          respond = query => {
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21, email: 'ama@example.com' }];
               if (query.sql.includes('from `patient_portal_invitations`')) return [{ id: 5, patientid: 21, [field]: new Date() }];
               return [];
          };
          await expect(new PatientPortalAccountService(4).resendInvitation(5, 7))
               .rejects.toMatchObject({ statusCode: 409, code: 'INVITATION_NOT_REPLACEABLE' });
          expect(queries.some(query => query.sql.startsWith('insert') || query.sql.startsWith('update'))).toBe(false);
          expect(mocks.send).not.toHaveBeenCalled();
     });

     it.each(['delivery', 'provider'])('reports a %s failure explicitly instead of claiming an invitation was emailed', async failure => {
          respond = query => {
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21, email: 'ama@example.com' }];
               if (query.sql.startsWith('insert')) return { insertId: 6 };
               if (query.sql.startsWith('update')) return { affectedRows: 1 };
               return [];
          };
          mocks.send.mockResolvedValue({ success: false });
          if (failure === 'provider') mocks.provider.mockResolvedValue(null);
          const result = await new PatientPortalAccountService(4).createInvitation(21, 7, { sendEmail: true });
          expect(result.emailed).toBe(false);
          expect(result.deliveryError).toContain(failure === 'provider' ? 'not configured' : 'could not be sent');
     });

     it.each(['email', 'sms'] as const)('refuses an explicit %s send with missing contact before replacing a link', async channel => {
          respond = query => query.sql.includes('from `new_patients`') ? [{ patientid: 21 }] : [];
          await expect(new PatientPortalAccountService(4).createInvitation(21, 7, { channel }))
               .rejects.toMatchObject({ code: 'CHANNEL_UNAVAILABLE' });
          expect(queries.some(query => /^(insert|update)/.test(query.sql))).toBe(false);
          expect(mocks.send).not.toHaveBeenCalled();
          expect(mocks.smsSend).not.toHaveBeenCalled();
     });

     it('preserves legacy sendEmail=false link-only creation and audits no-message outcome', async () => {
          respond = query => {
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21 }];
               if (query.sql.startsWith('insert')) return { insertId: 6 };
               return [];
          };
          const result = await new PatientPortalAccountService(4).createInvitation(21, 7, { sendEmail: false });
          expect(result).toMatchObject({ id: 6, emailed: false, delivery: { channel: 'link', status: 'not_requested' } });
          expect(mocks.send).not.toHaveBeenCalled();
          expect(mocks.smsSend).not.toHaveBeenCalled();
          expect(mocks.audit).toHaveBeenCalledWith(4, expect.objectContaining({ action: 'invitation.link.not_requested', resourceId: 6 }));
          expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(result.token);
     });

     it.each(['success', 'error'])('commits SMS invitation before provider %s and returns a truthful channel outcome', async status => {
          respond = query => {
               if (query.sql.includes('from `applicationsettings`')) return [{ smsActivated: 1 }];
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21, mobile_number: '0241234567' }];
               if (query.sql.includes('from `patient_portal_invitations`')) return [{ id: 5, patientid: 21 }];
               if (query.sql.startsWith('insert')) return { insertId: 6 };
               if (query.sql.startsWith('update')) return { affectedRows: 1 };
               return [];
          };
          mocks.smsSend.mockImplementation(async () => {
               expect(queries.some(query => query.sql.toUpperCase().startsWith('COMMIT'))).toBe(true);
               return { status };
          });
          const result = await new PatientPortalAccountService(4).resendInvitation(5, 7, 'sms');
          expect(result).toMatchObject({ id: 6, emailed: false, delivery: { channel: 'sms', status: status === 'success' ? 'accepted' : 'failed' } });
          expect(mocks.send).not.toHaveBeenCalled();
          expect(mocks.smsSend).toHaveBeenCalledOnce();
          expect(JSON.stringify(result)).not.toContain('0241234567');
          expect(mocks.audit).toHaveBeenCalledWith(4, expect.objectContaining({ action: `invitation.sms.${result.delivery.status}` }));
          expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(result.token);
     });

     it('serializes repeated issuance on the patient lock and enforces a persisted cooldown across new requests', async () => {
          let latest: any = null;
          respond = query => {
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21, email: 'ama@example.com' }];
               if (query.sql.includes('from `patient_portal_invitations`')) return latest ? [latest] : [];
               if (query.sql.startsWith('insert')) { latest = { id: 6, created_at: new Date() }; return { insertId: 6 }; }
               return [];
          };
          await new PatientPortalAccountService(4).createInvitation(21, 7, { channel: 'email' });
          await expect(new PatientPortalAccountService(4).createInvitation(21, 8, { channel: 'email' }))
               .rejects.toMatchObject({ statusCode: 429, code: 'INVITATION_COOLDOWN' });
          expect(queries.filter(query => query.sql.startsWith('insert'))).toHaveLength(1);
          expect(mocks.send).toHaveBeenCalledOnce();
          const locks = queries.filter(query => query.sql.includes('for update'));
          expect(locks[0].sql).toContain('new_patients');
          expect(locks[1].sql).toContain('patient_portal_invitations');
     });

     it('rejects active accounts and disabled invitation settings without sending', async () => {
          respond = query => {
               if (query.sql.includes('from `new_patients`')) return [{ patientid: 21 }];
               if (query.sql.includes('from `patient_portal_accounts`')) return [{ status: 'active' }];
               return [];
          };
          await expect(new PatientPortalAccountService(4).createInvitation(21, 7, { channel: 'link' }))
               .rejects.toMatchObject({ code: 'ACCOUNT_ACTIVE' });
          mocks.settings.mockResolvedValue({ portal_enabled: true, staff_invitations_enabled: false });
          await expect(new PatientPortalAccountService(4).createInvitation(21, 7, { channel: 'sms' }))
               .rejects.toMatchObject({ code: 'INVITATIONS_DISABLED' });
          expect(mocks.send).not.toHaveBeenCalled();
          expect(mocks.smsSend).not.toHaveBeenCalled();
     });

     it('redeems once, locks the current invitation after the patient, and rejects replay', async () => {
          let usedAt: Date | null = null;
          respond = query => {
               if (query.sql.startsWith('select') && query.sql.includes('from `patient_portal_invitations`')) {
                    return [{ id: 5, patientid: 21, used_at: usedAt, revoked_at: null, expires_at: new Date(Date.now() + 60_000) }];
               }
               if (query.sql.startsWith('select') && query.sql.includes('from `new_patients`')) return [{ patientid: 21 }];
               if (query.sql.startsWith('select')) return [];
               if (query.sql.startsWith('update `patient_portal_invitations`')) usedAt = new Date();
               if (query.sql.startsWith('update')) return { affectedRows: 1 };
               if (query.sql.startsWith('insert')) return { insertId: 1 };
               return [];
          };
          const service = new PatientPortalAccountService(4);
          await expect(service.acceptInvitation(`PLS123.${'a'.repeat(43)}`, 'Secure123'))
               .resolves.toMatchObject({ patientid: 21, loginUsername: 'PLS123-P21' });
          const locks = queries.filter(query => query.sql.includes('for update'));
          expect(locks[0].sql).toContain('`new_patients`');
          expect(locks[1].sql).toContain('`patient_portal_invitations`');
          await expect(service.acceptInvitation(`PLS123.${'a'.repeat(43)}`, 'Secure123'))
               .rejects.toMatchObject({ code: 'INVITATION_INVALID' });
          expect(queries.filter(query => query.sql.startsWith('insert into `patients_credentials`'))).toHaveLength(1);
     });

     it.each(['expired', 'revoked'])('rejects %s invitation redemption without creating credentials', async state => {
          respond = query => query.sql.startsWith('select') ? [{
               id: 5, patientid: 21, used_at: null,
               revoked_at: state === 'revoked' ? new Date() : null,
               expires_at: new Date(Date.now() + (state === 'expired' ? -60_000 : 60_000)),
          }] : [];
          await expect(new PatientPortalAccountService(4).acceptInvitation(`PLS123.${'a'.repeat(43)}`, 'Secure123'))
               .rejects.toMatchObject({ code: 'INVITATION_INVALID' });
          expect(queries.some(query => query.sql.startsWith('insert'))).toBe(false);
     });

     it('authenticates an activated patient using their actual bcrypt password and rejects a wrong password', async () => {
          const password = await bcrypt.hash('Secure123', 10);
          respond = query => {
               if (query.sql.startsWith('select') && query.sql.includes('from `patient_portal_accounts`')) {
                    return [{ patientid: 21, status: 'active', session_version: 2, failed_attempts: 0 }];
               }
               if (query.sql.startsWith('select') && query.sql.includes('from `patients_credentials`')) {
                    return [{ patientid: 21, password, firstname: 'Ama' }];
               }
               if (query.sql.startsWith('update')) return { affectedRows: 1 };
               return [];
          };
          const service = new PatientPortalAccountService(4);
          await expect(service.authenticate(21, 'Secure123')).resolves.toMatchObject({
               ok: true, account: { session_version: 2 }, patient: { patientid: 21 },
          });
          await expect(service.authenticate(21, 'wrong')).resolves.toEqual({ ok: false, reason: 'INVALID' });
          expect(queries.some(query => query.sql.includes('`failed_attempts` = ?') && query.bindings.includes(1))).toBe(true);
     });
});
