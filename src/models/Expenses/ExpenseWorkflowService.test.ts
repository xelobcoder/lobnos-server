import { describe, expect, it, vi } from 'vitest';

vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../accountingModule/integrations/ExpenseAccounting', () => ({ enqueueExpenseAccrual: vi.fn() }));

import { AuthUser } from '../../middleware/authority';
import { ExpenseWorkflowService } from './ExpenseWorkflowService';

const actor: AuthUser = { employeeid: 22, email: 'approver@example.com', role: 'manager', branch: 4, tenantId: 3 };

function expense(overrides: Record<string, unknown> = {}) {
     return {
          id: 10,
          amount: '150.25',
          employeeid: 11,
          branchid: 4,
          date: '2026-09-21',
          approved: 0,
          workflow_status: 'pending_approval',
          workflow_version: 1,
          ...overrides,
     };
}

function harness(initialRows: any[], controls: any = null) {
     const state = { rows: structuredClone(initialRows), actions: [] as any[], accruals: [] as number[] };

     const query = (table: string) => {
          let whereValues: Record<string, unknown> | null = null;
          let ids: number[] = [];
          let nullColumn: string | null = null;
          const builder: any = {
               whereIn: (_column: string, values: number[]) => { ids = values; return builder; },
               orderBy: () => builder,
               forUpdate: async () => state.rows.filter((row) => ids.includes(Number(row.id))),
               where: (values: Record<string, unknown>) => { whereValues = values; return builder; },
               whereNull: (column: string) => { nullColumn = column; return builder; },
               first: async () => {
                    if (table === 'expense_control_settings') {
                         if (nullColumn) return controls?.branchid == null ? controls : undefined;
                         return controls && Number(controls.branchid) === Number(whereValues?.branchid) ? controls : undefined;
                    }
                    return state.rows.find((row) => Object.entries(whereValues || {}).every(([key, value]) => row[key] === value));
               },
               update: async (values: Record<string, unknown>) => {
                    const matching = state.rows.filter((row) => Object.entries(whereValues || {}).every(([key, value]) => row[key] === value));
                    matching.forEach((row) => Object.assign(row, values));
                    return matching.length;
               },
               insert: async (values: any) => {
                    if (table === 'expense_approval_actions') state.actions.push(structuredClone(values));
                    return [1];
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
                    state.rows = snapshot.rows;
                    state.actions = snapshot.actions;
                    state.accruals = snapshot.accruals;
                    throw error;
               }
          },
     };

     return { state, connection };
}

function service(options: {
     rows?: any[];
     controls?: any;
     can?: (employeeid: number, permission: string, amount?: number | null, branchid?: number | null) => any;
     accrualFails?: boolean;
} = {}) {
     const store = harness(options.rows || [expense()], options.controls);
     const can = vi.fn(options.can || (() => ({ allowed: true, reason: 'Granted', delegationId: 7, source: 'delegation' })));
     const enqueue = vi.fn(async (_tenantId: number, expenseId: number) => {
          if (options.accrualFails) throw new Error('Outbox unavailable');
          store.state.accruals.push(expenseId);
     });
     const workflow = new ExpenseWorkflowService(3, {
          connectionFactory: async () => store.connection,
          authorityFactory: () => ({ can } as any),
          enqueueAccrual: enqueue,
     });
     return { workflow, store: store.state, can, enqueue };
}

describe('ExpenseWorkflowService', () => {
     it('uses the authenticated actor and preserves decimal amounts', async () => {
          const test = service();

          await test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }]);

          expect(test.store.rows[0]).toMatchObject({ approved: 1, approvedby: 22, workflow_status: 'approved', workflow_version: 2 });
          expect(test.store.actions[0]).toMatchObject({ actor_employeeid: 22, amount: 150.25, authority_delegation_id: 7 });
          expect(test.can).toHaveBeenCalledWith(22, 'expense.approve', 150.25, 4);
          expect(test.store.accruals).toEqual([10]);
     });

     it('rejects self-approval and rolls back every write', async () => {
          const test = service({ rows: [expense({ employeeid: 22 })] });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).rejects.toThrow('own expense');
          expect(test.store.rows[0]).toMatchObject({ approved: 0, workflow_status: 'pending_approval', workflow_version: 1 });
          expect(test.store.actions).toEqual([]);
          expect(test.store.accruals).toEqual([]);
     });

     it('allows self-approval when the branch control enables it', async () => {
          const test = service({ rows: [expense({ employeeid: 22 })], controls: { branchid: 4, allow_self_approval: 1 } });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).resolves.toHaveLength(1);
          expect(test.store.rows[0]).toMatchObject({ approved: 1, approvedby: 22, workflow_status: 'approved' });
     });

     it('allows an amount exactly at the delegated ceiling', async () => {
          const test = service({ can: (_employeeid, _permission, amount) => ({ allowed: Number(amount) <= 500, reason: 'Limit exceeded', delegationId: 2, source: Number(amount) <= 500 ? 'delegation' : 'denied' }) });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).resolves.toHaveLength(1);
     });

     it('denies an amount above the delegated ceiling', async () => {
          const test = service({ can: (_employeeid, _permission, amount) => ({ allowed: Number(amount) <= 100, reason: 'Limit exceeded', delegationId: 2, source: 'denied' }) });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).rejects.toThrow('Limit exceeded');
          expect(test.store.actions).toEqual([]);
     });

     it('enforces branch-scoped authority decisions', async () => {
          const test = service({ can: (_employeeid, _permission, _amount, branchid) => ({ allowed: branchid === 4, reason: 'Branch not allowed', delegationId: 3, source: 'denied' }), rows: [expense({ branchid: 8 })] });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).rejects.toThrow('Branch not allowed');
     });

     it('blocks repeated approval without adding another audit action', async () => {
          const test = service({ rows: [expense({ approved: 1, workflow_status: 'approved' })] });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).rejects.toThrow('cannot be approved');
          expect(test.store.actions).toEqual([]);
     });

     it('records rejection reason without posting an accrual', async () => {
          const test = service();

          await test.workflow.decide(actor, [{ expenseid: 10, status: 'rejected', information: 'Receipt is missing' }]);

          expect(test.store.rows[0]).toMatchObject({ approved: 2, rejected_by: 22, rejectionmessage: 'Receipt is missing', workflow_status: 'rejected' });
          expect(test.store.actions[0]).toMatchObject({ action: 'rejected', reason: 'Receipt is missing' });
          expect(test.enqueue).not.toHaveBeenCalled();
     });

     it('rolls back approval and audit action when accounting enqueue fails', async () => {
          const test = service({ accrualFails: true });

          await expect(test.workflow.decide(actor, [{ expenseid: 10, status: 'approved' }])).rejects.toThrow('Outbox unavailable');
          expect(test.store.rows[0]).toMatchObject({ approved: 0, workflow_status: 'pending_approval', workflow_version: 1 });
          expect(test.store.actions).toEqual([]);
     });
});
