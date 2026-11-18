import { NextFunction, Request, Response } from 'express';
import { getAuthUser } from './authority';
import { normalizeRole, roleAllowed } from './roles';
import KnexConnection from '../database/KnexConnections';

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

/** Sonographers may save only ultrasound results through the shared result-entry endpoint. */
export async function requireResultEntryRole(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required' });
    if (Number(req.query.tenantId) !== Number(actor.tenantId)) {
        return res.status(403).json({ status: 'error', message: 'Laboratory workflow access denied' });
    }
    if (normalizeRole(actor.role) !== 'sonographer') {
        return requireLaboratoryWorkflowRole(req, res, next);
    }

    const testid = Number(req.body?.testid);
    const ascensionid = Number(req.body?.ascensionid ?? req.body?.ascensionId);
    if (![testid, ascensionid].every(id => Number.isSafeInteger(id) && id > 0)) {
        return res.status(400).json({ status: 'error', message: 'A valid ultrasound test and ordered test are required' });
    }

    try {
        const db = await KnexConnection(actor.tenantId);
        const order = await db('test_ascension as ta')
            .join('billing as bill', 'bill.billingid', 'ta.billingid')
            .join('test_panels as panel', 'panel.id', 'ta.testid')
            .join('departments as department', 'department.id', 'panel.category')
            .where({ 'ta.id': ascensionid, 'ta.testid': testid })
            .whereRaw("LOWER(TRIM(department.department)) = 'ultrasound'")
            .select('bill.branchid')
            .first();
        if (!order || actor.branch == null || Number(order.branchid) !== Number(actor.branch)) {
            return res.status(403).json({ status: 'error', message: 'Imaging workflow access denied' });
        }
        req.body.employeeid = actor.employeeid;
        return next();
    } catch (error) {
        return next(error);
    }
}

export function requireResultDeliveryRole(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
    if (!roleAllowed(actor.role, ['admin', 'manager', 'scientist', 'sonographer', 'customer service representative'])) return res.status(403).json({ status: false, message: 'Result delivery access denied' });
    if (actor.branch == null && !roleAllowed(actor.role, ['admin', 'manager'])) return res.status(403).json({ status: false, message: 'A branch must be assigned to delivery staff' });
    return next();
}
