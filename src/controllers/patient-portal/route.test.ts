import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({ standing: vi.fn(), role: vi.fn(), session: vi.fn(), sessionValid: vi.fn() }));
vi.mock('../../hooks/helper', () => ({
     customError: (message: string, status: number, res: any) => res.status(status).send({ status: 'error', statusCode: status, message }),
     responseError: (res: any) => res.status(500).send({ status: 'error' }),
     handleOverLoad: (handler: any) => handler,
}));
vi.mock('../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class { validateTenantStanding = mocks.standing; } }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class { getRoleByEmail = mocks.role; } }));
vi.mock('../../models/security/repositories/loginlog.repo', () => ({ ApplicationLoginLog: class { findSessionById = mocks.session; } }));
vi.mock('../../middleware/resolveLoginTenant', () => ({ LOGIN_ROUTES: ['/api/v1/prime/login'], resolvePublicTenant: vi.fn() }));
vi.mock('../../models/patient-portal/PatientPortalAccountService', async (importOriginal) => {
     const actual: any = await importOriginal();
     return { ...actual, PatientPortalAccountService: class { isSessionValid = mocks.sessionValid; } };
});
vi.mock('../../models/patient-portal/PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: vi.fn() }));

import { checkTokenExists, patientRouteAllowed } from '../../middleware/validateTenancy';
import { configuration } from '../../hooks/configuration';
import { patientPortalRouter, requirePatientSession, requireStaff } from './route';

const SECRET = 'portal-test-signing-key';
const response = () => ({ status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
const request = (method: string, path: string, token?: string) =>
     ({ path, method, query: { tenantId: '4' }, headers: token ? { 'pls-prime-tenant-session': token } : {} }) as any;
const patientToken = (claims: Record<string, unknown> = {}) =>
     jwt.sign({ tid: 4, patientid: 21, employeeid: 21, role: 'patient', sv: 2, ...claims }, SECRET, { expiresIn: '1h' });

describe('patient portal authentication boundaries', () => {
     const original = { ...configuration };
     beforeEach(() => {
          vi.clearAllMocks();
          vi.stubEnv('ACCESS_TOKEN_SECRET', SECRET);
          configuration.isMultiTenant = true;
          configuration.defaultTenantId = 3;
     });
     afterEach(() => {
          vi.unstubAllEnvs();
          Object.assign(configuration, original);
     });

     it('limits patient tokens to patient portal routes', () => {
          expect(patientRouteAllowed('GET', '/api/v1/patient-portal/results')).toBe(true);
          expect(patientRouteAllowed('GET', '/api/v1/prime/validate-token')).toBe(true);
          expect(patientRouteAllowed('GET', '/api/v1/patient-portal/admin/settings')).toBe(false);
          expect(patientRouteAllowed('GET', '/API/V1/PATIENT-PORTAL/ADMIN/settings')).toBe(false);
          expect(patientRouteAllowed('POST', '/api/v1/patient-portal/public/register/start')).toBe(false);
          expect(patientRouteAllowed('GET', '/api/v1/patients/21')).toBe(false);
          expect(patientRouteAllowed('GET', '/api/v1/billing/list')).toBe(false);
     });

     it('rejects a patient token on staff APIs', async () => {
          const res = response();
          const next = vi.fn();
          await checkTokenExists(request('GET', '/api/v1/patients/22', patientToken()), res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });

     it('rejects patient tokens issued for another facility or without a facility', async () => {
          for (const token of [patientToken({ tid: 5 }), jwt.sign({ patientid: 21, role: 'patient' }, SECRET, { expiresIn: '1h' })]) {
               const res = response();
               const next = vi.fn();
               await checkTokenExists(request('GET', '/api/v1/patient-portal/results', token), res as any, next);
               expect(res.status).toHaveBeenCalledWith(403);
               expect(next).not.toHaveBeenCalled();
          }
     });

     it('accepts a patient token on portal routes and carries the session version', async () => {
          const req = request('GET', '/api/v1/patient-portal/results', patientToken());
          const next = vi.fn();
          await checkTokenExists(req, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
          expect(req.authUser).toMatchObject({ role: 'patient', patientid: 21, sessionVersion: 2 });
     });

     it('rejects revoked patient sessions and non-patient users on patient routes', async () => {
          mocks.sessionValid.mockResolvedValue(false);
          const res = response();
          const next = vi.fn();
          await requirePatientSession({ query: { tenantId: '4' }, authUser: { role: 'patient', patientid: 21, sessionVersion: 1 } } as any, res as any, next);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();

          const staff = response();
          await requirePatientSession({ query: { tenantId: '4' }, authUser: { role: 'admin', employeeid: 1 } } as any, staff as any, next);
          expect(staff.status).toHaveBeenCalledWith(403);

          mocks.sessionValid.mockResolvedValue(true);
          await requirePatientSession({ query: { tenantId: '4' }, authUser: { role: 'patient', patientid: 21, sessionVersion: 2 } } as any, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
          expect(mocks.sessionValid).toHaveBeenLastCalledWith(21, 2);
     });

     it('keeps portal administration for staff and restricts sensitive actions by role', () => {
          const next = vi.fn();
          for (const role of ['patient', 'clinician']) {
               const res = response();
               requireStaff()({ authUser: { role, employeeid: 1 } } as any, res as any, next);
               expect(res.status).toHaveBeenCalledWith(403);
          }
          const receptionist = response();
          requireStaff(['admin', 'manager'])({ authUser: { role: 'receptionist', employeeid: 2 } } as any, receptionist as any, next);
          expect(receptionist.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
          requireStaff(['admin', 'manager'])({ authUser: { role: 'admin', employeeid: 1 } } as any, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
     });

     it('guards every portal route', () => {
          const routes = (patientPortalRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => layer.route);
          expect(routes.length).toBeGreaterThan(15);
          for (const route of routes) {
               const guard = route.stack[0].handle;
               if (route.path.includes('/admin/')) expect(guard.name).not.toBe('requirePatientSession');
               else expect(guard).toBe(requirePatientSession);
               expect(route.stack.length).toBe(2);
          }
     });
});
