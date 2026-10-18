import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { PatientPortalError } from '../../models/patient-portal/PatientPortalAccountService';
import { PatientBillingRequestService } from '../../models/patient-portal/PatientBillingRequestService';
import { createRateLimiter } from '../../middleware/rateLimiter';

export const BILLING_REQUEST_ROLES = ['admin', 'manager', 'receptionist', 'customer service representative', 'cashier', 'accountant'];

/** Guard dependencies avoid circular imports with the parent portal router. */
export function createBillingRequestsRouter(requirePatient: RequestHandler, requireStaff: RequestHandler) {
     const router = Router();
     router.use((req, res, next) => {
          res.setHeader('Cache-Control', 'no-store');
          const tenantId = Number(getAuthUser(req)?.tenantId);
          if (!Number.isSafeInteger(tenantId) || tenantId <= 0) {
               return res.status(403).json({ status: 'error', message: 'Authenticated facility required.' });
          }
          // The shared patient guard also uses tenantOf(req); bind it to the verified session.
          req.query.tenantId = String(tenantId);
          next();
     });
     const service = (req: Request) => {
          const tenantId = Number(getAuthUser(req)?.tenantId);
          if (!Number.isSafeInteger(tenantId) || tenantId <= 0) throw new PatientPortalError('Authenticated facility required.', 403);
          return new PatientBillingRequestService(tenantId);
     };
     const id = (value: unknown) => {
          const parsed = Number(value);
          if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new PatientPortalError('Invalid request identifier.', 400);
          return parsed;
     };
     const page = (req: Request) => Math.min(10000, Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1));
     const handle = (fn: (req: Request) => Promise<unknown>, raw = false): RequestHandler =>
          async (req: Request, res: Response, _next: NextFunction) => {
               try {
                    const data = await fn(req);
                    return res.json(raw ? data : { status: 'success', statusCode: 200, data });
               } catch (error) {
                    if (error instanceof PatientPortalError) {
                         return res.status(error.statusCode).json({ status: 'error', message: error.message, code: error.code });
                    }
                    // Never forward SQL, patient payloads or provider errors.
                    return res.status(500).json({ status: 'error', message: 'Unable to process the billing request. Please retry.' });
               }
          };
     const patientid = (req: Request) => id((req as any).authUser?.patientid);
     router.get('/billing-requests/catalog', requirePatient, handle(req => service(req).catalog()));
     router.get('/billing-requests', requirePatient, handle(req => service(req).list(patientid(req), page(req))));
     router.post('/billing-requests', requirePatient, createRateLimiter({ windowMs: 60_000, max: 10 }),
          handle(req => service(req).create(patientid(req), req.body || {})));
     router.get('/admin/billing-requests', requireStaff, handle(req => service(req).list(undefined, page(req))));
     router.get('/admin/billing-requests/:id', requireStaff, handle(req => service(req).detail(id(req.params.id))));
     router.post('/admin/billing-requests/:id/reject', requireStaff,
          handle(req => service(req).reject(id(req.params.id), id(getAuthUser(req)?.employeeid), req.body?.note)));
     router.post('/admin/billing-requests/:id/convert', requireStaff,
          handle(req => service(req).convert(id(req.params.id), id(getAuthUser(req)?.employeeid),
               Number(getAuthUser(req)?.branch), req.body || {}), true));
     return router;
}
