import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { once } from 'node:events';
import { handleOverLoad } from '../../hooks/helper';

const mocks = vi.hoisted(() => ({
     standing: vi.fn(), role: vi.fn(), session: vi.fn(), sessionValid: vi.fn(),
     list: vi.fn(), resend: vi.fn(), authenticate: vi.fn(), endSessions: vi.fn(), audit: vi.fn(),
}));
vi.mock('../../hooks/helper', () => ({
     customError: (message: string, status: number, res: any) => res.status(status).send({ status: 'error', statusCode: status, message }),
     responseError: (res: any) => res.status(500).send({ status: 'error' }),
     handleOverLoad: (handler: any) => handler,
}));
vi.mock('../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class { validateTenantStanding = mocks.standing; } }));
vi.mock('../../models/settings/users/RolesRepository', () => ({ default: class { getRoleByEmail = mocks.role; } }));
vi.mock('../../models/security/repositories/loginlog.repo', () => ({ ApplicationLoginLog: class { findSessionById = mocks.session; } }));
vi.mock('../../middleware/resolveLoginTenant', () => ({
     LOGIN_ROUTES: ['/api/v1/prime/login', '/api/v1/login/clinician', '/api/v1/login/patient'],
     resolvePublicTenant: vi.fn(),
}));
vi.mock('../../models/patient-portal/PatientPortalAccountService', async (importOriginal) => {
     const actual: any = await importOriginal();
     return { ...actual, PatientPortalAccountService: class {
          isSessionValid = mocks.sessionValid;
          listFacilityInvitations = mocks.list;
          resendInvitation = mocks.resend;
          authenticate = mocks.authenticate;
          endSessions = mocks.endSessions;
          portalBaseUrl = () => 'https://portal.example.test';
     } };
});
vi.mock('../../models/patient-portal/PatientPortalBootstrapper', () => ({ bootstrapPatientPortal: vi.fn() }));
vi.mock('../../models/patient-portal/PatientPortalAudit', () => ({ recordPortalAudit: mocks.audit }));

import { checkTokenExists, patientRouteAllowed } from '../../middleware/validateTenancy';
import { configuration } from '../../hooks/configuration';
import { getInvitations, patientPortalRouter, requirePatientSession, requireStaff, resendInvitation } from './route';
import { authenticatePatientPortal, logoutUser } from '../logins/authHandlers';

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

     it('allows credential submission without an existing session, but not protected or lookalike paths', async () => {
          for (const path of ['/api/v1/prime/login', '/api/v1/login/patient', '/api/v1/login/clinician']) {
               const next = vi.fn();
               await checkTokenExists(request('POST', path), response() as any, next);
               expect(next).toHaveBeenCalledOnce();
          }
          for (const [method, path] of [
               ['GET', '/api/v1/login/patient'],
               ['POST', '/api/v1/login/patient/extra'],
               ['POST', '/api/v1/prime/login/extra'],
               ['GET', '/api/v1/patient-portal/admin/invitations'],
          ]) {
               const next = vi.fn();
               const res = response();
               await checkTokenExists(request(method, path), res as any, next);
               expect(res.status).toHaveBeenCalledWith(401);
               expect(next).not.toHaveBeenCalled();
          }
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

     it('accepts a persisted patient cookie without requiring a staff session', async () => {
          const req = request('GET', '/api/v1/patient-portal/me');
          req.headers.cookie = `other=value; pls-prime-tenant-session=${patientToken()}`;
          const next = vi.fn();
          await checkTokenExists(req, response() as any, next);
          expect(next).toHaveBeenCalledOnce();
          expect(req.authUser).toMatchObject({ patientid: 21, role: 'patient', tenantId: 4 });
          expect(mocks.session).not.toHaveBeenCalled();
          expect(mocks.role).not.toHaveBeenCalled();
     });

     it('returns an unauthorized response for expired or invalid sessions', async () => {
          const expired = jwt.sign({ tid: 4, patientid: 21, role: 'patient' }, SECRET, { expiresIn: -1 });
          for (const token of [expired, 'invalid-token']) {
               const res = response();
               const next = vi.fn();
               await checkTokenExists(request('GET', '/api/v1/patient-portal/me', token), res as any, next);
               expect(res.status).toHaveBeenCalledWith(401);
               expect(next).not.toHaveBeenCalled();
          }
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

     it('protects facility invitation lists and resends with administrator authorization', () => {
          const routes = (patientPortalRouter as any).stack.filter((layer: any) => layer.route).map((layer: any) => layer.route);
          for (const path of ['/api/v1/patient-portal/admin/invitations', '/api/v1/patient-portal/admin/invitations/:id/resend']) {
               const guard = routes.find((route: any) => route.path === path).stack[0].handle;
               for (const role of ['patient', 'clinician', 'receptionist']) {
                    const res = response();
                    const next = vi.fn();
                    guard({ authUser: { role, employeeid: 7 } }, res, next);
                    expect(res.status).toHaveBeenCalledWith(403);
                    expect(next).not.toHaveBeenCalled();
               }
               for (const role of ['admin', 'manager']) {
                    const next = vi.fn();
                    guard({ authUser: { role, employeeid: 7 } }, response(), next);
                    expect(next).toHaveBeenCalledOnce();
               }
          }
     });

     it('rejects an administrator attempting to list invitations in another facility', async () => {
          mocks.role.mockResolvedValue({ employeeid: 7, role: 'admin' });
          const token = jwt.sign({ tid: 5, role: 'admin', email: 'admin@example.test', employeeid: 7, sid: 'staff-session' }, SECRET, { expiresIn: '1h' });
          const res = response();
          const next = vi.fn();
          await checkTokenExists(request('GET', '/api/v1/patient-portal/admin/invitations', token), res as any, next);
          expect(res.status).toHaveBeenCalledWith(403);
          expect(next).not.toHaveBeenCalled();
          expect(mocks.session).not.toHaveBeenCalled();
     });

     it('lists pending invitations by default and rejects invalid filters before querying', async () => {
          mocks.list.mockResolvedValue({ invitations: [], total: 0, page: 1, pageSize: 20 });
          const res = response();
          await getInvitations({ query: { tenantId: '4' } } as any, res as any);
          expect(mocks.list).toHaveBeenCalledWith({ status: 'pending', search: '', page: 1, pageSize: 20 });
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
               data: { invitations: [], total: 0, page: 1, pageSize: 20 },
          }));
          for (const filters of [
               { status: 'used' }, { page: '0' }, { pageSize: '101' }, { page: '1.5' },
               { search: ['patient'] }, { status: ['pending'] }, { search: 'a'.repeat(101) },
          ]) {
               const invalid = response();
               await getInvitations({ query: { tenantId: '4', ...filters } } as any, invalid as any);
               expect(invalid.status).toHaveBeenCalledWith(400);
          }
          expect(mocks.list).toHaveBeenCalledTimes(1);
     });

     it('reports resend delivery failure and audits old and replacement identifiers without tokens', async () => {
          mocks.resend.mockResolvedValue({
               id: 6, patientid: 21, token: 'secret-token', emailed: false, deliveryError: 'Email delivery failed.',
          });
          const res = response();
          await resendInvitation({
               params: { id: '5' }, query: { tenantId: '4' }, authUser: { role: 'admin', employeeid: 7 },
          } as any, res as any);
          expect(mocks.resend).toHaveBeenCalledWith(5, 7);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('not emailed') }));
          expect(mocks.audit).toHaveBeenCalledWith(4, expect.objectContaining({ action: 'invitation.replaced', resourceId: 5 }));
          expect(mocks.audit).toHaveBeenCalledWith(4, expect.objectContaining({ action: 'invitation.resend_failed', resourceId: 6 }));
          expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain('secret-token');
     });

     it('issues a patient-scoped token after valid credentials and ends that session on logout', async () => {
          mocks.authenticate.mockResolvedValue({
               ok: true, account: { session_version: 2 },
               patient: { patientid: 21, firstname: 'Ama', lastname: 'Mensah', fullpatientid: 'PT21' },
          });
          const res = response();
          await authenticatePatientPortal({
               query: { tenantId: '4' }, body: { username: 'P21', password: 'Secure123' },
          } as any, res as any);
          expect(mocks.authenticate).toHaveBeenCalledWith(21, 'Secure123');
          const payload = res.send.mock.calls[0][0];
          expect(jwt.verify(payload.accessToken, SECRET)).toMatchObject({
               role: 'patient', patientid: 21, tid: 4, sv: 2, clientType: 'patient-portal',
          });
          const signedOut = response();
          await logoutUser({
               query: { tenantId: '4' }, headers: { 'pls-prime-tenant-session': payload.accessToken },
          } as any, signedOut as any);
          expect(mocks.endSessions).toHaveBeenCalledWith(21);
     });

     it('rejects invalid credentials without minting an access token', async () => {
          mocks.authenticate.mockResolvedValue({ ok: false, reason: 'INVALID' });
          const res = response();
          await authenticatePatientPortal({
               query: { tenantId: '4' }, body: { username: 'P21', password: 'wrong' },
          } as any, res as any);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(res.send.mock.calls[0][0]).not.toHaveProperty('accessToken');
     });

     it('allows a real HTTP login without a prior token and uses its cookie only on patient APIs', async () => {
          mocks.authenticate.mockResolvedValue({
               ok: true, account: { session_version: 2 },
               patient: { patientid: 21, firstname: 'Ama', lastname: 'Mensah' },
          });
          mocks.sessionValid.mockResolvedValue(true);
          const app = express();
          app.use(express.json());
          app.use(checkTokenExists);
          app.post('/api/v1/login/patient', handleOverLoad(authenticatePatientPortal));
          app.get('/api/v1/patient-portal/session-check', requirePatientSession, (_req, res) => {
               res.json({ status: 'success' });
          });
          app.use(patientPortalRouter);
          const server = app.listen(0, '127.0.0.1');
          await once(server, 'listening');
          try {
               const address = server.address();
               if (!address || typeof address === 'string') throw new Error('Expected a TCP test server');
               const base = `http://127.0.0.1:${address.port}`;
               const login = await fetch(`${base}/api/v1/login/patient?tenantId=4`, {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ username: 'P21', password: 'Secure123' }),
               });
               expect(login.status).toBe(200);
               const payload = await login.json();
               expect(payload.status).toBe('success');
               const headers = { cookie: `pls-prime-tenant-session=${payload.accessToken}` };
               const session = await fetch(`${base}/api/v1/patient-portal/session-check?tenantId=4`, { headers });
               expect(session.status).toBe(200);
               expect(mocks.sessionValid).toHaveBeenCalledWith(21, 2);
               const forbidden = await fetch(`${base}/api/v1/patient-portal/admin/invitations?tenantId=4`, { headers });
               expect(forbidden.status).toBe(403);
               const otherFacility = await fetch(`${base}/api/v1/patient-portal/session-check?tenantId=5`, { headers });
               expect(otherFacility.status).toBe(403);
          } finally {
               await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
          }
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
