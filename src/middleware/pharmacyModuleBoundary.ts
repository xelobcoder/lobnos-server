import { NextFunction, Request, Response } from 'express';
import { normalizeRole } from './roles';

export function pharmacyRouteAllowed(method: string, path: string): boolean {
     const route = path.split('?')[0].toLowerCase().replace(/\/+$/, '');
     if (/^\/api\/v1\/(?:pharmacy|prescriptions)(?:\/|$)/.test(route)) return true;
     if (method === 'GET' && ['/api/v1/prime/validate-token', '/api/v1/settings/companyprofile/images', '/api/v1/applicationsettings', '/api/v1/branches', '/api/v1/user/permissions', '/api/v1/notifications/inbox', '/api/v1/notifications/inbox/unread-count'].includes(route)) return true;
     if (method === 'PATCH' && /^\/api\/v1\/notifications\/inbox\/\d+\/read$/.test(route)) return true;
     return method === 'POST' && ['/api/v1/logins/logout', '/api/v1/logins/reset-password', '/api/v1/prime/validate-user-pin'].includes(route);
}
/** Runs after live session authentication; pharmacy staff have no implicit lab authority. */
export function pharmacyModuleBoundary(req: Request, res: Response, next: NextFunction) {
     if (normalizeRole((req as any).authUser?.role).startsWith('pharmacy') && !pharmacyRouteAllowed(req.method, req.originalUrl || req.path)) return res.status(403).json({ success: false, error: { code: 'MODULE_ACCESS_DENIED', message: 'Pharmacy staff may only access pharmacy and shared account services' } });
     next();
}
