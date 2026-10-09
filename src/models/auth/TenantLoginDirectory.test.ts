import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findSessionById: vi.fn() }));

vi.mock('../../database/connection', () => ({ systemConfigConnection: {}, singleTenantKnexInstance: {} }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class {} }));
vi.mock('../../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class {
          findSessionById = mocks.findSessionById;
     },
}));

import { formatLoginUsername, parseLoginUsername } from './TenantLoginDirectory';
import { facilityCodeBase, facilityCodeCandidates, isValidFacilityCode } from '../Tenancy/TenantRegistry';
import { hashDeviceFingerprint, verifyStaffSession } from '../../middleware/validateTenancy';

describe('login usernames', () => {
     it('formats the public organization identifier + tenant-local account number', () => {
          expect(formatLoginUsername('PLS20154', 'staff', 4)).toBe('PLS20154S004');
          expect(formatLoginUsername('PLS20154', 'patient', 450)).toBe('PLS20154P450');
          expect(formatLoginUsername('pls20154', 'clinician', 12345)).toBe('PLS20154C12345');
     });

     it('parses the organization prefix, account type, and local ID without confusing the S in PLS', () => {
          expect(parseLoginUsername('pls20154s004')).toMatchObject({ organizationIdentifier: 'PLS20154', entityType: 'staff', entityId: 4 });
          expect(parseLoginUsername('PLS20154P450')).toEqual({
               organizationIdentifier: 'PLS20154', entityType: 'patient', entityId: 450, loginUsername: 'PLS20154P450',
          });
          expect(parseLoginUsername('PLS20154C0002')).toMatchObject({ organizationIdentifier: 'PLS20154', entityType: 'clinician', entityId: 2 });
     });

     it.each(['S3', '12345S3', '1234567S3', '000000S3', 'PLS20154S0', 'PLS20154X3',
          'PLS20154S', 'PLS20154S1000000000', 'PLS20154-S3', 'PLS 20154S3', 'user@lab.com'])('rejects invalid username %s', (value) => {
          expect(parseLoginUsername(value)).toBeNull();
     });

     it('rejects invalid organization prefixes and account IDs outside the supported range', () => {
          expect(() => formatLoginUsername('123456', 'staff', 1)).toThrow(RangeError);
          expect(() => formatLoginUsername('', 'staff', 1)).toThrow(RangeError);
          expect(() => formatLoginUsername('PLS20154', 'staff', 1000000000)).toThrow(RangeError);
     });
});

describe('facility codes', () => {
     it('derives a readable six-character code from the organization name', () => {
          expect(facilityCodeBase('Abdi Medical Laboratory')).toBe('ABDIML');
          expect(facilityCodeBase('Vitalscan')).toBe('VITALS');
          expect(isValidFacilityCode(facilityCodeBase('123 Lab'))).toBe(true);
     });

     it('offers unique fallbacks when the preferred code is taken', () => {
          const candidates = facilityCodeCandidates('Abdi Medical Laboratory');
          expect(candidates[0]).toBe('ABDIML');
          expect(new Set(candidates).size).toBe(candidates.length);
          expect(candidates.every(isValidFacilityCode)).toBe(true);
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
