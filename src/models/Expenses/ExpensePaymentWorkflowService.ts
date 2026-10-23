import KnexConnection from '../../database/KnexConnections';
import { enqueueExpensePayment } from '../../accountingModule/integrations/ExpenseAccounting';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { AuthUser } from '../../middleware/authority';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';
import { syncCommissionExpenseSettlement } from '../commissions/CommissionExpenseSettlement';

export interface RecordExpensePaymentInput {
     expenseId: number;
     invoiceId?: number | null;
     paymentAccountId: number;
     amount: number;
     paymentDate: string | Date;
     paymentMethod: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'other';
     paymentReference?: string | null;
     supportingDocument?: string | null;
     idempotencyKey: string;
}

export interface ExpensePaymentResult {
     paymentId: number;
     expenseId: number;
     amountPaid: number;
     totalPaid: number;
     outstanding: number;
     status: 'payment_pending' | 'paid';
}

interface ExpensePaymentDependencies {
     connectionFactory?: () => Promise<any>;
     authorityFactory?: () => Pick<AuthorityService, 'can'>;
     enqueuePayment?: typeof enqueueExpensePayment;
}

export class ExpensePaymentWorkflowService {
     constructor(private readonly tenantId: number, private readonly dependencies: ExpensePaymentDependencies = {}) { }

     async record(actor: AuthUser, input: RecordExpensePaymentInput): Promise<ExpensePaymentResult> {
          const expenseId = Number(input.expenseId);
          const accountId = Number(input.paymentAccountId);
          const amount = Number(input.amount);
          if (!Number.isInteger(expenseId) || expenseId <= 0) throw new Error('A valid expense is required');
          if (!Number.isInteger(accountId) || accountId <= 0) throw new Error('A payment source account is required');
          if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero');
          if (!String(input.idempotencyKey || '').trim()) throw new Error('Payment idempotency key is required');
          if (!input.paymentDate || !isFinite(new Date(input.paymentDate).getTime())) throw new Error('A valid payment date is required');

          const connection = await (this.dependencies.connectionFactory?.() || KnexConnection(this.tenantId));
          return connection.transaction(async (trx: any) => {
               const existing = await trx('expense_payments').where({ idempotency_key: input.idempotencyKey }).first();

               const expense = await trx('expensesrecord').where({ id: expenseId }).forUpdate().first();
               if (!expense) throw new Error('Expense not found');
               if (actor.branch != null && Number(expense.branchid) !== Number(actor.branch)) throw new Error('Expense is outside your branch');

               const account = await trx('payment_accounts').where({ id: accountId, is_active: true }).first();
               if (!account) throw new Error('Payment source account was not found or is inactive');
               if (account.branchid !== null && Number(account.branchid) !== Number(expense.branchid)) {
                    throw new Error('Payment source account does not belong to the expense branch');
               }

               const accountAccess = await trx('payment_account_users')
                    .where({ payment_account_id: accountId, employeeid: actor.employeeid, can_pay: true, is_active: true })
                    .first();
               if (!accountAccess) throw new Error('You are not authorized to pay from this account');

               const authority = this.dependencies.authorityFactory?.() || new AuthorityService(this.tenantId);
               const authorityDecision = await authority.can(actor.employeeid, 'expense.pay', amount, Number(expense.branchid));
               if (!authorityDecision.allowed) throw new Error(authorityDecision.reason);

               const controls = await this.getControls(trx, Number(expense.branchid));
               if (controls.requireSeparatePayer && Number(expense.approvedby) === actor.employeeid) {
                    const override = await authority.can(actor.employeeid, 'expense.override_sod', amount, Number(expense.branchid));
                    if (!override.allowed) throw new Error('The expense approver cannot also record its payment because Require a separate payer is enabled for this branch. Disable it in Application Settings > Expense Controls, or have another authorized user pay.');
               }

               if (existing) {
                    if (Number(existing.expense_id) !== expenseId || Number(existing.amount) !== amount || existing.payment_account_id != null && Number(existing.payment_account_id) !== accountId || existing.recorded_by != null && Number(existing.recorded_by) !== actor.employeeid) throw new Error('Payment retry does not match the original payment');
                    return this.toExistingResult(trx, existing);
               }
               const finalizationGuard = new FinancialFinalizationGuard(this.tenantId, trx);
               await finalizationGuard.assertRecordMutable('expensesrecord', expense.id);
               await finalizationGuard.assertDateOpen(Number(expense.branchid), input.paymentDate);
               const currentStatus = this.statusOf(expense);
               if (!['approved', 'payment_pending'].includes(currentStatus) || Number(expense.approved) !== 1) throw new Error('Expense must be approved before payment');

               if (input.invoiceId) {
                    const invoice = await trx('invoices').where({ id: input.invoiceId }).forUpdate().first();
                    if (!invoice) throw new Error('Invoice not found');
                    const membership = await trx('invoice_expenses').where({ invoice_id: input.invoiceId, expense_id: expenseId }).first();
                    if (!membership) throw new Error('The selected invoice does not contain this expense');
               }

               const paidResult = await trx('expense_payments')
                    .where({ expense_id: expenseId, status: 'Paid', is_reversed: false })
                    .sum('amount as total')
                    .first();
               const previousPaid = Number(paidResult?.total || 0);
               const expenseAmount = Number(expense.amount);
               const outstandingBefore = Number((expenseAmount - previousPaid).toFixed(2));
               if (outstandingBefore <= 0) throw new Error('Expense is already fully paid');
               if (amount > outstandingBefore) throw new Error(`Payment exceeds the outstanding amount of ${outstandingBefore.toFixed(2)}`);

               this.validateMethod(account.account_type, input.paymentMethod);
               const paymentDate = new Date(input.paymentDate);
               const [paymentId] = await trx('expense_payments').insert({
                    expense_id: expenseId,
                    invoice_id: input.invoiceId || null,
                    payment_date: paymentDate,
                    amount,
                    method: input.paymentMethod,
                    status: 'Paid',
                    payment_account_id: accountId,
                    payment_reference: input.paymentReference?.trim() || null,
                    currency: account.currency || 'GHS',
                    recorded_by: actor.employeeid,
                    executed_by: actor.employeeid,
                    branchid: expense.branchid,
                    supporting_document: input.supportingDocument?.trim() || null,
                    idempotency_key: input.idempotencyKey.trim(),
                    created_by: actor.employeeid,
                    created_on: new Date(),
               });

               const totalPaid = Number((previousPaid + amount).toFixed(2));
               const outstanding = Number(Math.max(0, expenseAmount - totalPaid).toFixed(2));
               const nextStatus = outstanding === 0 ? 'paid' : 'payment_pending';
               const workflowVersion = Number(expense.workflow_version || 1) + 1;
               await trx('expensesrecord').where({ id: expenseId }).update({
                    workflow_status: nextStatus,
                    workflow_version: workflowVersion,
                    paid_by: outstanding === 0 ? actor.employeeid : null,
                    paid_at: outstanding === 0 ? paymentDate : null,
               });

               await trx('expense_approval_actions').insert({
                    expense_id: expenseId,
                    action: 'payment_recorded',
                    from_status: currentStatus,
                    to_status: nextStatus,
                    actor_employeeid: actor.employeeid,
                    actor_branchid: actor.branch,
                    amount,
                    reason: null,
                    authority_delegation_id: authorityDecision.delegationId,
                    authority_source: authorityDecision.source,
                    workflow_version: workflowVersion,
                    metadata: JSON.stringify({ paymentId, paymentAccountId: accountId, paymentReference: input.paymentReference || null }),
                    created_at: new Date(),
               });

               if (input.invoiceId) await this.updateInvoiceStatus(trx, input.invoiceId);
               await syncCommissionExpenseSettlement(trx, expenseId);
               await (this.dependencies.enqueuePayment || enqueueExpensePayment)(this.tenantId, Number(paymentId), trx);

               return { paymentId: Number(paymentId), expenseId, amountPaid: amount, totalPaid, outstanding, status: nextStatus };
          });
     }

     private statusOf(expense: any): string {
          if (expense.workflow_status) return String(expense.workflow_status).toLowerCase();
          return Number(expense.approved) === 1 ? 'approved' : Number(expense.approved) === 2 ? 'rejected' : 'pending_approval';
     }

     private async getControls(trx: any, branchid: number): Promise<{ requireSeparatePayer: boolean }> {
          const branchSettings = await trx('expense_control_settings').where({ branchid }).first();
          const settings = branchSettings || await trx('expense_control_settings').whereNull('branchid').first();
          return { requireSeparatePayer: settings?.require_separate_payer === undefined ? true : Boolean(settings.require_separate_payer) };
     }

     private validateMethod(accountType: string, method: RecordExpensePaymentInput['paymentMethod']): void {
          const allowed: Record<string, string[]> = {
               cash: ['cash'],
               bank: ['bank_transfer', 'cheque'],
               mobile_money: ['mobile_money'],
               other: ['other'],
          };
          if (!allowed[accountType]?.includes(method)) throw new Error(`Payment method ${method} is not valid for this payment source`);
     }

     private async updateInvoiceStatus(trx: any, invoiceId: number): Promise<void> {
          const invoice = await trx('invoices').where({ id: invoiceId }).first();
          if (!invoice || invoice.status === 'Rejected') return;
          const paid = await trx('expense_payments').where({ invoice_id: invoiceId, status: 'Paid', is_reversed: false }).sum('amount as total').first();
          await trx('invoices').where({ id: invoiceId }).update({ status: Number(paid?.total || 0) >= Number(invoice.total_amount) ? 'Paid' : 'Approved', updated_on: new Date() });
     }

     private async toExistingResult(trx: any, payment: any): Promise<ExpensePaymentResult> {
          const expense = await trx('expensesrecord').where({ id: payment.expense_id }).first();
          const paid = await trx('expense_payments').where({ expense_id: payment.expense_id, status: 'Paid', is_reversed: false }).sum('amount as total').first();
          const totalPaid = Number(paid?.total || 0);
          const outstanding = Number(Math.max(0, Number(expense?.amount || 0) - totalPaid).toFixed(2));
          return {
               paymentId: Number(payment.id),
               expenseId: Number(payment.expense_id),
               amountPaid: Number(payment.amount),
               totalPaid,
               outstanding,
               status: outstanding === 0 ? 'paid' : 'payment_pending',
          };
     }
}
