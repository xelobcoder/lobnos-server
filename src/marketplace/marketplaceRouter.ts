import { Request, Response, Router } from 'express';
import { parseCookies } from '../middleware/validateTenancy';
import { requirePlatformFacilityAuthority } from '../middleware/platformFacilityAuthority';
import { requireCoreFacilityStaff, requireCoreRole } from './coreStaffAuth';
import { MarketplaceError, MarketplaceService } from './MarketplaceService';
import { PublicCatalogError } from '../models/public/PublicFacilityCatalog';

const router = Router();
const service = new MarketplaceService();
const base = '/api/v1/marketplace';

router.use(base, (_req, res, next) => {
     res.setHeader('Cache-Control', 'no-store, private, max-age=0');
     res.setHeader('Pragma', 'no-cache');
     res.setHeader('X-Content-Type-Options', 'nosniff');
     next();
});

function noUnexpectedQuery(req: Request, res: Response, allowed: string[] = []): boolean {
     const keys = Object.keys(req.query);
     if (keys.some(key => !allowed.includes(key))) {
          res.status(400).json({ status: 'error', message: 'Unexpected query parameters' });
          return false;
     }
     return true;
}

function noTenantBody(req: Request, res: Response): boolean {
     if (req.body && typeof req.body === 'object' && Object.prototype.hasOwnProperty.call(req.body, 'tenantId')) {
          res.status(400).json({ status: 'error', message: 'Tenant identifiers are not accepted in this request body' });
          return false;
     }
     return true;
}

function handle(operation: (req: Request, res: Response) => Promise<unknown>, allowedQuery: string[] = [], successStatus = 200, allowTenantIdBody = false) {
     return async (req: Request, res: Response) => {
          if (!noUnexpectedQuery(req, res, allowedQuery)) return;
          if (!allowTenantIdBody && !noTenantBody(req, res)) return;
          try {
               const result = await operation(req, res);
               return res.status(successStatus).json({ status: 'success', result });
          } catch (error: any) {
               if (error instanceof MarketplaceError || error instanceof PublicCatalogError) {
                    return res.status(error.statusCode).json({ status: 'error', message: error.message });
               }
               // Do not log request bodies, patient data, payment references, session tokens, SQL, or driver details.
               console.error(`[marketplace] ${req.method} ${req.route?.path || 'route'} failed`);
               return res.status(503).json({ status: 'error', message: 'Marketplace service is temporarily unavailable' });
          }
     };
}

function sessionToken(req: Request): string | null {
     const authorization = req.headers.authorization;
     if (typeof authorization === 'string') {
          const match = /^Bearer ([A-Za-z0-9_-]{40,60})$/.exec(authorization);
          if (match) return match[1];
          if (/^Bearer\s/i.test(authorization)) return null;
     }
     return parseCookies(req.headers.cookie)['pls-marketplace-session'] || null;
}

async function staffAuth(req: Request, res: Response, operation: (staff: any, facility: any) => Promise<unknown>) {
     if (!noUnexpectedQuery(req, res)) return;
     if (!noTenantBody(req, res)) return;
     const token = sessionToken(req);
     if (!token) return res.status(401).json({ status: 'error', message: 'A valid facility staff session is required' });
     try {
          const session = await service.authenticateStaff(token);
          return res.json({ status: 'success', result: await operation(session.staff, session.facility) });
     } catch (error: any) {
          if (error instanceof MarketplaceError) return res.status(error.statusCode).json({ status: 'error', message: error.message });
          console.error(`[marketplace] ${req.method} ${req.route?.path || 'staff route'} failed`);
          return res.status(503).json({ status: 'error', message: 'Marketplace service is temporarily unavailable' });
     }
}

function facilityAdmin(staff: any) {
     if (staff.role !== 'admin') throw new MarketplaceError('Only a facility administrator may perform this action', 403);
}

router.get(`${base}/facilities`, handle(req => service.listFacilities(req.query.q), ['q']));
router.get(`${base}/facilities/:slug/catalog`, handle(req => service.publicCatalog(req.params.slug)));
router.post(`${base}/registrations`, handle(req => service.register(req.body), [], 202));
router.post(`${base}/bookings`, handle(req => service.createBooking(req.body), [], 201));
router.post(`${base}/bookings/track`, handle(req => service.trackBooking(req.body)));
router.post(`${base}/bookings/payment-claims`, handle(req => service.submitPatientPaymentClaim(req.body), [], 201));

router.post(`${base}/staff/login`, handle(async (req, res) => {
     const session = await service.login(req.body);
     const expiresAt = new Date(session.expiresAt).getTime();
     const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
     res.setHeader('Set-Cookie', `pls-marketplace-session=${session.accessToken}; Path=${base}/staff; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`);
     return { expiresAt: session.expiresAt, facility: session.facility, staff: session.staff };
}));
router.post(`${base}/staff/logout`, (req, res) =>
     staffAuth(req, res, async staff => {
          await service.revokeStaffSession(staff);
          res.setHeader('Set-Cookie', `pls-marketplace-session=; Path=${base}/staff; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
          return { revoked: true };
     }));
router.get(`${base}/staff/me`, (req, res) => staffAuth(req, res, async (staff, facility) => ({ staff: { id: staff.id, email: staff.email, role: staff.role }, facility })));
router.patch(`${base}/staff/profile`, (req, res) => staffAuth(req, res, (staff, facility) =>
     service.updateFacilityProfile(staff, facility, req.body)));
router.get(`${base}/staff/users`, (req, res) => staffAuth(req, res, staff => service.listStaffUsers(staff)));
router.post(`${base}/staff/users`, (req, res) => staffAuth(req, res, staff => service.createStaffUser(staff, req.body)));
router.patch(`${base}/staff/users/:staffId`, (req, res) => staffAuth(req, res, staff =>
     service.setStaffUserActive(staff, req.params.staffId, req.body?.active)));
router.get(`${base}/staff/bookings`, (req, res) => staffAuth(req, res, async (staff) => service.listBookings({ ...staff, staffId: staff.id })));
router.get(`${base}/staff/catalog`, (req, res) => staffAuth(req, res, async (_staff, facility) => service.listCatalog(facility)));
router.post(`${base}/staff/catalog`, (req, res) => staffAuth(req, res, async (staff, facility) =>
     service.addCatalogItem({ ...facility, staffId: staff.id, staffRole: staff.role }, req.body)));
router.patch(`${base}/staff/catalog/:itemId`, (req, res) => staffAuth(req, res, async (staff, facility) =>
     service.updateCatalogItem({ ...facility, staffId: staff.id, staffRole: staff.role }, req.params.itemId, req.body)));
router.post(`${base}/staff/bookings/:bookingId/payment-claims/:claimId/decision`, (req, res) =>
     staffAuth(req, res, staff => {
          facilityAdmin(staff);
          return service.decidePayment(staff, req.params.bookingId, req.params.claimId, req.body);
     }));
router.post(`${base}/staff/bookings/:bookingId/decision`, (req, res) =>
     staffAuth(req, res, staff => service.decideBooking(staff, req.params.bookingId, req.body)));
router.post(`${base}/staff/bookings/:bookingId/refunds`, (req, res) =>
     staffAuth(req, res, staff => {
          facilityAdmin(staff);
          return service.recordRefund(staff, req.params.bookingId, req.body);
     }));

// Integrated-facility dashboard routes authenticate existing PLS staff sessions
// and derive the tenant from those signed claims; no browser tenantId is accepted.
router.get(`${base}/core/facilities/:slug/bookings`, requireCoreFacilityStaff,
     handle((_req, res) => service.listBookings(res.locals.marketplaceCoreStaff)));
router.get(`${base}/core/facilities/:slug/catalog`, requireCoreFacilityStaff,
     handle((_req, res) => service.listCatalog(res.locals.marketplaceCoreStaff)));
router.post(`${base}/core/facilities/:slug/bookings/:bookingId/payment-claims/:claimId/decision`,
     requireCoreFacilityStaff, requireCoreRole(['admin', 'manager', 'super-admin', 'super_admin']),
     handle((req, res) => service.decidePayment(res.locals.marketplaceCoreStaff, req.params.bookingId, req.params.claimId, req.body)));
router.post(`${base}/core/facilities/:slug/bookings/:bookingId/decision`,
     requireCoreFacilityStaff, requireCoreRole(['admin', 'manager', 'scientist', 'phelobotomist', 'phlebotomist', 'super-admin', 'super_admin']),
     handle((req, res) => {
          const staff = res.locals.marketplaceCoreStaff;
          const action = req.body?.action;
          if (['scientist', 'phelobotomist', 'phlebotomist'].includes(staff.role) &&
               !['collect', 'process', 'complete'].includes(action)) {
               throw new MarketplaceError('PLS clinical staff may update only assigned collection and processing stages', 403);
          }
          return service.decideBooking(staff, req.params.bookingId, req.body);
     }));
router.post(`${base}/core/facilities/:slug/bookings/:bookingId/refunds`,
     requireCoreFacilityStaff, requireCoreRole(['admin', 'manager', 'super-admin', 'super_admin']),
     handle((req, res) => service.recordRefund(res.locals.marketplaceCoreStaff, req.params.bookingId, req.body)));
router.post(`${base}/core/facilities/:slug/bookings/:bookingId/core-link`,
     requireCoreFacilityStaff, requireCoreRole(['admin', 'manager', 'super-admin', 'super_admin']),
     handle((req, res) => service.linkExistingCoreRecords(res.locals.marketplaceCoreStaff, req.params.bookingId, req.body)));

router.get(`${base}/platform/facilities`, requirePlatformFacilityAuthority,
     handle(req => service.listPlatformFacilities(req.query.status), ['status']));
router.post(`${base}/platform/facilities/:facilityId/approve`, requirePlatformFacilityAuthority,
     handle((req, res) => service.approveFacility(req.params.facilityId, res.locals.facilityActor)));
router.post(`${base}/platform/facilities/:facilityId/provision`, requirePlatformFacilityAuthority,
     handle((req, res) => service.provisionFacility(req.params.facilityId, req.body, res.locals.facilityActor)));
router.post(`${base}/platform/facilities/:facilityId/suspend`, requirePlatformFacilityAuthority,
     handle((req, res) => service.suspendFacility(req.params.facilityId, req.body?.reason, res.locals.facilityActor)));
router.post(`${base}/platform/facilities/:facilityId/link-tenant`, requirePlatformFacilityAuthority,
     handle((req, res) => service.linkTenant(req.params.facilityId, req.body?.tenantId, req.body?.identityConfirmed,
          req.body?.catalogMappings, res.locals.facilityActor), [], 200, true));

router.use(base, (_req, res) => res.status(404).json({ status: 'error', message: 'Marketplace endpoint not found' }));

export default router;
