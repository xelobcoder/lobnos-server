import type { Request, Response, NextFunction } from 'express';
import { getAuthUser } from './authority';
import path from 'node:path';

/** Decode before matching, so encoded path segments cannot bypass the public-file boundary. */
export function blockPublicExpenseReceipts(req: Request, res: Response, next: NextFunction) {
     try {
          const pathname = path.posix.normalize(decodeURIComponent(req.path).replace(/\\/g, '/')).toLowerCase();
          if (/^\/uploads\/expenses\/receipts(?:\/|$)/.test(pathname)) return res.status(404).end();
          next();
     } catch { res.status(400).end(); }
}

/** Bind legacy expense handlers to the authenticated principal before reading their input. */
export function bindExpenseIdentity(req: Request, res: Response, next: NextFunction) {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ message: 'Authentication required' });
     req.query.employeeid = String(actor.employeeid);
     req.query.tenantId = String(actor.tenantId);
     const analytics = String(req.originalUrl || req.path || '').includes('/expenses/analytics/');
     const admin = ['admin', 'superadmin'].includes(String(actor.role).toLowerCase().replace(/[ _-]/g, ''));
     if (actor.branch != null && !(analytics && admin && req.query.branchid)) req.query.branchid = String(actor.branch);
     if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
          req.body.employeeid = actor.employeeid;
          req.body.tenantId = actor.tenantId;
          if (actor.branch != null) req.body.branchid = actor.branch;
     }
     next();
}
