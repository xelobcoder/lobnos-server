import { Request, Response } from 'express';
import BillingStrategyRepository from '../../../models/billing/billing-strategy/BillingStrategyRepository';
import { BillingStrategyAssignment, EntityType } from '../../../models/billing/billing-strategy/types/BillingStrategyTypes';


export class StrategyAssignmentController {
     static async createAssignment(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategyAssignment = {
                    ...req.body,
                    applies_from: new Date(req.body.applies_from),
                    applies_to: req.body.applies_to ? new Date(req.body.applies_to) : null,
               };
               const id = await repo.assignStrategyToEntity(data);
               const status = id && id > 0 ? 201 : 400;
               res.status(status).json({ status: status == 201 , message: status == 201 ? 'Strategy assigned successfully' : 'Failed to assign strategy' });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static getStrategyTypeAssignments (req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const entity_type = req.query.entity_type as EntityType
               const billing_strategy_id = parseInt(req.query.billing_strategy_id.toString());
               const trackId =  parseInt(req.query.trackId.toString())
               const repo = new BillingStrategyRepository(tenantId)
               const assignment = repo.getStrategyAssignments(entity_type,trackId,billing_strategy_id);
               res.json(assignment);
          } catch {
               res.status(404).json({ error: 'Assignment not found' });
          }
     }

     static async updateAssignment(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const data: BillingStrategyAssignment = {
                    ...req.body,
                    id,
                    applies_from: new Date(req.body.applies_from),
                    applies_to: req.body.applies_to ? new Date(req.body.applies_to) : null,
               };
               const conn = await repo['connection'];
               await conn('prime_billing_strategy_assignments').where('id', id).update(data);
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }

     static async deleteAssignment(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string);
               const id = parseInt(req.params.id);
               if (!tenantId || tenantId <= 0) throw new Error('Invalid tenantId');
               const repo = new BillingStrategyRepository(tenantId);
               const conn = await repo['connection'];
               await conn('prime_billing_strategy_assignments').where('id', id).del();
               res.json({ success: true });
          } catch (error) {
               res.status(400).json({ error: error.message });
          }
     }
}