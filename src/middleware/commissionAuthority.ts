import type { Request, Response, NextFunction } from 'express';
import { getAuthUser, requireAuthority } from './authority';
import KnexConnection from '../database/KnexConnections';
import type { AuthUser } from './authority';
import { AuthorityService } from '../accountingModule/services/AuthorityService';

export async function assertCommissionServiceBranch(actor: AuthUser, serviceId: number) {
     const db = await KnexConnection(actor.tenantId);
     const service = await db('dboservices as service').join('billing as bill', 'bill.billingid', 'service.billingid').where('service.serviceid', serviceId).select('bill.branchid').first();
     if (!service || actor.branch == null || Number(service.branchid) !== actor.branch) throw Object.assign(new Error('Commission service is outside your operating branch'), { statusCode: 403 });
}

/** Commission configuration is tenant-wide; payment operations are scoped to the operating branch. */
export function bindCommissionActor(req: Request, res: Response, next: NextFunction) {
     const actor = getAuthUser(req);
     if (!actor || ['clinician', 'patient'].includes(String(actor.role).toLowerCase())) return res.status(403).json({ status: false, message: 'An authenticated staff session is required' });
     req.query.tenantId = String(actor.tenantId);
     req.query.employeeid = String(actor.employeeid);
     if (actor.branch != null) req.query.branchid = String(actor.branch);
     if (req.body && !Array.isArray(req.body)) Object.assign(req.body, { tenantId: actor.tenantId, employeeid: actor.employeeid, employeeId: actor.employeeid, created_by: actor.employeeid, updated_by: actor.employeeid, ...(actor.branch == null ? {} : { branchid: actor.branch }) });
     next();
}
export const commissionAccess = async (req: Request, res: Response, next: NextFunction) => {
     try {
          const actor = getAuthUser(req)!;
          if (req.method !== 'GET' && /^\/(?:configs|assignments|defaults)(?:\/|$)/.test(req.path)) {
               const permission = await new AuthorityService(actor.tenantId).can(actor.employeeid, 'expense.configure', null, null);
               if (!permission.allowed) throw Object.assign(new Error('Commission configuration requires facility-wide configuration authority'), { statusCode: 403 });
          }
          const record = req.path.match(/^\/tracking\/(\d+)(?:\/|$)/), service = req.path.match(/^\/tracking\/service\/(\d+)$/);
          if (record) {
               const db = await KnexConnection(actor.tenantId);
               const tracking = await db('commission_tracking').where({ id: Number(record[1]) }).first();
               if (!tracking) throw Object.assign(new Error('Tracking record not found'), { statusCode: 404 });
               await assertCommissionServiceBranch(actor, Number(tracking.service_id));
          } else if (service) await assertCommissionServiceBranch(actor, Number(service[1]));
          else if (req.method === 'GET' && /^\/(?:analytics|tracking|commission-tracking)(?:\/|$)/.test(req.path)) {
               const global = await new AuthorityService(actor.tenantId).can(actor.employeeid, 'expense.view_audit', null, null);
               if (!global.allowed) throw Object.assign(new Error('Global commission reports require facility-wide audit authority'), { statusCode: 403 });
          }
          return requireAuthority(req.method === 'GET' ? 'expense.view_audit' : req.path.includes('process-services') ? 'expense.create' : 'expense.configure')(req, res, next);
     } catch (error: any) { return res.status(error.statusCode || 403).json({ status: false, message: error.message }); }
};
