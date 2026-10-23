import KnexConnection from '../../database/KnexConnections';
import { enqueueExpenseAccrual } from '../../accountingModule/integrations/ExpenseAccounting';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { AuthUser } from '../../middleware/authority';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';

export type ExpenseDecisionStatus = 'approved' | 'rejected';

export interface ExpenseDecisionInput {
     expenseid: number;
     status: ExpenseDecisionStatus;
     information?: string;
}

export interface ExpenseDecisionResult {
     expenseid: number;
     status: ExpenseDecisionStatus;
     branchid: number;
     amount: number;
     workflowVersion: number;
}

interface ExpenseWorkflowDependencies {
     connectionFactory?: () => Promise<any>;
     authorityFactory?: () => Pick<AuthorityService, 'can'>;
     enqueueAccrual?: typeof enqueueExpenseAccrual;
}

export class ExpenseWorkflowService {
     constructor(private readonly tenantId: number, private readonly dependencies: ExpenseWorkflowDependencies = {}) { }

     async decide(actor: AuthUser, decisions: ExpenseDecisionInput[]): Promise<ExpenseDecisionResult[]> {
          if (!decisions.length) throw new Error('At least one expense decision is required');
          if (decisions.length > 200) throw new Error('Maximum 200 expense decisions can be processed at once');

          const ids = decisions.map((decision) => Number(decision.expenseid));
          if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error('Every expense decision requires a valid expense ID');
          if (new Set(ids).size !== ids.length) throw new Error('Duplicate expense decisions are not allowed');
          if (decisions.some((decision) => !['approved', 'rejected'].includes(decision.status))) throw new Error('Decision status must be approved or rejected');

          const connection = await (this.dependencies.connectionFactory?.() || KnexConnection(this.tenantId));
          return connection.transaction(async (trx: any) => {
               const rows = await trx('expensesrecord')
                    .whereIn('id', [...ids].sort((left, right) => left - right))
                    .orderBy('id')
                    .forUpdate();
               const rowsById = new Map<number, any>(rows.map((row: any) => [Number(row.id), row]));
               const authority = this.dependencies.authorityFactory?.() || new AuthorityService(this.tenantId);
               const results: ExpenseDecisionResult[] = [];

               for (const decision of decisions) {
                    const expense = rowsById.get(Number(decision.expenseid));
                    if (!expense) throw new Error(`Expense ${decision.expenseid} was not found`);
                    const finalizationGuard = new FinancialFinalizationGuard(this.tenantId, trx);
                    await finalizationGuard.assertRecordMutable('expensesrecord', expense.id);
                    await finalizationGuard.assertDateOpen(Number(expense.branchid), expense.date);

                    const fromStatus = this.statusOf(expense);
                    if (fromStatus !== 'pending_approval') {
                         throw new Error(`Expense ${expense.id} is ${fromStatus} and cannot be ${decision.status}`);
                    }

                    const amount = Number(expense.amount);
                    const branchid = Number(expense.branchid);
                    const authorityDecision = await authority.can(actor.employeeid, 'expense.approve', amount, branchid);
                    if (!authorityDecision.allowed) throw new Error(authorityDecision.reason);

                    const settings = await this.getControls(trx, branchid);
                    if (Number(expense.employeeid) === actor.employeeid && !settings.allowSelfApproval) {
                         const override = settings.allowApprovalOverride
                              ? await authority.can(actor.employeeid, 'expense.override_approval', amount, branchid)
                              : { allowed: false };
                         if (!override.allowed) throw new Error(`You cannot ${decision.status === 'approved' ? 'approve' : 'reject'} your own expense because self-approval is disabled for this branch. Ask an administrator to enable Allow self-approval in Application Settings > Expense Controls, or have another authorized user decide this expense.`);
                    }

                    const reason = String(decision.information || '').trim();
                    if (decision.status === 'rejected' && reason.length < 3) throw new Error(`A rejection reason is required for expense ${expense.id}`);

                    const now = new Date();
                    const workflowVersion = Number(expense.workflow_version || 1) + 1;
                    const update = decision.status === 'approved'
                         ? {
                              approved: 1,
                              approvedby: actor.employeeid,
                              approvedon: now,
                              rejectionmessage: null,
                              rejected_by: null,
                              rejected_at: null,
                              workflow_status: 'approved',
                              workflow_version: workflowVersion,
                         }
                         : {
                              approved: 2,
                              approvedby: null,
                              approvedon: null,
                              rejectionmessage: reason,
                              rejected_by: actor.employeeid,
                              rejected_at: now,
                              workflow_status: 'rejected',
                              workflow_version: workflowVersion,
                         };

                    await trx('expensesrecord').where({ id: expense.id }).update(update);
                    await trx('expense_approval_actions').insert({
                         expense_id: expense.id,
                         action: decision.status,
                         from_status: fromStatus,
                         to_status: decision.status,
                         actor_employeeid: actor.employeeid,
                         actor_branchid: actor.branch,
                         amount,
                         reason: reason || null,
                         authority_delegation_id: authorityDecision.delegationId,
                         authority_source: authorityDecision.source,
                         workflow_version: workflowVersion,
                         metadata: JSON.stringify({ role: actor.role, tenantId: actor.tenantId }),
                         created_at: now,
                    });

                    if (decision.status === 'approved') await (this.dependencies.enqueueAccrual || enqueueExpenseAccrual)(this.tenantId, expense.id, trx);
                    results.push({ expenseid: expense.id, status: decision.status, branchid, amount, workflowVersion });
               }

               return results;
          });
     }

     async history(actor: AuthUser, expenseId: number): Promise<{ expense: any; actions: any[]; payments: any[] }> {
          const connection = await (this.dependencies.connectionFactory?.() || KnexConnection(this.tenantId));
          const expense = await connection('expensesrecord').where({ id: expenseId }).first();
          if (!expense) throw new Error('Expense not found');
          if (actor.branch != null && Number(expense.branchid) !== Number(actor.branch)) throw new Error('Expense is outside your branch');
          const authority = this.dependencies.authorityFactory?.() || new AuthorityService(this.tenantId);
          const decision = await authority.can(actor.employeeid, 'expense.view_audit', null, Number(expense.branchid));
          if (Number(expense.employeeid) !== Number(actor.employeeid) && !decision.allowed) throw new Error(decision.reason);

          const [actions, payments] = await Promise.all([
               connection('expense_approval_actions as action')
                    .leftJoin('roles as actor', 'actor.employeeid', 'action.actor_employeeid')
                    .select('action.*', 'actor.username as actor_name', 'actor.role as actor_role')
                    .where('action.expense_id', expenseId)
                    .orderBy('action.created_at', 'asc'),
               connection('expense_payments as payment')
                    .leftJoin('payment_accounts as account', 'account.id', 'payment.payment_account_id')
                    .leftJoin('roles as recorder', 'recorder.employeeid', 'payment.recorded_by')
                    .select('payment.*', 'account.name as payment_account_name', 'recorder.username as recorded_by_name')
                    .where('payment.expense_id', expenseId)
                    .orderBy('payment.created_on', 'asc'),
          ]);
          return { expense, actions, payments };
     }

     async controls(branchid: number | null): Promise<any> {
          const connection = await (this.dependencies.connectionFactory?.() || KnexConnection(this.tenantId));
          const branchSettings = await connection('expense_control_settings').where({ branchid }).first();
          return branchSettings || connection('expense_control_settings').whereNull('branchid').first();
     }

     async updateControls(actor: AuthUser, branchid: number | null, input: { allowSelfApproval: boolean; requireSeparatePayer: boolean; allowApprovalOverride: boolean }): Promise<any> {
          if (typeof input.allowSelfApproval !== 'boolean' || typeof input.requireSeparatePayer !== 'boolean' || typeof input.allowApprovalOverride !== 'boolean') {
               throw new Error('All expense control values must be booleans');
          }
          const connection = await (this.dependencies.connectionFactory?.() || KnexConnection(this.tenantId));
          const existing = await connection('expense_control_settings').where({ branchid }).first();
          const values = {
               allow_self_approval: input.allowSelfApproval,
               require_separate_payer: input.requireSeparatePayer,
               allow_approval_override: input.allowApprovalOverride,
               updated_by: actor.employeeid,
               updated_at: new Date(),
          };
          if (existing) await connection('expense_control_settings').where({ id: existing.id }).update(values);
          else await connection('expense_control_settings').insert({ branchid, ...values, created_by: actor.employeeid, created_at: new Date() });
          return connection('expense_control_settings').where({ branchid }).first();
     }

     private statusOf(expense: any): string {
          if (expense.workflow_status) return String(expense.workflow_status).toLowerCase();
          if (Number(expense.approved) === 1) return 'approved';
          if (Number(expense.approved) === 2) return 'rejected';
          return 'pending_approval';
     }

     private async getControls(trx: any, branchid: number): Promise<{ allowSelfApproval: boolean; allowApprovalOverride: boolean }> {
          const branchSettings = await trx('expense_control_settings').where({ branchid }).first();
          const settings = branchSettings || await trx('expense_control_settings').whereNull('branchid').first();
          return {
               allowSelfApproval: Boolean(settings?.allow_self_approval),
               allowApprovalOverride: Boolean(settings?.allow_approval_override),
          };
     }
}
