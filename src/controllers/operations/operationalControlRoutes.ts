import { Router } from 'express';
import { z } from 'zod';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { requireLaboratoryWorkflowRole } from '../../middleware/laboratoryWorkflowAuthority';
import { CriticalActionService, controlAudit } from '../../models/operations/CriticalActionService';
import { OutsourceWorkflowService } from '../../models/operations/OutsourceWorkflowService';
import { controlsFail, labSupervisor } from '../../models/operations/LabAccessPolicy';

const router = Router(); router.use(requireLaboratoryWorkflowRole);
router.use((req, res, next) => { const actor = getAuthUser(req)!; if (actor.branch == null && !labSupervisor(actor)) return res.status(403).json({ success: false, message: 'An operating branch is required' }); next(); });
const run = (operation: (db: any, actor: any, req: any) => Promise<any>) => async (req: any, res: any) => {
     try { const actor = getAuthUser(req)!; res.json({ success: true, data: await operation(await KnexConnection(actor.tenantId), actor, req) }); }
     catch (error: any) { const status = error.name === 'ZodError' ? 400 : Number(error.statusCode) || 500; res.status(status).json({ success: false, message: status === 500 ? 'Laboratory control operation failed' : error.name === 'ZodError' ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') : error.message }); }
};
router.get('/settings', run(async (db, actor) => ({ ...(await db('lab_access_settings').where({ id: 1 }).first()), can_manage: labSupervisor(actor) })));
router.put('/settings', run(async (db, actor, req) => {
     if (!labSupervisor(actor)) return controlsFail('Only supervisors can change laboratory access settings', 403);
     const data = z.object({ visibility: z.enum(['team', 'restricted']), editing: z.enum(['team', 'assigned']), allow_claim: z.boolean(), version: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) }).parse(req.body);
     return db.transaction(async (trx: any) => {
          const old = await trx('lab_access_settings').where({ id: 1 }).forUpdate().first();
          if (Number(old.version) !== data.version) return controlsFail('Settings changed. Reload before saving.', 409);
          const { reason, ...values } = data;
          await trx('lab_access_settings').where({ id: 1 }).update({ ...values, version: data.version + 1, updated_by: actor.employeeid, updated_at: new Date() });
          await controlAudit(trx, actor.employeeid, 'lab_access', 1, 'updated', reason, { before: old, after: values }); return { version: data.version + 1 };
     });
}));
router.get('/tests/:id/critical-policies', run((db, actor, req) => new CriticalActionService(db).policies(actor, Number(req.params.id))));
router.put('/tests/:id/critical-policies/:ruleId', run((db, actor, req) => new CriticalActionService(db).savePolicy(actor, Number(req.params.id), Number(req.params.ruleId), req.body)));
router.get('/critical', run((db, actor, req) => new CriticalActionService(db).list(actor, req.query)));
router.get('/critical/legacy/:id', run(async (db, actor, req) => { const event = await db('lab_critical_events').where({ legacy_alert_id: Number(req.params.id) }).first(); if (!event) return controlsFail('Critical event not found', 404); return new CriticalActionService(db).detail(actor, event.id); }));
router.get('/critical/:id', run((db, actor, req) => new CriticalActionService(db).detail(actor, Number(req.params.id))));
router.post('/critical/:id/actions', run((db, actor, req) => new CriticalActionService(db).act(actor, Number(req.params.id), req.body)));
router.get('/providers', run((db) => new OutsourceWorkflowService(db).providerOptions()));
router.get('/tests/:id/providers', run((db, _actor, req) => new OutsourceWorkflowService(db).providers(Number(req.params.id))));
router.put('/tests/:id/providers', run((db, actor, req) => new OutsourceWorkflowService(db).saveProviders(actor, Number(req.params.id), req.body)));
router.get('/outsourcing', run((db, actor, req) => new OutsourceWorkflowService(db).list(actor, req.query)));
router.get('/outsourcing/:id', run((db, actor, req) => new OutsourceWorkflowService(db).detail(actor, Number(req.params.id))));
router.post('/outsourcing/:id/transition', run((db, actor, req) => new OutsourceWorkflowService(db).transition(actor, Number(req.params.id), req.body)));
router.post('/outsourcing/:id/reports', run((db, actor, req) => new OutsourceWorkflowService(db).upload(actor, Number(req.params.id), req.body)));
router.get('/outsourcing/:id/reports/:reportId', async (req, res) => {
     try {
          const actor = getAuthUser(req)!; const report = await new OutsourceWorkflowService(await KnexConnection(actor.tenantId)).download(actor, Number(req.params.id), Number(req.params.reportId));
          res.setHeader('Cache-Control', 'no-store');
          if (req.query.encoding === 'base64') return res.json({ success: true, data: { filename: report.filename, mime: report.mime, base64: Buffer.from(report.content).toString('base64') } });
          res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${String(report.filename).replace(/[^a-zA-Z0-9._ -]/g, '_')}"`);
          res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.send(report.content);
     } catch (error: any) { res.status(Number(error.statusCode) || 500).json({ success: false, message: Number(error.statusCode) ? error.message : 'Report download failed' }); }
});
export default router;
