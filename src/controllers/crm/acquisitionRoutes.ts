import { crmReminderInbox } from '../../models/crm/CrmReminderService';
import { CrmWorkflowService } from '../../models/crm/CrmWorkflowService';
import { Router } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { requireCrmRole } from '../../middleware/crmAuthority';
import { CrmService } from '../../models/crm/CrmService';
import { ReferralPerformance } from '../../models/crm/ReferralPerformance';
export const crmAction = (operation: (service: CrmService, actor: any, req: any) => Promise<any>) => async (req: any, res: any) => {
     try { const actor = getAuthUser(req)!; res.json({ success: true, data: await operation(new CrmService(actor.tenantId), actor, req) }); }
     catch (error: any) { const status = error.name === 'ZodError' ? 400 : error.code === 'ER_DUP_ENTRY' ? 409 : Number(error.statusCode) || 500;
          res.status(status).json({ success: false, statusCode: status, message: status === 500 ? 'CRM operation failed' : error.code === 'ER_DUP_ENTRY' ? 'A matching CRM record already exists. Refresh before retrying.' : error.name === 'ZodError' ? error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join('; ') : error.message }); }
};
const router = Router(); router.use(requireCrmRole);
router.get('/reminders', crmAction((_service, actor) => crmReminderInbox(actor.tenantId, actor)));
router.get('/options', crmAction((service, actor, req) => service.options(actor, req.query.search)));
router.get('/performance', crmAction((_service, actor, req) => new ReferralPerformance(actor.tenantId).report(actor, req.query)));
router.get('/prospects', crmAction((service, actor, req) => service.list(actor, req.query)));
router.post('/prospects', crmAction((service, actor, req) => service.save(actor, req.body)));
router.get('/prospects/:id', crmAction((service, actor, req) => service.detail(actor, Number(req.params.id))));
router.patch('/prospects/:id', crmAction((service, actor, req) => service.save(actor, req.body, Number(req.params.id))));
router.delete('/prospects/:id', crmAction((service, actor, req) => service.archive(actor, Number(req.params.id))));
router.post('/prospects/:id/link', crmAction((service, actor, req) => service.link(actor, Number(req.params.id), req.body)));
router.post('/prospects/:id/proposals', crmAction((service, actor, req) => service.propose(actor, Number(req.params.id), req.body)));
router.post('/prospects/:id/proposals/:proposalId/review', crmAction((service, actor, req) => service.reviewProposal(actor, Number(req.params.id), Number(req.params.proposalId), req.body)));
router.post('/prospects/:id/onboarding', crmAction((_service, actor, req) => new CrmWorkflowService(actor.tenantId).onboarding(actor, Number(req.params.id), req.body)));
router.post('/prospects/:id/preview', crmAction((_service, actor, req) => new CrmWorkflowService(actor.tenantId).preview(actor, Number(req.params.id), req.body)));
router.post('/prospects/:id/proposals/:proposalId/amend', crmAction((_service, actor, req) => new CrmWorkflowService(actor.tenantId).amend(actor, Number(req.params.id), Number(req.params.proposalId), req.body)));
router.get('/prospects/:id/history', crmAction((_service, actor, req) => new CrmWorkflowService(actor.tenantId).history(actor, Number(req.params.id), req.query)));
router.get('/prospects/:id/reconciliation', crmAction((_service, actor, req) => new CrmWorkflowService(actor.tenantId).reconciliation(actor, Number(req.params.id))));
router.get('/followups', crmAction((service, actor, req) => service.followups(actor, req.query)));
router.post('/followups', crmAction((service, actor, req) => service.saveFollowup(actor, req.body)));
router.patch('/followups/:id', crmAction((service, actor, req) => service.saveFollowup(actor, req.body, Number(req.params.id))));
export default router;
