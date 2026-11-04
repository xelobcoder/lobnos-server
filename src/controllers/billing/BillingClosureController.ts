import { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { withBillingClosure } from '../../models/billing/BillingFinancialGuard';

/** Reuses accounting daily-close evidence. It does not create another close workflow. */
export async function billingClosureStatus(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ message: 'Authentication required' });
    const ids = String(req.query.billingids || '').split(',').map(Number);
    if (!ids.length || ids.length > 200 || ids.some(n => !Number.isSafeInteger(n) || n <= 0))
        return res.status(400).json({ message: 'Select 1–200 billing IDs' });
    const db = await KnexConnection(actor.tenantId);
    const bills = await db('billing').whereIn('billingid', ids).where({ branchid: actor.branch });
    const rows = await withBillingClosure(db, bills);
    return res.json({ data: rows.map(b => ({ billingid: b.billingid, closed_status: b.closed_status, closure_evidence: b.closure_evidence })) });
}
