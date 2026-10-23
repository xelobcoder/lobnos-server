import { allocateCommissionPayment } from './CommissionPaymentAllocation';
import KnexConnection from '../../database/KnexConnections';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import { FinancialFinalizationGuard } from '../../accountingModule/services/FinancialFinalizationGuard';
import { enqueueExpensePaymentReversal } from '../../accountingModule/integrations/ExpenseAccounting';

/** The expense payment ledger is the source of truth for controlled commission requests. */
export async function syncCommissionExpenseSettlement(trx: any, expenseId: number): Promise<void> {
     if (trx.schema && !await trx.schema.hasTable('commission_batch_payments')) return;
     const batch = await trx('commission_batch_payments').where({ expense_id: expenseId }).forUpdate().first();
     if (!batch) return;
     let notes: any;
     try { notes = JSON.parse(batch.notes || '{}'); } catch { return; }
     if (notes.workflow !== 'controlled_expense') return;
     const rows = await trx('commission_batch_payment_services').where({ batch_payment_id: batch.id }).orderBy('id');
     const paid = await trx('expense_payments').where({ expense_id: expenseId, status: 'Paid', is_reversed: false }).sum('amount as total').first();
     const allocation = allocateCommissionPayment(rows.map((row: any) => Number((Number(row.commission_due) - Number(row.waived_amount || 0)).toFixed(2))), Number((Number(batch.total_commission_amount) - Number(batch.waived_amount || 0)).toFixed(2)), Number(paid?.total || 0));
     for (let index = 0; index < rows.length; index++) {
          const share = allocation.services[index];
          const settled = Number((share.due - share.allocated - share.waived).toFixed(2)) <= 0;
          await trx('commission_batch_payment_services').where({ id: rows[index].id }).update({ amount_allocated: share.allocated, status: settled ? share.allocated > 0 ? 'paid' : 'waived' : 'partial' });
          await trx('commission_tracking').where({ service_id: rows[index].serviceid }).whereNotIn('status', ['voided', 'adjusted']).update({ status: settled ? 'paid' : 'approved', updated_at: new Date() });
     }
     await trx('commission_batch_payments').where({ id: batch.id }).update({ payment_amount: allocation.paid, status: allocation.outstanding === 0 ? 'completed' : 'pending', payment_date: allocation.paid > 0 ? new Date() : null, updated_at: new Date() });
}

export async function reverseControlledCommissionPayment(tenantId: number, employeeId: number, branchId: number, payment: any, reason: string) {
     const db = await KnexConnection(tenantId);
     const batch = await db('commission_batch_payments').where({ expense_id: payment.expense_id }).first();
     let notes: any;
     try { notes = JSON.parse(batch?.notes || '{}'); } catch { return null; }
     if (notes.workflow !== 'controlled_expense') return null;
     if (String(reason || '').trim().length < 3) throw new Error('A reversal reason is required');
     return db.transaction(async (trx: any) => {
          const expense = await trx('expensesrecord').where({ id: payment.expense_id }).forUpdate().first();
          if (!expense || Number(expense.branchid) !== branchId) throw new Error('Commission expense is outside your branch');
          const locked = await trx('expense_payments').where({ id: payment.id }).forUpdate().first();
          if (!locked || locked.is_reversed) throw new Error('Payment is already reversed or unavailable');
          const access = await new AuthorityService(tenantId).can(employeeId, 'expense.reverse', Number(locked.amount), branchId);
          if (!access.allowed) throw new Error(access.reason);
          const guard = new FinancialFinalizationGuard(tenantId, trx);
          await guard.assertRecordMutable('expensesrecord', expense.id);
          await guard.assertDateOpen(branchId, locked.payment_date);
          const [id] = await trx('expense_payment_reversals').insert({ payment_id: locked.id, expense_id: expense.id, invoice_id: locked.invoice_id, reversed_amount: locked.amount, reversed_by: employeeId, reversal_reason: reason.trim(), reversal_method: locked.method });
          await trx('expense_payments').where({ id: locked.id }).update({ is_reversed: true, reversal_id: id, reversed_on: new Date() });
          await trx('expensesrecord').where({ id: expense.id }).update({ workflow_status: 'payment_pending', paid_at: null, paid_by: null, workflow_version: Number(expense.workflow_version || 1) + 1 });
          if (locked.invoice_id) await trx('invoices').where({ id: locked.invoice_id }).update({ status: 'Pending' });
          await syncCommissionExpenseSettlement(trx, expense.id);
          await enqueueExpensePaymentReversal(tenantId, locked.id, trx);
          return { success: true, payment_id: locked.id, reversal_id: id, expense_id: expense.id, amount_reversed: Number(locked.amount) };
     });
}
