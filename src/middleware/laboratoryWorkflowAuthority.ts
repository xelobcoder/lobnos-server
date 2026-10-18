import { NextFunction, Request, Response } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed } from './roles';

/** Bypass configuration never confers permission or lets callers impersonate staff. */
export function requireLaboratoryWorkflowRole(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required' });
    if (Number(req.query.tenantId) !== Number(actor.tenantId) ||
        !roleAllowed(actor.role, ['admin', 'manager', 'scientist'])) {
        return res.status(403).json({ status: 'error', message: 'Laboratory workflow access denied' });
    }
    if (req.body) req.body.employeeid = actor.employeeid;
    return next();
}
