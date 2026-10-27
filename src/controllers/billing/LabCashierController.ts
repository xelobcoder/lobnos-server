import type {Request, Response} from 'express';
import {getAuthUser} from '../../middleware/authority';
import KnexConnection from '../../database/KnexConnections';
import {lookupLabCashierCode,lookupLabCashierBill} from '../../models/billing/LabCashierWorkflow';
export async function lookupLabCashier(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({status: false, message: 'Authentication required'});
    try {
        const db = await KnexConnection(actor.tenantId);
        const ticket = req.query.billingid ? await lookupLabCashierBill(db, actor, req.query.billingid) : await lookupLabCashierCode(db, actor, req.query.code);
        if (!ticket) return res.status(404).json({status: false, message: 'No bill with this cashier code was found at your active location.'});
        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({status: true, data: ticket});
    } catch (error: any) { return res.status(400).json({status: false, message: error.message || 'Unable to find this bill'}); }
}
