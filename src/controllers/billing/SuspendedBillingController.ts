import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { SuspendedBillingService } from '../../models/billing/SuspendedBillingService';

export class SuspendedBillingController {
     static async create(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               const result = await new SuspendedBillingService(actor.tenantId).suspend(actor, request.body);
               response.status(201).json({ success: true, data: result });
          } catch (error: any) {
               response.status(/branch|patient|source|entity|select/i.test(error.message) ? 400 : 500)
                    .json({ success: false, message: error.message || 'Unable to suspend transaction' });
          }
     }

     static async list(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               const data = await new SuspendedBillingService(actor.tenantId).list(actor);
               response.json({ success: true, data });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to list suspended transactions' });
          }
     }

     static async get(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               const data = await new SuspendedBillingService(actor.tenantId).get(actor, Number(request.params.id));
               response.json({ success: true, data });
          } catch (error: any) {
               response.status(/not found/i.test(error.message) ? 404 : 400).json({ success: false, message: error.message || 'Unable to load suspended transaction' });
          }
     }

     static async update(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               const result = await new SuspendedBillingService(actor.tenantId).suspend(actor, request.body, Number(request.params.id));
               response.json({ success: true, data: result });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to update suspended transaction' });
          }
     }

     static async cancel(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               await new SuspendedBillingService(actor.tenantId).cancel(actor, Number(request.params.id));
               response.json({ success: true, data: { id: Number(request.params.id), status: 'cancelled' } });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to cancel suspended transaction' });
          }
     }

     static async finalize(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request);
               if (!actor) {
                    response.status(401).json({ success: false, message: 'Authentication required' });
                    return;
               }
               const billingId = Number(request.body?.billingId);
               if (!Number.isSafeInteger(billingId) || billingId <= 0) {
                    response.status(400).json({ success: false, message: 'A valid billingId is required' });
                    return;
               }
               await new SuspendedBillingService(actor.tenantId).finalize(actor, Number(request.params.id), billingId);
               response.json({ success: true, data: { id: Number(request.params.id), billingId, status: 'finalized' } });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to finalize suspended transaction' });
          }
     }
}
