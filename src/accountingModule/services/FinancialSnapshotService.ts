import { createHash } from 'crypto';
import KnexConnection from '../../database/KnexConnections';
import { FinancialDaySnapshot, IFinancialSnapshotService } from '../interfaces/IFinancialSnapshotService';

export class FinancialSnapshotService implements IFinancialSnapshotService {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: any) { }

     async create(branchId: number, financialDate: string): Promise<FinancialDaySnapshot> {
          if (!Number.isInteger(branchId) || branchId <= 0) throw new Error('Valid branch ID is required');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(financialDate)) throw new Error('Financial date must use YYYY-MM-DD');
          const db = this.connectionOverride || await KnexConnection(this.tenantId);

          const [billing, payments, expenses, expensePayments, refunds, ledger, outbox, nhis] = await Promise.all([
               db('billing').where({ branchid: branchId }).whereRaw('DATE(billedon) = ?', [financialDate]).select(
                    db.raw('COUNT(*) AS count'), db.raw('COALESCE(SUM(payable), 0) AS payable'), db.raw('COALESCE(SUM(paid), 0) AS paid'),
                    db.raw('COALESCE(SUM(discount), 0) AS discounts'), db.raw('COALESCE(SUM(totalrefunded), 0) AS refunded'), db.raw('COALESCE(SUM(outstanding), 0) AS outstanding')
               ).first(),
               db('billinghx as payment').join('billing', 'billing.billingid', 'payment.Billingid').where('billing.branchid', branchId).whereRaw('DATE(payment.Date) = ?', [financialDate]).select(
                    db.raw('COUNT(*) AS count'), db.raw("COALESCE(SUM(CASE WHEN payment.type = 'credit' THEN payment.Amount ELSE 0 END), 0) AS credits"),
                    db.raw("COALESCE(SUM(CASE WHEN payment.type = 'debit' THEN payment.Amount ELSE 0 END), 0) AS debits")
               ).first(),
               db('expensesrecord').where({ branchid: branchId }).whereRaw('DATE(date) = ?', [financialDate]).select(
                    db.raw('COUNT(*) AS count'), db.raw('COALESCE(SUM(amount), 0) AS amount')
               ).first(),
               db('expense_payments').where({ branchid: branchId }).whereRaw('DATE(payment_date) = ?', [financialDate]).where({ is_reversed: false }).whereNotExists(
                    db('expensesrecord as expense').join('dboexpensecategory as category', 'category.id', 'expense.category')
                         .whereRaw('expense.id = expense_payments.expense_id')
                         .whereIn(db.raw('LOWER(category.category)'), ['bad debt','bad_debt','bad-debt']).select(db.raw('1'))
               ).select(
                    db.raw('COUNT(*) AS count'), db.raw('COALESCE(SUM(amount), 0) AS amount')
               ).first(),
               db('dbobillingrefundtable as refund').join('dboservices as service', 'service.serviceid', 'refund.serviceid').where('service.branchid', branchId).whereRaw('DATE(refund.approvalDate) = ?', [financialDate]).where('refund.isRefundCompleted', 1).select(
                    db.raw('COUNT(DISTINCT refund.refundid) AS count'), db.raw('COALESCE(SUM(refund.amountRefunded), 0) AS amount')
               ).first(),
               db('acc_journal_lines as line').join('acc_journal_entries as entry', 'entry.id', 'line.journal_entry_id').where('line.branchid', branchId).whereRaw('DATE(entry.occurred_at) = ?', [financialDate]).whereNot('entry.status', 'voided').select(
                    db.raw('COUNT(DISTINCT entry.id) AS entries'), db.raw("COALESCE(SUM(CASE WHEN line.direction = 'debit' THEN line.amount ELSE 0 END), 0) AS debits"),
                    db.raw("COALESCE(SUM(CASE WHEN line.direction = 'credit' THEN line.amount ELSE 0 END), 0) AS credits")
               ).first(),
               db('acc_posting_outbox').whereRaw("COALESCE(DATE(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.occurredAt'))), DATE(created_at)) <= ?", [financialDate]).whereIn('status', ['pending', 'failed', 'dead_letter']).select(
                    db.raw("SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending"),
                    db.raw("SUM(CASE WHEN status IN ('failed', 'dead_letter') THEN 1 ELSE 0 END) AS failed")
               ).first(),
               db('acc_nhis_events').where({ branchid: branchId, event_date: financialDate }).select(
                    db.raw('COUNT(*) AS count'),
                    db.raw("COALESCE(SUM(CASE WHEN kind = 'receipt' THEN amount ELSE 0 END), 0) AS receipts"),
                    db.raw("COALESCE(SUM(CASE WHEN kind = 'reversal' AND reverses_kind = 'receipt' THEN amount ELSE 0 END), 0) AS receipt_reversals"),
                    db.raw("COALESCE(SUM(CASE WHEN kind = 'revenue_adjustment' THEN amount WHEN kind = 'reversal' AND reverses_kind = 'revenue_adjustment' THEN -amount ELSE 0 END), 0) AS revenue_adjustments"),
                    db.raw("COALESCE(SUM(CASE WHEN kind = 'write_off' THEN amount WHEN kind = 'reversal' AND reverses_kind = 'write_off' THEN -amount ELSE 0 END), 0) AS write_offs")
               ).first(),
          ]);

          const ledgerDebits = money(ledger?.debits);
          const ledgerCredits = money(ledger?.credits);
          const outboxPending = Number(outbox?.pending || 0);
          const outboxFailed = Number(outbox?.failed || 0);
          const discrepancies: FinancialDaySnapshot['discrepancies'] = [];
          const balanceDifference = money(ledgerDebits - ledgerCredits);
          if (balanceDifference !== 0) discrepancies.push({ code: 'UNBALANCED_LEDGER', message: 'Posted journal debits and credits do not balance', amount: balanceDifference });
          if (outboxPending > 0) discrepancies.push({ code: 'PENDING_OUTBOX', message: `${outboxPending} accounting posting record(s) are pending` });
          if (outboxFailed > 0) discrepancies.push({ code: 'FAILED_OUTBOX', message: `${outboxFailed} accounting posting record(s) failed` });

          const totals = {
               billingPayable: money(billing?.payable), billingPaid: money(billing?.paid), billingDiscounts: money(billing?.discounts),
               billingRefunded: money(billing?.refunded), billingOutstanding: money(billing?.outstanding),
               paymentCredits: money(Number(payments?.credits || 0) + Number(nhis?.receipts || 0)),
               paymentDebits: money(Number(payments?.debits || 0) + Number(nhis?.receipt_reversals || 0)),
               nhisReceipts: money(nhis?.receipts), nhisReceiptReversals: money(nhis?.receipt_reversals),
               nhisRevenueAdjustments: money(nhis?.revenue_adjustments), nhisWriteOffs: money(nhis?.write_offs),
               expensesAccrued: money(expenses?.amount), expensesPaid: money(expensePayments?.amount), refundsPaid: money(refunds?.amount),
          };
          const recordCounts = {
               billings: Number(billing?.count || 0), payments: Number(payments?.count || 0), expenses: Number(expenses?.count || 0),
               expensePayments: Number(expensePayments?.count || 0), refunds: Number(refunds?.count || 0), journalEntries: Number(ledger?.entries || 0),
               nhisEvents: Number(nhis?.count || 0),
          };
          const canonical = { branchId, financialDate, totals, recordCounts, discrepancies, outboxPending, outboxFailed, ledgerDebits, ledgerCredits };
          return { ...canonical, hash: createHash('sha256').update(stableJson(canonical)).digest('hex') };
     }
}

function money(value: unknown): number {
     return Math.round(Number(value || 0) * 100) / 100;
}

function stableJson(value: any): string {
     if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
     if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
     return JSON.stringify(value);
}
