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

export function requireResultDeliveryRole(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
    if (!roleAllowed(actor.role, ['admin', 'manager', 'scientist', 'sonographer', 'customer service representative'])) return res.status(403).json({ status: false, message: 'Result delivery access denied' });
    if (actor.branch == null && !roleAllowed(actor.role, ['admin', 'manager'])) return res.status(403).json({ status: false, message: 'A branch must be assigned to delivery staff' });
    return next();
}
