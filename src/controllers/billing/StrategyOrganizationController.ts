import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { assignStrategyOrganizations } from '../../models/billing/StrategyOrganizationAssignments';
export async function assignStrategyOrganizationsHandler(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, message: 'Authentication required.' });
    const id = Number(req.params.strategyid);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ status: false, message: 'Invalid strategy ID.' });
    try { return res.json({ status: true, data: await assignStrategyOrganizations(actor.tenantId, id, req.body) }); }
    catch (error: any) { return res.status(400).json({ status: false, message: error.issues?.[0]?.message || error.message || 'Unable to assign organizations.' }); }
}
