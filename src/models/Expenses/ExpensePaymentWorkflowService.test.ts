import { describe, expect, it, vi } from 'vitest';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../accountingModule/integrations/ExpenseAccounting', () => ({ enqueueExpensePayment: vi.fn() }));

import { AuthUser } from '../../middleware/authority';
import { ExpensePaymentWorkflowService } from './ExpensePaymentWorkflowService';

const actor: AuthUser = { employeeid: 22, email: 'payer@example.com', role: 'accountant', branch: 4, tenantId: 3 };

function createHarness(options: { approvedBy?: number; amount?: number; accountAccess?: boolean; existingPayments?: any[]; requireSeparatePayer?: boolean } = {}) {
     const state: Record<string, any[]> = {
          expensesrecord: [{ id: 10, amount: options.amount ?? 500, employeeid: 11, branchid: 4, approved: 1, approvedby: options.approvedBy ?? 33, workflow_status: 'approved', workflow_version: 2 }],
          payment_accounts: [{ id: 5, name: 'Main Cash', account_type: 'cash', currency: 'GHS', branchid: 4, gl_account_code: 'acc-1000', is_active: true }],
          payment_account_users: options.accountAccess === false ? [] : [{ id: 1, payment_account_id: 5, employeeid: 22, can_pay: true, can_view: true, is_active: true }],
          expense_control_settings: [{ id: 1, branchid: 4, require_separate_payer: options.requireSeparatePayer ?? true }],
          expense_payments: structuredClone(options.existingPayments || []),
          expense_approval_actions: [],
          invoices: [],
          invoice_expenses: [],
     };
     let paymentId = Math.max(0, ...state.expense_payments.map((payment) => Number(payment.id))) + 1;

     const query = (table: string) => {
          let conditions: Record<string, unknown> = {};
          let nullColumn: string | null = null;
          let aggregateColumn: string | null = null;
          const rows = () => state[table] || [];
          const matches = (row: any) => Object.entries(conditions).every(([key, value]) => row[key] === value) && (!nullColumn || row[nullColumn] == null);
          const builder: any = {
               where: (values: Record<string, unknown>) => { conditions = { ...conditions, ...values }; return builder; },
               whereNull: (column: string) => { nullColumn = column; return builder; },
               forUpdate: () => builder,
               sum: (columnExpression: string) => { aggregateColumn = columnExpression.split(' ')[0]; return builder; },
               first: async () => {
                    if (aggregateColumn) return { total: rows().filter(matches).reduce((sum, row) => sum + Number(row[aggregateColumn!] || 0), 0) };
                    return rows().find(matches);
               },
               insert: async (values: any) => {
                    const inserted = { ...structuredClone(values) };
                    if (table === 'expense_payments') inserted.id = paymentId++;
                    else if (!inserted.id) inserted.id = rows().length + 1;
                    rows().push(inserted);
                    return [inserted.id];
               },
               update: async (values: any) => {
                    const matching = rows().filter(matches);
                    matching.forEach((row) => Object.assign(row, structuredClone(values)));
                    return matching.length;
               },
          };
          return builder;
     };

     const connection = {
          transaction: async (work: (trx: any) => Promise<any>) => {
               const snapshot = structuredClone(state);
               try {
                    return await work(query);
               } catch (error) {
                    Object.keys(state).forEach((key) => { state[key] = snapshot[key]; });
                    throw error;
               }
          },
     };
     return { state, connection };
}

function paymentInput(overrides: Record<string, unknown> = {}) {
     return {
          expenseId: 10,
          paymentAccountId: 5,
          amount: 200,
          paymentDate: '2026-09-20',
          paymentMethod: 'cash' as const,
          paymentReference: 'PAY-100',
          idempotencyKey: 'idem-100',
          ...overrides,
     };
}

function service(options: Parameters<typeof createHarness>[0] & { can?: (...args: any[]) => any; enqueueFails?: boolean } = {}) {
     const harness = createHarness(options);
     const can = vi.fn(options.can || (() => ({ allowed: true, reason: 'Granted', delegationId: 4, source: 'delegation' })));
     const enqueue = vi.fn(async () => { if (options.enqueueFails) throw new Error('Outbox unavailable'); });
     return {
          workflow: new ExpensePaymentWorkflowService(3, {
               connectionFactory: async () => harness.connection,
               authorityFactory: () => ({ can } as any),
               enqueuePayment: enqueue,
          }),
          state: harness.state,
          can,
          enqueue,
     };
}

describe('ExpensePaymentWorkflowService', () => {
     it('records authenticated payer, source account and partial-payment state', async () => {
          const test = service();
          const result = await test.workflow.record(actor, paymentInput());

          expect(result).toMatchObject({ amountPaid: 200, totalPaid: 200, outstanding: 300, status: 'payment_pending' });
          expect(test.state.expense_payments[0]).toMatchObject({ payment_account_id: 5, recorded_by: 22, executed_by: 22, created_by: 22, payment_reference: 'PAY-100' });
          expect(test.state.expensesrecord[0]).toMatchObject({ workflow_status: 'payment_pending', workflow_version: 3 });
          expect(test.can).toHaveBeenCalledWith(22, 'expense.pay', 200, 4);
          expect(test.state.expense_approval_actions[0]).toMatchObject({ action: 'payment_recorded', actor_employeeid: 22, to_status: 'payment_pending' });
     });

     it('marks the expense paid only when cumulative payments reach its amount', async () => {
          const test = service({ existingPayments: [{ id: 1, expense_id: 10, amount: 200, status: 'Paid', is_reversed: false, idempotency_key: 'old' }] });
          const result = await test.workflow.record(actor, paymentInput({ amount: 300 }));

          expect(result).toMatchObject({ totalPaid: 500, outstanding: 0, status: 'paid' });
          expect(test.state.expensesrecord[0]).toMatchObject({ workflow_status: 'paid', paid_by: 22 });
     });

     it('rejects payment from an account not assigned to the payer', async () => {
          const test = service({ accountAccess: false });

          await expect(test.workflow.record(actor, paymentInput())).rejects.toThrow('not authorized');
          expect(test.state.expense_payments).toEqual([]);
     });

     it('enforces approver-payer separation', async () => {
          const test = service({ approvedBy: 22, can: (_employeeid, permission) => permission === 'expense.override_sod' ? ({ allowed: false, reason: 'No override', delegationId: null, source: 'denied' }) : ({ allowed: true, reason: 'Granted', delegationId: 4, source: 'delegation' }) });

          await expect(test.workflow.record(actor, paymentInput())).rejects.toThrow('Require a separate payer is enabled');
     });

     it('allows the approver to pay when branch policy disables separate-payer enforcement', async () => {
          const test = service({ approvedBy: 22, requireSeparatePayer: false });

          await expect(test.workflow.record(actor, paymentInput())).resolves.toMatchObject({ status: 'payment_pending' });
          expect(test.state.expense_payments).toHaveLength(1);
     });

     it('rejects overpayment and rolls back all writes', async () => {
          const test = service();

          await expect(test.workflow.record(actor, paymentInput({ amount: 501 }))).rejects.toThrow('exceeds');
          expect(test.state.expense_payments).toEqual([]);
          expect(test.state.expense_approval_actions).toEqual([]);
     });

     it('returns the existing payment on idempotent retry without inserting another row', async () => {
          const existing = [{ id: 9, expense_id: 10, amount: 200, status: 'Paid', is_reversed: false, idempotency_key: 'idem-100' }];
          const test = service({ existingPayments: existing });
          const result = await test.workflow.record(actor, paymentInput());

          expect(result).toMatchObject({ paymentId: 9, totalPaid: 200, outstanding: 300, status: 'payment_pending' });
          expect(test.state.expense_payments).toHaveLength(1);
          expect(test.enqueue).not.toHaveBeenCalled();
     });

     it('rolls back payment, expense state and audit when accounting enqueue fails', async () => {
          const test = service({ enqueueFails: true });

          await expect(test.workflow.record(actor, paymentInput())).rejects.toThrow('Outbox unavailable');
          expect(test.state.expense_payments).toEqual([]);
          expect(test.state.expensesrecord[0]).toMatchObject({ workflow_status: 'approved', workflow_version: 2 });
          expect(test.state.expense_approval_actions).toEqual([]);
     });
});
