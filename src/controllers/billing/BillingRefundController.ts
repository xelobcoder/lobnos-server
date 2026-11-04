import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { BillingRefundService } from '../../models/billing/BillingRefundService';
import KnexConnection from '../../database/KnexConnections';
import { billingRefundQuote } from '../../models/billing/BillingRefundQuote';
export async function refundQuoteBillingGet(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ message: 'Authentication required' });
    const billingid = Number(req.query.billingid);
    if (!Number.isSafeInteger(billingid) || billingid <= 0) return res.status(400).json({ message: 'Invalid billing ID' });
    try { return res.json({ data: await billingRefundQuote(await KnexConnection(actor.tenantId), billingid, actor.branch) }); }
    catch { return res.status(409).json({ message: 'Unable to quote remaining refund for this sale' }); }
}
export async function refundAllBillingPost(req: Request, res: Response) {
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false });
    try {
        const status = await new BillingRefundService(actor.tenantId).refund({ billingid: req.body.billingid,
            employeeid: actor.employeeid, selectedPaymentMode: req.body.selectedPaymentMode,
            request_key: req.body.request_key, all: true, reason: req.body.reason, branchid: actor.branch });
        return res.json({ status });
    } catch { return res.status(409).json({ status: false, message: 'Refund rejected. Check source sale, remaining balance, approval and request key.' }); }
}
