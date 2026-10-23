import type { RequestHandler } from 'express';
import { getAuthUser } from './authority';
import { roleAllowed } from './roles';
export const crmManager = (actor: { role: string }) => roleAllowed(actor.role, ['admin', 'manager']);
export const requireCrmRole: RequestHandler = (req, res, next) => {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ success: false, message: 'Authentication required' });
     if (!roleAllowed(actor.role, ['admin', 'manager', 'marketer', 'customer service representative'])) return res.status(403).json({ success: false, message: 'CRM access denied' });
     if (Number(req.query.tenantId) !== Number(actor.tenantId)) return res.status(403).json({ success: false, message: 'CRM tenant mismatch' });
     if (!crmManager(actor) && actor.branch == null) return res.status(403).json({ success: false, message: 'An operating branch must be assigned to CRM staff' });
     next();
};
