import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from './authority';
import { normalizeRole, roleAllowed } from './roles';

export const PACKAGE_MANAGERS = ['admin', 'manager'];
export function packageAuthority(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, message: 'Authentication required.' });
    if (!actor.role || ['patient', 'clinician', 'organization', 'outsourced'].includes(normalizeRole(actor.role))) {
        return res.status(403).json({ status: false, message: 'A staff account is required to view package configuration.' });
    }
    // Billing's package lookup is a read operation despite using POST.
    const lookup = req.method === 'POST' && req.originalUrl.split('?')[0].replace(/\/$/, '') === '/api/v1/packages/billing/verify/load';
    if (!['GET', 'HEAD'].includes(req.method) && !lookup && !roleAllowed(actor.role, PACKAGE_MANAGERS)) {
        return res.status(403).json({ status: false, message: 'Only administrators and managers may change packages.' });
    }
    return next();
}
