import { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { ExpenseWorkflowService } from '../../models/Expenses/ExpenseWorkflowService';

export class ExpenseWorkflowController {
     static async history(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const result = await new ExpenseWorkflowService(actor.tenantId).history(actor, Number(request.params.expenseId));
               response.json({ success: true, data: result });
          } catch (error: any) {
               const status = /not found/i.test(error.message) ? 404 : /authority|delegated|branch/i.test(error.message) ? 403 : 400;
               response.status(status).json({ success: false, message: error.message });
          }
     }

     static async controls(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const branchid = request.query.branchid === undefined ? actor.branch : Number(request.query.branchid);
               response.json({ success: true, data: await new ExpenseWorkflowService(actor.tenantId).controls(branchid) });
          } catch (error: any) {
               response.status(500).json({ success: false, message: error.message || 'Unable to load expense controls' });
          }
     }

     static async updateControls(request: Request, response: Response): Promise<void> {
          try {
               const actor = getAuthUser(request)!;
               const branchid = request.body?.branchid === undefined ? actor.branch : Number(request.body.branchid);
               const result = await new ExpenseWorkflowService(actor.tenantId).updateControls(actor, branchid, {
                    allowSelfApproval: request.body?.allow_self_approval ?? request.body?.allowSelfApproval,
                    requireSeparatePayer: request.body?.require_separate_payer ?? request.body?.requireSeparatePayer,
                    allowApprovalOverride: request.body?.allow_approval_override ?? request.body?.allowApprovalOverride,
               });
               response.json({ success: true, data: result });
          } catch (error: any) {
               response.status(400).json({ success: false, message: error.message || 'Unable to update expense controls' });
          }
     }
}
