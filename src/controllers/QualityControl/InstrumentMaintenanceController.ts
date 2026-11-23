import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { InstrumentMaintenanceService } from '../../models/QualityControl/InstrumentMaintenanceService';
import { MaintenanceTaskService } from '../../models/QualityControl/MaintenanceTaskService';

function context(req: Request) {
     const actor = getAuthUser(req);
     if (!actor || Number(req.query.tenantId) !== Number(actor.tenantId)) {
          throw Object.assign(new Error('Authenticated tenant context is required'), { statusCode: 403 });
     }
     return { actor, service: new InstrumentMaintenanceService(Number(actor.tenantId)) };
}
function sendError(res: Response, error: any) {
     return res.status(Number(error?.statusCode) || 500).json({ status: 'error', message: error?.message || 'Instrument maintenance request failed', code: error?.code });
}
export function requireMaintenanceSupervisor(req: Request, res: Response, next: () => void) {
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ status: 'error', message: 'Authentication required' });
     if (Number(req.query.tenantId) !== Number(actor.tenantId) || !roleAllowed(actor.role, ['admin', 'manager'])) {
          return res.status(403).json({ status: 'error', message: 'Supervisor access required' });
     }
     return next();
}

export class InstrumentMaintenanceController {
     async plansAndTasks(req: Request, res: Response) {
          try { const { actor } = context(req); return res.json(await new MaintenanceTaskService(Number(actor.tenantId)).list()); }
          catch (error) { return sendError(res, error); }
     }
     async savePlan(req: Request, res: Response) {
          try {
               const { actor } = context(req);
               return res.json(await new MaintenanceTaskService(Number(actor.tenantId)).savePlan(req.body, actor.employeeid, req.params.planId ? Number(req.params.planId) : undefined));
          } catch (error) { return sendError(res, error); }
     }
     async completeTask(req: Request, res: Response) {
          try { const { actor } = context(req); return res.json(await new MaintenanceTaskService(Number(actor.tenantId)).completeTask(Number(req.params.taskId), req.body, actor.employeeid)); }
          catch (error) { return sendError(res, error); }
     }
     async saveDraft(req: Request, res: Response) {
          try { const { actor } = context(req); return res.json(await new MaintenanceTaskService(Number(actor.tenantId)).saveDraft(Number(req.params.taskId), req.body, actor.employeeid)); }
          catch (error) { return sendError(res, error); }
     }
     async checklist(req: Request, res: Response) {
          try { const { service } = context(req); return res.json(await service.listChecklist()); }
          catch (error) { return sendError(res, error); }
     }
     async saveChecklist(req: Request, res: Response) {
          try { const { actor, service } = context(req); return res.status(201).json(await service.saveChecklistItem(req.body, actor.employeeid, req.params.id ? Number(req.params.id) : undefined)); }
          catch (error) { return sendError(res, error); }
     }
     async setSchedule(req: Request, res: Response) {
          try { const { actor, service } = context(req); return res.json(await service.setSchedule(String(req.params.deviceId), req.body, actor.employeeid)); }
          catch (error) { return sendError(res, error); }
     }
     async dashboard(req: Request, res: Response) {
          try { const { service } = context(req); return res.json(await service.dashboard()); }
          catch (error) { return sendError(res, error); }
     }
     async history(req: Request, res: Response) {
          try { const { service } = context(req); return res.json(await service.history({
               deviceId: req.query.deviceId ? String(req.query.deviceId) : undefined,
               page: req.query.page, count: req.query.count, search: req.query.search, status: req.query.status,
          })); }
          catch (error) { return sendError(res, error); }
     }
     async execution(req: Request, res: Response) {
          try { const { service } = context(req); return res.json(await service.execution(Number(req.params.runId))); }
          catch (error) { return sendError(res, error); }
     }
     async execute(req: Request, res: Response) {
          try { const { actor, service } = context(req); return res.status(201).json(await service.execute(String(req.params.deviceId), req.body, actor.employeeid)); }
          catch (error) { return sendError(res, error); }
     }
     async completeAction(req: Request, res: Response) {
          try { const { actor, service } = context(req); return res.json(await service.completeCorrectiveAction(Number(req.params.actionId), req.body?.description, actor.employeeid)); }
          catch (error) { return sendError(res, error); }
     }
     async review(req: Request, res: Response) {
          try { const { actor, service } = context(req); return res.json(await service.supervisorReview(Number(req.params.runId), actor.employeeid, req.body?.comment)); }
          catch (error) { return sendError(res, error); }
     }
}
