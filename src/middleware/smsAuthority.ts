import { Request, Response, NextFunction } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed, normalizeRole } from './roles';
import { SmsCampaignService } from '../models/application/sms/SmsCampaignService';
import KnexConnection from '../database/KnexConnections';

export type SmsCapability = 'read' | 'send' | 'manage' | 'setup' | 'transactional';
export function canUseSms(role: unknown, capability: SmsCapability): boolean {
    const key = normalizeRole(role);
    if (['crm', 'receptionist', 'frontdesk', 'frontdeskofficer', 'customerrepresentative'].includes(key)) role = 'customer service representative';
    if (['billing', 'billingofficer'].includes(key)) role = 'cashier';
    const roles = capability === 'setup' ? ['admin'] : capability === 'manage' ? ['admin', 'manager'] :
        capability === 'transactional' ? ['admin', 'manager', 'customer service representative', 'cashier', 'scientist'] :
        ['admin', 'manager', 'customer service representative'];
    return roleAllowed(role, roles);
}
export function smsCapabilityFor(method: string, path: string): SmsCapability | null {
    path = path.toLowerCase();
    if (path === '/api/v1/appointment/reminder') return 'transactional';
    if (/^\/api\/v1\/(?:applicationsettings\/smsupdate|application\/sms\/create\/template\/columns)(?:\/|$)/i.test(path)) return 'setup';
    if (!/^\/api\/v1\/(?:sms(?:\/|$)|prime\/sms(?:[-/]|$))/i.test(path)) return null;
    if (/\/events\/trigger\//.test(path)) return 'transactional';
    if (/\/transaction\/result\/ready\/|\/events\/get\//.test(path)) return 'transactional';
    if (/\/failed\/transaction\/retry\//.test(path)) return 'send';
    if (/\/sms-jobs\/\d+\/reconcile$/.test(path)) return 'send';
    if (/\/sms\/events\/[^/]+\/toggle/.test(path)) return 'setup';
    if (method === 'GET') return 'read';
    if (/sms-(?:category-mappings|placeholder-rules|events|event-templates)/.test(path) || /^\/api\/v1\/sms\/events/.test(path)) return 'setup';
    if (/sms-templates/.test(path)) return 'manage';
    if (method === 'POST' && /sms-jobs(?:\/preview)?$/.test(path)) return 'send';
    return 'manage';
}
export async function smsAuthority(req: Request, res: Response, next: NextFunction) {
    const path = req.path.toLowerCase();
    const capability = smsCapabilityFor(req.method, req.path);
    if (!capability) return next();
    const actor = getAuthUser(req);
    if (!actor) return res.status(401).json({ status: false, error: 'Authentication required' });
    if (Number(req.query.tenantId) !== Number(actor.tenantId) || !canUseSms(actor.role, capability)) {
        return res.status(403).json({ status: false, error: 'You do not have permission for this SMS action' });
    }
    // Provider-derived delivery states cannot be edited through generic CRUD.
    if (req.method !== 'GET' && /\/prime\/sms-job-recipients(?:\/|$)/.test(path)) {
        return res.status(405).json({ error: 'Recipient records are managed by campaign processing and delivery reports' });
    }
    if (req.body && typeof req.body === 'object') {
        if ('createdBy' in req.body) req.body.createdBy = actor.employeeid;
        if ('employeeid' in req.body) req.body.employeeid = actor.employeeid;
    }
    try {
        const jobMatch = path.match(/\/sms-jobs\/((?!preview(?:\/|$))[^/]+)/) || path.match(/\/by-job\/([^/]+)/) || path.match(/\/retry\/([^/]+)/);
        const recipientMatch = path.match(/\/sms-job-recipients\/((?!by-job(?:\/|$))[^/]+)/);
        for (const match of [jobMatch, recipientMatch]) if (match && (!/^\d+$/.test(match[1]) || !Number.isSafeInteger(Number(match[1])) || Number(match[1]) <= 0)) {
            return res.status(400).json({ error: 'Invalid SMS document reference' });
        }
        let jobid = jobMatch ? Number(jobMatch[1]) : null;
        if (recipientMatch) {
            const db = await KnexConnection(actor.tenantId);
            const recipient = await db('primesmsjobrecipients').where({ recid: Number(recipientMatch[1]) }).first('jobid');
            if (!recipient) return res.status(404).json({ error: 'Message not found' });
            jobid = Number(recipient.jobid);
        }
        if (jobid && !(await new SmsCampaignService(actor.tenantId).find(jobid, actor))) return res.status(404).json({ error: 'Campaign not found' });
        const rawBill = req.query.billingid ?? path.match(/\/transaction\/result\/ready\/([^/]+)/)?.[1];
        if (rawBill != null && (typeof rawBill !== 'string' || !/^\d+$/.test(rawBill) || !Number.isSafeInteger(Number(rawBill)) || Number(rawBill) <= 0)) return res.status(400).json({ error: 'Invalid billing reference' });
        const billingid = Number(rawBill);
        if (capability === 'transactional' && Number.isSafeInteger(billingid) && billingid > 0) {
            const db = await KnexConnection(actor.tenantId), bill = await db('billing').where({ billingid }).first('branchid');
            if (!bill || (!roleAllowed(actor.role, ['admin']) && (actor.branch == null || Number(bill.branchid) !== Number(actor.branch)))) return res.status(404).json({ error: 'Billing record not found' });
        }
        next();
    } catch { return res.status(503).json({ error: 'Unable to verify SMS access' }); }
}
