import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';

const mocks = vi.hoisted(() => ({
     service: {
          listFacilities: vi.fn(),
          publicCatalog: vi.fn(),
          register: vi.fn(),
          createBooking: vi.fn(),
          trackBooking: vi.fn(),
          submitPatientPaymentClaim: vi.fn(),
          login: vi.fn(),
          authenticateStaff: vi.fn(),
          revokeStaffSession: vi.fn(),
          updateFacilityProfile: vi.fn(),
          listBookings: vi.fn(),
          listCatalog: vi.fn(),
          addCatalogItem: vi.fn(),
          updateCatalogItem: vi.fn(),
          decidePayment: vi.fn(),
          decideBooking: vi.fn(),
          recordRefund: vi.fn(),
          linkExistingCoreRecords: vi.fn(),
          listPlatformFacilities: vi.fn(),
          approveFacility: vi.fn(),
          suspendFacility: vi.fn(),
          linkTenant: vi.fn(),
     },
}));

vi.mock('./MarketplaceService', () => ({
     MarketplaceError: class MarketplaceError extends Error {
          constructor(message: string, public statusCode: number) { super(message); }
     },
     MarketplaceService: class { constructor() { return mocks.service as any; } },
}));
vi.mock('../middleware/validateTenancy', () => ({
     parseCookies: (header = '') => Object.fromEntries(header.split(';').filter(Boolean).map(part => {
          const [name, ...value] = part.trim().split('=');
          return [name, value.join('=')];
     })),
}));
vi.mock('../middleware/platformFacilityAuthority', () => ({
     requirePlatformFacilityAuthority: (_req: any, res: any, next: any) => {
          res.locals.facilityActor = { tenantId: 1, employeeId: 9 };
          next();
     },
}));
vi.mock('./coreStaffAuth', () => ({
     requireCoreFacilityStaff: (_req: any, res: any, next: any) => {
          res.locals.marketplaceCoreStaff = { tenantId: 2, employeeId: 3, role: 'admin', facilityId: 8 };
          next();
     },
     requireCoreRole: () => (_req: any, _res: any, next: any) => next(),
}));

import router from './marketplaceRouter';

describe('marketplace HTTP contract', () => {
     const app = express();
     let server: ReturnType<typeof app.listen>;
     let baseUrl: string;

     beforeAll(async () => {
          app.use(express.json());
          app.use(router);
          server = app.listen(0);
          await new Promise<void>(resolve => server.once('listening', resolve));
          baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/marketplace`;
     });

     afterAll(async () => {
          await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
     });

     beforeEach(() => {
          for (const method of Object.values(mocks.service)) method.mockReset().mockResolvedValue({});
     });

     it('rejects tenant/query parameters on private tracking lookup and does not invoke lookup', async () => {
          const response = await fetch(`${baseUrl}/bookings/track?trackingToken=private-token`, { method: 'POST' });
          expect(response.status).toBe(400);
          expect(response.headers.get('cache-control')).toContain('no-store');
          expect(mocks.service.trackBooking).not.toHaveBeenCalled();
     });

     it('returns an uncached 201 booking request and passes only the submitted JSON body', async () => {
          mocks.service.createBooking.mockResolvedValue({
               bookingId: 'c4551081-a5d8-4a5b-8f58-15dcb5368654',
               trackingToken: 'A'.repeat(43), status: 'requested', totalAmount: 12.34, currency: 'GHS',
          });
          const body = {
               facilitySlug: 'sample-lab', itemIds: [7], idempotencyKey: 'A'.repeat(43),
               patient: { name: 'Patient', phone: '+1000000' }, collectionMethod: 'in_facility',
          };
          const response = await fetch(`${baseUrl}/bookings`, {
               method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
          });
          expect(response.status).toBe(201);
          expect(response.headers.get('cache-control')).toContain('no-store');
          expect(mocks.service.createBooking).toHaveBeenCalledWith(body);
          expect((await response.json()).result.status).toBe('requested');
     });

     it('sets a secure HttpOnly staff cookie without returning the bearer token in JSON', async () => {
          const sessionToken = 'B'.repeat(43);
          mocks.service.login.mockResolvedValue({
               accessToken: sessionToken, expiresAt: new Date(Date.now() + 60_000).toISOString(),
               facility: { slug: 'sample-lab', name: 'Sample' }, staff: { id: 2, email: 'staff@example.invalid', role: 'admin' },
          });
          const response = await fetch(`${baseUrl}/staff/login`, {
               method: 'POST', headers: { 'content-type': 'application/json' },
               body: JSON.stringify({ facilitySlug: 'sample-lab', email: 'staff@example.invalid', password: 'not-returned' }),
          });
          expect(response.status).toBe(200);
          expect(response.headers.get('set-cookie')).toContain('HttpOnly');
          expect(response.headers.get('set-cookie')).toContain('Secure');
          expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
          expect(response.headers.get('set-cookie')).toContain('Path=/api/v1/marketplace/staff');
          expect(response.headers.get('set-cookie')).toMatch(/Max-Age=\d+/);
          expect(await response.text()).not.toContain(sessionToken);
     });

     it('revokes the current session and clears the scoped cookie at logout', async () => {
          mocks.service.authenticateStaff.mockResolvedValue({
               staff: { id: 5, email: 'staff@example.invalid', role: 'admin', facilityId: 8, sessionId: 7 },
               facility: { id: 8, slug: 'sample-lab', integrationState: 'independent' },
          });
          const response = await fetch(`${baseUrl}/staff/logout`, {
               method: 'POST', headers: { cookie: `pls-marketplace-session=${'C'.repeat(43)}` },
          });
          expect(response.status).toBe(200);
          expect(mocks.service.revokeStaffSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 7 }));
          expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
          expect(response.headers.get('set-cookie')).toContain('HttpOnly');
          expect((await response.json()).result).toEqual({ revoked: true });
     });

     it('sanitizes unexpected backend errors and never returns SQL or patient details', async () => {
          const error = new Error('SQL error for Patient Example, patient@example.invalid: SELECT secret');
          mocks.service.publicCatalog.mockRejectedValue(error);
          const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
          try {
               const response = await fetch(`${baseUrl}/facilities/sample-lab/catalog`);
               const body = await response.text();
               expect(response.status).toBe(503);
               expect(body).not.toContain('Patient Example');
               expect(body).not.toContain('patient@example.invalid');
               expect(body).not.toContain('SELECT secret');
               expect(body).toContain('temporarily unavailable');
               expect(response.headers.get('cache-control')).toContain('no-store');
          } finally {
               log.mockRestore();
          }
     });

     it('does not permit ordinary facility staff to verify a payment claim', async () => {
          mocks.service.authenticateStaff.mockResolvedValue({
               staff: { id: 5, email: 'staff@example.invalid', role: 'staff', facilityId: 8, sessionId: 7 },
               facility: { id: 8, slug: 'sample-lab', integrationState: 'independent' },
          });
          const response = await fetch(`${baseUrl}/staff/bookings/c4551081-a5d8-4a5b-8f58-15dcb5368654/payment-claims/4/decision`, {
               method: 'POST',
               headers: { 'content-type': 'application/json', authorization: `Bearer ${'A'.repeat(43)}` },
               body: JSON.stringify({ decision: 'verified', reason: 'reviewed' }),
          });
          expect(response.status).toBe(403);
          expect(mocks.service.decidePayment).not.toHaveBeenCalled();
     });
});
