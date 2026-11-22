import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findSessionById: vi.fn(), tenant: vi.fn(), masterSessionActive: vi.fn() }));

vi.mock('../../database/connection', () => ({ systemConfigConnection: {}, singleTenantKnexInstance: {} }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class {} }));
vi.mock('../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class {} }));
vi.mock('../Tenancy/TenantRegistry', async importOriginal => {
     const original = await importOriginal<typeof import('../Tenancy/TenantRegistry')>();
     return { ...original, TenantRegistry: class { getTenant = mocks.tenant; } };
});
vi.mock('../Tenancy/MasterOwnerSession', () => ({ isMasterSessionActive: mocks.masterSessionActive }));
vi.mock('../../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class {
          findSessionById = mocks.findSessionById;
     },
}));

import { formatLoginUsername, parseLoginUsername } from './TenantLoginDirectory';
import { facilityCodeBase, facilityCodeCandidates, isValidFacilityCode } from '../Tenancy/TenantRegistry';
import { hashDeviceFingerprint, verifyStaffSession } from '../../middleware/validateTenancy';
import { deviceManagerRouteAllowed } from '../security/deviceManagerSession';
import { configuration } from '../../hooks/configuration';
import { DEVELOPER_SUPPORT_EMAIL } from '../Tenancy/DeveloperSessionPolicy';

afterEach(() => {
     mocks.findSessionById.mockReset();
     mocks.tenant.mockReset();
     mocks.masterSessionActive.mockReset();
});

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
     it('rejects requests from a previous role revision without logging out the replacement session',async()=>{
          const result=await verifyStaffSession({sid:'cur',employeeid:1,tid:3,arv:0},1,3,request,{access_revision:1});
          expect(result).toMatchObject({ok:false,statusCode:409,body:{code:'SESSION_ROLE_CHANGED'}});
          expect(result.body?.isExpired).not.toBe(true);
     });

     it('rejects tokens issued without a session id', async () => {
          const result = await verifyStaffSession({ email: 'a@b.c' }, 1, 3, request);
          expect(result).toMatchObject({ ok: false, statusCode: 401 });
     });
     it('refreshes a stale role only through the exact recovery endpoint while retaining every live-session check',async()=>{
          const claims={sid:'cur',employeeid:1,tid:3,arv:0,fph:hashDeviceFingerprint('device-a')};
          const req={method:'POST',path:'/api/v1/prime/refresh-role-session',headers:{'x-device-id':'device-a'}} as any;
          mocks.findSessionById.mockResolvedValue({loggedout:0,logoutTime:future});
          expect(await verifyStaffSession(claims,1,3,req,{access_revision:2})).toEqual({ok:true});
          expect((await verifyStaffSession(claims,1,3,{...req,method:'GET'},{access_revision:2})).statusCode).toBe(409);
          expect((await verifyStaffSession(claims,1,3,{...req,path:'/api/v1/pharmacy/sales'},{access_revision:2})).statusCode).toBe(409);
          expect((await verifyStaffSession({...claims,tid:4},1,3,req,{access_revision:2})).body).toMatchObject({code:'TENANT_MISMATCH'});
          expect((await verifyStaffSession({...claims,employeeid:2},1,3,req,{access_revision:2})).body).toMatchObject({code:'SESSION_INVALID'});
          expect((await verifyStaffSession(claims,1,3,{...req,headers:{'x-device-id':'wrong'}},{access_revision:2})).body).toMatchObject({code:'DEVICE_MISMATCH'});
          mocks.findSessionById.mockResolvedValueOnce({loggedout:1,logoutTime:future});
          expect((await verifyStaffSession(claims,1,3,req,{access_revision:2})).body).toMatchObject({code:'SESSION_REPLACED'});
          mocks.findSessionById.mockResolvedValueOnce({loggedout:0,logoutTime:new Date(0)});
          expect((await verifyStaffSession(claims,1,3,req,{access_revision:2})).body).toMatchObject({code:'SESSION_EXPIRED'});
          expect((await verifyStaffSession({...claims,arv:3},1,3,req,{access_revision:2})).body).toMatchObject({code:'SESSION_INVALID'});
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

     it('confirms a master-bound developer session for the registered local tenant only', async () => {
          const previousMode = configuration.isMultiTenant;
          const previousTenantId = configuration.defaultTenantId;
          configuration.isMultiTenant = false;
          configuration.defaultTenantId = 42;
          mocks.tenant.mockResolvedValue({ isActive: true });
          mocks.masterSessionActive.mockResolvedValue(true);
          mocks.findSessionById.mockResolvedValue({ loggedout: 0, logoutTime: future });
          const claims = {
               email: DEVELOPER_SUPPORT_EMAIL,
               developerOwner: { masterSessionId: 'master-session' },
               tid: 42,
               employeeid: 1,
               sid: 'developer-session',
          };
          const role = {
               email: DEVELOPER_SUPPORT_EMAIL,
               platform_support: 1,
               activation: 1,
               role: 'super-admin',
          };

          try {
               await expect(verifyStaffSession(claims, 1, 42, request, role)).resolves.toEqual({ ok: true });
               expect((await verifyStaffSession(claims, 1, 43, request, role)).body)
                    .toMatchObject({ code: 'DEVELOPER_SESSION_DENIED' });
          } finally {
               configuration.isMultiTenant = previousMode;
               configuration.defaultTenantId = previousTenantId;
          }
     });

     it('binds Device Manager sessions to a signed scope, tenant, and required device identity', async () => {
          mocks.findSessionById.mockResolvedValue({ loggedout: 0, logoutTime: future });
          const token = { sid: 'device-manager:abc', clientType: 'device-manager', employeeid: 1, tid: 3, fph: hashDeviceFingerprint('manager') };
          const req = { method: 'GET', path: '/api/v1/interfacing/devices', headers: { 'x-device-id': 'manager' } } as any;
          await expect(verifyStaffSession(token, 1, 3, req)).resolves.toEqual({ ok: true });
          expect((await verifyStaffSession({ ...token, clientType: undefined }, 1, 3, req)).body).toMatchObject({ code: 'SESSION_INVALID' });
          expect((await verifyStaffSession(token, 1, 3, { ...req, headers: {} })).body).toMatchObject({ code: 'DEVICE_MISMATCH' });
          expect((await verifyStaffSession(token, 1, 3, { ...req, headers: { 'x-device-id': 'other' } })).body).toMatchObject({ code: 'DEVICE_MISMATCH' });
          expect((await verifyStaffSession(token, 1, 4, req)).body).toMatchObject({ code: 'TENANT_MISMATCH' });
          expect((await verifyStaffSession(token, 1, 3, { ...req, path: '/api/v1/logins' })).body).toMatchObject({ code: 'SESSION_SCOPE_DENIED' });
          mocks.findSessionById.mockResolvedValueOnce({ loggedout: 1, logoutTime: future });
          expect((await verifyStaffSession(token, 1, 3, req)).body).toMatchObject({ code: 'SESSION_REPLACED' });
     });

     it('allows only exact Device Manager operations, not CRUD, license administration, or arbitrary APIs', () => {
          expect(deviceManagerRouteAllowed('GET', '/api/v1/interfacing/devices')).toBe(true);
          expect(deviceManagerRouteAllowed('GET', '/api/v1/interfacing/devices/license')).toBe(true);
          expect(deviceManagerRouteAllowed('POST', '/api/v1/interfacing/devices/receiving/data')).toBe(true);
          expect(deviceManagerRouteAllowed('POST', '/api/v1/logins/logout')).toBe(true);
          for (const [method, path] of [
               ['POST', '/api/v1/interfacing/devices'],
               ['DELETE', '/api/v1/interfacing/devices/1'],
               ['GET', '/api/v1/interfacing/devices/1'],
               ['POST', '/api/v1/security/license/activate'],
               ['GET', '/api/v1/platform/facilities'],
          ]) expect(deviceManagerRouteAllowed(method, path)).toBe(false);
     });
});
