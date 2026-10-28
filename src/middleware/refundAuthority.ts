import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed } from './roles';
import KnexConnection from '../database/KnexConnections';

/** Resolve the refund document and actor before any witness/approval/payment mutation. */
export async function requireRefundActor(req: Request, res: Response, next: NextFunction) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, message: 'Authentication required' });
    if (Number(req.query.tenantId) !== Number(actor.tenantId) || !roleAllowed(actor.role,
        ['admin', 'manager', 'accountant', 'cashier', 'customer service representative', 'scientist'])) {
        return res.status(403).json({ status: false, message: 'Refund access denied' });
    }
    const rawService = req.body?.serviceid ?? req.query.serviceid;
    const rawBill = req.body?.billingid ?? req.params.billingid ?? req.query.billingid;
    const canonicalId = (value: unknown) => (typeof value === 'number' ||
        (typeof value === 'string' && /^\d+$/.test(value))) ? Number(value) : NaN;
    const serviceid = canonicalId(rawService);
    const billingid = canonicalId(rawBill);
    const hasService = Number.isSafeInteger(serviceid) && serviceid > 0;
    const hasBill = Number.isSafeInteger(billingid) && billingid > 0;
    if ((rawService != null && !hasService) || (rawBill != null && !hasBill)) {
        return res.status(400).json({ status: false, message: 'Invalid refund document ID' });
    }
    if (!hasService && !hasBill) return res.status(400).json({ status: false, message: 'A valid refund document is required' });
    try {
        const db = await KnexConnection(actor.tenantId);
        let query = hasService ? db('dboservices as s').join('billing as b', 'b.billingid', 's.billingid')
            .where('s.serviceid', serviceid).select('b.branchid', 'b.billingid') :
            db('billing as b').where('b.billingid', billingid).select('b.branchid', 'b.billingid');
        if (hasService && hasBill) query = query.where('b.billingid', billingid);
        const document = await query.first();
        if (!document) return res.status(404).json({ status: false, message: 'Refund document not found' });
        if (!roleAllowed(actor.role, ['admin']) &&
            (actor.branch == null || Number(document.branchid) !== Number(actor.branch))) {
            return res.status(403).json({ status: false, message: 'Refund document is outside your branch' });
        }
        if (req.body) {
            req.body.employeeid = actor.employeeid;
            req.body.billingid = Number(document.billingid);
            if (hasService) req.body.serviceid = serviceid;
            if (Array.isArray(req.body.witnesses)) {
                req.body.witnesses = req.body.witnesses.map((witness: any) => ({ ...witness, employeeid: actor.employeeid }));
            }
        }
        if ('employeeid' in req.params) req.params.employeeid = String(actor.employeeid);
        next();
    } catch {
        return res.status(500).json({ status: false, message: 'Unable to verify refund access' });
    }
}
