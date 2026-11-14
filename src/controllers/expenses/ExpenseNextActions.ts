import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/authority';
import { assertExpenseAccess } from '../../models/Expenses/ExpenseReceiptService';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { ExpenseWorkflowService } from '../../models/Expenses/ExpenseWorkflowService';

export async function ExpenseNextActions(req: Request, res: Response) {
     try {
          const actor = getAuthUser(req)!;
          const expense = await assertExpenseAccess(actor, Number(req.params.expenseId));
          const authority = new AuthorityService(actor.tenantId);
          const [approval, payment, controls] = await Promise.all([
               authority.can(actor.employeeid, 'expense.approve', Number(expense.amount), Number(expense.branchid)),
               authority.can(actor.employeeid, 'expense.pay', Number(expense.amount), Number(expense.branchid)),
               new ExpenseWorkflowService(actor.tenantId).controls(Number(expense.branchid)),
          ]);
          let canApprove = approval.allowed;
          let reason = approval.reason;
          if (Number(expense.employeeid) === actor.employeeid && !controls?.allow_self_approval) {
               const override = controls?.allow_approval_override ? await authority.can(actor.employeeid, 'expense.override_approval', Number(expense.amount), Number(expense.branchid)) : { allowed: false };
               if (!override.allowed) { canApprove = false; reason = 'Submitted for review by another authorized approver.'; }
          }
          let canPay = payment.allowed;
          if ((controls?.require_separate_payer ?? true) && Number(expense.approvedby) === actor.employeeid) {
               canPay = canPay && (await authority.can(actor.employeeid, 'expense.override_sod', Number(expense.amount), Number(expense.branchid))).allowed;
          }
          const recordedStatus = String(expense.workflow_status || 'pending_approval');
          const approved = Number(expense.approved);
          const status = recordedStatus === 'pending_approval' && approved !== 0
               ? (approved === 1 ? 'approved' : 'rejected')
               : recordedStatus;
          res.json({ success: true, canApprove: canApprove && status === 'pending_approval', canPay: canPay && ['approved', 'payment_pending'].includes(status), canDeleteReceipts: ['draft', 'pending_approval', 'rejected'].includes(status), reason });
     } catch (error: any) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
}
