import { NextFunction, Request, Response } from 'express';
import { normalizeRole } from './roles';

export function pharmacyRouteAllowed(method: string, path: string): boolean {
     const route = path.split('?')[0].toLowerCase().replace(/\/+$/, '');
     if (method==='GET'&&['/api/v1/prime/my-roles','/api/v1/prime/staff-access'].includes(route)) return true;
     if (method==='POST'&&['/api/v1/prime/switch-role','/api/v1/prime/staff-access'].includes(route)) return true;
     if (method==='POST'&&route==='/api/v1/prime/refresh-role-session') return true;
     if (method==='POST'&&/^\/api\/v1\/prime\/staff-access\/\d+\/activation$/.test(route)) return true;
     if (['POST','DELETE'].includes(method)&&/^\/api\/v1\/prime\/staff-access\/\d+\/roles(?:\/[a-f0-9-]+)?$/.test(route)) return true;
     if (/^\/api\/v1\/(?:pharmacy|prescriptions)(?:\/|$)/.test(route)) return true;
     if (method === 'GET' && ['/api/v1/prime/validate-token', '/api/v1/settings/companyprofile/images', '/api/v1/applicationsettings', '/api/v1/branches', '/api/v1/user/permissions', '/api/v1/notifications/inbox', '/api/v1/notifications/inbox/unread-count'].includes(route)) return true;
     if (method === 'PATCH' && /^\/api\/v1\/notifications\/inbox\/\d+\/read$/.test(route)) return true;
     return method === 'POST' && ['/api/v1/logins/logout', '/api/v1/logins/reset-password', '/api/v1/prime/validate-user-pin'].includes(route);
}
/** Runs after live session authentication; pharmacy staff have no implicit lab authority. */
export function pharmacyModuleBoundary(req: Request, res: Response, next: NextFunction) {
     if (normalizeRole((req as any).authUser?.role)==='pharmacynurse' && /^\/api\/v1\/(?:consultation\/(?:capabilities|patients)|customers\/vitalsigns)(?:\/|$)/.test(req.path)) return next();
     if (normalizeRole((req as any).authUser?.role)==='pharmacydoctor' && /^\/api\/v1\/(?:consultation|records\/consul|customers\/vitalsigns)(?:\/|$)/.test(req.path)) return next();
     if (normalizeRole((req as any).authUser?.role)==='pharmacydoctor' && (req as any).practitioner && /^\/api\/v1\/(?:entityorders|billing\/(?:strategies|testpanel))/.test(req.path)) return next();
     const role=normalizeRole((req as any).authUser?.role);
     if ((role.startsWith('pharmacy')||role==='pharmacist') && !pharmacyRouteAllowed(req.method, req.originalUrl || req.path)) return res.status(403).json({ success: false, error: { code: 'MODULE_ACCESS_DENIED', message: 'Pharmacy staff may only access pharmacy and shared account services' } });
     next();
}
