import { ErrorRequestHandler, json, NextFunction, Request, RequestHandler, Response, Router } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { checkTokenExists } from '../../middleware/validateTenancy';
import logger from '../../hooks/logger';
import { requireOperationalLicense } from '../../licensing/enforcement';
import { LicenseError } from '../../licensing/certificate';
import { resolveQueueFacility, WalkInQueueError, WalkInQueueService } from '../../models/queue/WalkInQueueService';

export const QUEUE_STAFF_ROLES = ['admin', 'manager', 'receptionist', 'customer service representative', 'cashier', 'accountant',
     'scientist', 'phlebotomist', 'phelobotomist', 'nurse'];

/** A bounded per-process limiter. Kiosk bursts are allowed; rotating paths cannot grow its map. */
export function createQueueRateLimiter(max: number, windowMs = 60_000): RequestHandler & { reset: () => void } {
     const buckets = new Map<string, { count: number; resetAt: number }>();
     const limiter = (req: Request, res: Response, next: NextFunction) => {
          const now = Date.now();
          const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
          const current = buckets.get(key);
          if (current && current.resetAt > now) {
               current.count += 1;
               if (current.count > max) {
                    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
                    return res.status(429).json({ status: 'error', message: 'Too many check-in requests. Please wait a minute and retry.' });
               }
          } else {
               if (buckets.size >= 5000) for (const [address, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(address);
               if (buckets.size >= 5000 && !buckets.has(key)) return res.status(429).json({ status: 'error', message: 'Check-in is busy. Please retry shortly.' });
               buckets.set(key, { count: 1, resetAt: now + windowMs });
          }
          return next();
     };
     limiter.reset = () => buckets.clear();
     return limiter;
}

const headers: RequestHandler = (_req, res, next) => {
     res.setHeader('Cache-Control', 'no-store');
     res.setHeader('X-Content-Type-Options', 'nosniff');
     next();
};
const bodyTypeAndSize: RequestHandler = (req, res, next) => {
     const length = Number(req.headers['content-length'] || 0);
     if (length > 8192) { res.status(413).json({ status: 'error', message: 'Check-in request is too large' }); return; }
     const hasBody = length > 0 || Boolean(req.headers['transfer-encoding']);
     if ((req.method === 'POST' || hasBody) && !req.is('application/json')) {
          res.status(415).json({ status: 'error', message: 'Check-in requests must use JSON' }); return;
     }
     next();
};
export const queuePublicBodyError: ErrorRequestHandler = (error, _req, res, next) => {
     if (error?.type === 'entity.too.large') { res.status(413).json({ status: 'error', message: 'Check-in request is too large' }); return; }
     if (error instanceof SyntaxError) { res.status(400).json({ status: 'error', message: 'Invalid check-in request' }); return; }
     next(error);
};
/** Mount this before larger general JSON/urlencoded parsers so no content type bypasses the limit. */
export const queuePublicBodyBoundary: Array<RequestHandler | ErrorRequestHandler> = [
     headers, bodyTypeAndSize, json({ limit: '8kb', strict: true }), queuePublicBodyError,
];
function handle(operation: (req: Request) => Promise<unknown>, status = 200): RequestHandler {
     return async (req, res) => {
          try { res.status(status).json({ status: 'success', data: await operation(req) }); }
          catch (error) {
               if (error instanceof WalkInQueueError) { res.status(error.statusCode).json({ status: 'error', message: error.message }); return; }
               if (error instanceof LicenseError) { res.status(error.statusCode).json({ status: 'error', message: 'Facility check-in is currently unavailable. Please speak to reception.' }); return; }
               logger.error('Walk-in queue operation unavailable');
               res.status(503).json({ status: 'error', message: 'The queue is temporarily unavailable. Please retry or speak to reception.' });
          }
     };
}

export function requireQueueRole(roles = QUEUE_STAFF_ROLES): RequestHandler {
     return (req, res, next) => {
          const actor = getAuthUser(req);
          if (!actor || !Number.isSafeInteger(Number(actor.tenantId)) || Number(actor.tenantId) <= 0 ||
               req.query.tenantId !== undefined && Number(req.query.tenantId) !== Number(actor.tenantId)) {
               res.status(401).json({ status: 'error', message: 'An authenticated facility session is required' }); return;
          }
          if (!roleAllowed(actor.role, roles)) { res.status(403).json({ status: 'error', message: 'You do not have access to the reception queue' }); return; }
          next();
     };
}

const staffService = (req: Request) => new WalkInQueueService(getAuthUser(req)!.tenantId);
export const walkInQueueRouter = Router();
walkInQueueRouter.use(headers, checkTokenExists, requireQueueRole());
walkInQueueRouter.get('/tickets', handle(req => staffService(req).list(req.query.date)));
walkInQueueRouter.patch('/tickets/:id', handle(req => staffService(req).update(req.params.id, req.body, getAuthUser(req)!.employeeid)));
walkInQueueRouter.get('/settings', handle(req => staffService(req).getSettings()));
walkInQueueRouter.put('/settings', requireQueueRole(['admin', 'manager']), handle(req => staffService(req).updateSettings(req.body, getAuthUser(req)!.employeeid)));

export const publicWalkInQueueRouter = Router();
const publicBase = '/api/v1/public/queue';
publicWalkInQueueRouter.use(publicBase, headers, (req, res, next) => {
     if (Object.keys(req.query).length) { res.status(400).json({ status: 'error', message: 'Public check-in does not accept tenant parameters' }); return; }
     next();
});
const publicOperation = (operation: (service: WalkInQueueService, req: Request, facility: { slug: string; name: string }) => Promise<unknown>) =>
     handle(async req => {
          const facility = await resolveQueueFacility(req.params.slug);
          // The public slug, rather than a query parameter or the control tenant, owns licensing.
          await requireOperationalLicense(facility.tenantId);
          return operation(new WalkInQueueService(facility.tenantId), req, { slug: facility.slug, name: facility.name });
     });
publicWalkInQueueRouter.get(`${publicBase}/:slug/config`, createQueueRateLimiter(180), publicOperation((service, _req, facility) => service.publicConfig(facility)));
publicWalkInQueueRouter.post(`${publicBase}/:slug/tickets`, createQueueRateLimiter(40), json({ limit: '8kb', strict: true }), publicOperation((service, req) => service.join(req.body)));
publicWalkInQueueRouter.get(`${publicBase}/:slug/display`, createQueueRateLimiter(180), publicOperation((service, _req, facility) => service.list(undefined, false, facility)));
// Terminate the namespace before generic tenant resolution and private authentication middleware.
publicWalkInQueueRouter.use(publicBase, (_req, res) => { res.status(404).json({ status: 'error', message: 'Queue endpoint not found' }); });
publicWalkInQueueRouter.use(queuePublicBodyError);
