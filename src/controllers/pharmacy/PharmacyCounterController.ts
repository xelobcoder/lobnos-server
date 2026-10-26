import { Request, Response, NextFunction } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { PharmacyCounterWorkflow, pharmacyCheckoutMode, counterCashierRoles, counterDispensingRoles } from '../../models/pharmacy/PharmacyCounterWorkflow';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { branchOf, tenantOf, actorOf } from './pharmacyContext';
export const counterAccess = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => roleAllowed(getAuthUser(req)?.role, roles) ? next() : res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have authority for this counter action' } });
export const counterDispensingAccess = counterAccess(counterDispensingRoles), counterPaymentAccess = counterAccess(counterCashierRoles), counterReadAccess = counterAccess([...counterDispensingRoles, ...counterCashierRoles]);
export const counterOperation = (work: (s: PharmacyCounterWorkflow, r: Request) => Promise<any>) => async (req: Request, res: Response) => { try {
    const db = await KnexConnection(tenantOf(req));
    const service = new PharmacyCounterWorkflow(db, getAuthUser(req), tenantOf(req));
    res.json({ success: true, data: await work(service, req) });
}
catch (e: any) {
    const uncertain = typeof e.code === 'string';
    res.status(uncertain ? 503 : 400).json({ success: false, error: { code: uncertain ? 'PHARMACY_OPERATION_UNCONFIRMED' : 'PHARMACY_OPERATION_REJECTED', message: uncertain ? 'The counter operation could not be confirmed. Retry the original request.' : e.message } });
} };
export async function directCheckoutOnly(req: Request, res: Response, next: NextFunction) { try {
    const db = await KnexConnection(tenantOf(req));
    if (await pharmacyCheckoutMode(db, branchOf(req)!) === 'separate_cashier') {
        const existing = req.body.idempotencyKey ? await db('pharmacy_sales').where({ idempotency_key: req.body.idempotencyKey, branchid: branchOf(req), cashier_id: actorOf(req) }).first() : null;
        if (!existing)
            return res.status(400).json({ success: false, error: { code: 'SALE_REJECTED', message: 'Create a counter invoice and pay it at the cashier in separate-cashier mode' } });
    }
    next();
}
catch {
    res.status(503).json({ success: false, error: { code: 'SALE_UNCONFIRMED', message: 'Checkout mode could not be confirmed. Retry the original request.' } });
} }
