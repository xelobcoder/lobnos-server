import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findSessionById: vi.fn() }));

vi.mock('../../database/connection', () => ({ systemConfigConnection: {} }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class {} }));
vi.mock('../../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class {
          findSessionById = mocks.findSessionById;
     },
}));

import { parseTenantLoginUsername } from './TenantLoginDirectory';
import { hashDeviceFingerprint, verifyStaffSession } from '../../middleware/validateTenancy';

describe('parseTenantLoginUsername', () => {
     it('extracts tenant, entity type and id from tenant-qualified usernames', () => {
          expect(parseTenantLoginUsername('PLSRG-T3-S0012')).toEqual({ tenantId: 3, entityType: 'staff', entityId: 12 });
          expect(parseTenantLoginUsername('abcgr-t27-p0450')).toEqual({ tenantId: 27, entityType: 'patient', entityId: 450 });
          expect(parseTenantLoginUsername('LABX-T5-C0001')).toEqual({ tenantId: 5, entityType: 'clinician', entityId: 1 });
     });

     it('ignores legacy usernames and emails', () => {
          expect(parseTenantLoginUsername('PLSRGS0012')).toBeNull();
          expect(parseTenantLoginUsername('user@lab.com')).toBeNull();
          expect(parseTenantLoginUsername('PLSRG-T0-S0012')).toBeNull();
     });
});

describe('verifyStaffSession', () => {
     const request: any = { headers: {} };
     const future = new Date(Date.now() + 60_000);

     it('rejects tokens issued without a session id', async () => {
          const result = await verifyStaffSession({ email: 'a@b.c' }, 1, 3, request);
          expect(result).toMatchObject({ ok: false, statusCode: 401 });
     });

     it('reports SESSION_REPLACED when the user signed in on another device', async () => {
          mocks.findSessionById.mockResolvedValueOnce({ loggedout: 1, logoutTime: new Date() });
          const result = await verifyStaffSession({ sid: 'old', employeeid: 1, tid: 3 }, 1, 3, request);
          expect(result.body).toMatchObject({ code: 'SESSION_REPLACED', isExpired: true });
     });

     it('accepts the current session and rejects a different device fingerprint', async () => {
          const fph = hashDeviceFingerprint('device-a');
          mocks.findSessionById.mockResolvedValue({ loggedout: 0, logoutTime: future });
          await expect(verifyStaffSession({ sid: 'cur', employeeid: 1, tid: 3, fph }, 1, 3, { headers: { 'x-device-id': 'device-a' } } as any))
               .resolves.toEqual({ ok: true });
          const mismatch = await verifyStaffSession({ sid: 'cur', employeeid: 1, tid: 3, fph }, 1, 3, { headers: { 'x-device-id': 'device-b' } } as any);
          expect(mismatch.body).toMatchObject({ code: 'DEVICE_MISMATCH' });
     });
});
