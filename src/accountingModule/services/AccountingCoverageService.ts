import KnexConnection from '../../database/KnexConnections';
import { enqueueBillingPayment, enqueueBillingReceivable } from '../integrations/BillingAccounting';
import { enqueueSupplierPayment } from '../integrations/SupplierAccounting';

export interface CoverageLine {
     module: string;
     document: string;
     total: number;
     posted: number;
     missingPreGoLive: number;
     missingPostGoLive: number;
     amountMissingPostGoLive: number;
}

export interface CoverageReport {
     goLive: string | null;
     initialization: 'initialized' | 'opening_balances_required';
     generatedAt: string;
     lines: CoverageLine[];
     billDrift: { billingid: number; payable: number; ledger: number; difference: number }[];
}

const num = (v: any) => Number(v || 0);

/**
 * Read-only comparison of operational documents against ledger postings.
 * "Go-live" is the earliest journal; anything older is history the ledger never saw.
 */
export class AccountingCoverageService {
     constructor(private tenantId: number) { }

     private async goLive(db: any): Promise<string | null> {
          const row = await db('acc_journal_entries').min({ d: 'occurred_at' }).first();
          return row?.d ? new Date(row.d).toISOString().slice(0, 10) : null;
     }

     async report(): Promise<CoverageReport> {
          const db = await KnexConnection(this.tenantId);
          const goLive = await this.goLive(db);
          // An empty ledger has no post-go-live documents. Existing operations need an opening decision.
          const cut = goLive || '9999-12-31';
          const lines: CoverageLine[] = [];

          const one = async (module: string, document: string, sql: string, bindings: any[]) => {
               const [rows] = await db.raw(sql, bindings);
               const r = rows[0] || {};
               lines.push({
                    module,
                    document,
                    total: num(r.total),
                    posted: num(r.posted),
                    missingPreGoLive: num(r.missing_pre),
                    missingPostGoLive: num(r.missing_post),
                    amountMissingPostGoLive: Math.round(num(r.amount_post) * 100) / 100,
               });
          };

          await one(
               'billing',
               'Bills accrued to receivable',
               `SELECT COUNT(*) total, SUM(j.id IS NOT NULL) posted,
                  SUM(j.id IS NULL AND DATE(b.billedon) < ?) missing_pre,
                  SUM(j.id IS NULL AND DATE(b.billedon) >= ?) missing_post,
                  SUM(CASE WHEN j.id IS NULL AND DATE(b.billedon) >= ? THEN b.payable ELSE 0 END) amount_post
                FROM billing b
                LEFT JOIN acc_journal_entries j ON j.source_module = 'billing' AND j.source_table = 'billing'
                  AND j.source_pk = b.billingid AND j.transaction_type = 'accrual'
                WHERE b.status <> 'voided' AND b.payable > 0`,
               [cut, cut, cut]
          );

          await one(
               'billing',
               'Bill payments (billinghx credits)',
               `SELECT COUNT(*) total, SUM(j.id IS NOT NULL) posted,
                  SUM(j.id IS NULL AND DATE(h.Date) < ?) missing_pre,
                  SUM(j.id IS NULL AND DATE(h.Date) >= ?) missing_post,
                  SUM(CASE WHEN j.id IS NULL AND DATE(h.Date) >= ? THEN h.Amount ELSE 0 END) amount_post
                FROM billinghx h
                LEFT JOIN acc_journal_entries j ON j.source_module = 'billing' AND j.source_table = 'billinghx'
                  AND j.source_pk = h.KeyID AND j.transaction_type = 'payment'
                WHERE h.type = 'credit' AND h.Amount > 0 AND COALESCE(h.isVoided, 0) = 0`,
               [cut, cut, cut]
          );

          await one(
               'payroll',
               'Paid payroll periods',
               `SELECT COUNT(*) total, SUM(j.id IS NOT NULL) posted,
                  SUM(j.id IS NULL AND DATE(p.updated_at) < ?) missing_pre,
                  SUM(j.id IS NULL AND DATE(p.updated_at) >= ?) missing_post,
                  0 amount_post
                FROM payroll_periods p
                LEFT JOIN (SELECT DISTINCT source_pk, id FROM acc_journal_entries WHERE source_module = 'payroll') j ON j.source_pk = p.id
                WHERE p.status = 'paid'`,
               [cut, cut]
          ).catch(() => undefined);

          await one(
               'inventory',
               'Goods receipts',
               `SELECT COUNT(*) total, SUM(j.id IS NOT NULL) posted, 0 missing_pre,
                  SUM(j.id IS NULL) missing_post, 0 amount_post
                FROM inv_purchase_order_receipts r
                LEFT JOIN acc_journal_entries j ON j.source_module = 'inventory' AND j.source_ref = r.id`,
               []
          ).catch(() => undefined);

          await one(
               'inventory',
               'Stock consumption without unit cost (no COGS)',
               `SELECT COUNT(*) total, SUM(COALESCE(total_cost, 0) > 0) posted, 0 missing_pre,
                  SUM(COALESCE(total_cost, 0) <= 0) missing_post, 0 amount_post
                FROM inv_inventory_transactions
                WHERE transaction_type IN ('consumption', 'wastage')`,
               []
          ).catch(() => undefined);

          const [drift] = await db.raw(
               `SELECT b.billingid, b.payable,
                  COALESCE(SUM(CASE WHEN l.direction = 'debit' THEN l.amount ELSE -l.amount END), 0) ledger
                FROM billing b
                JOIN acc_journal_entries e ON e.source_module = 'billing' AND e.source_table = 'billing'
                  AND e.source_pk = b.billingid AND e.status <> 'voided'
                JOIN acc_journal_lines l ON l.journal_entry_id = e.id AND l.account_id = 'acc-1002'
                GROUP BY b.billingid, b.payable
                HAVING ABS(ledger - b.payable) > 0.01
                ORDER BY ABS(ledger - b.payable) DESC LIMIT 200`
          );

          return {
               goLive,
               initialization: goLive ? 'initialized' : 'opening_balances_required',
               generatedAt: new Date().toISOString(),
               lines,
               billDrift: (drift as any[]).map((d) => ({
                    billingid: Number(d.billingid),
                    payable: num(d.payable),
                    ledger: num(d.ledger),
                    difference: Math.round((num(d.ledger) - num(d.payable)) * 100) / 100,
               })),
          };
     }

     /**
      * Idempotent repair of post-go-live billing gaps. Dry-run unless execute is true.
      * Historic (pre-go-live) documents are never touched: they belong to opening balances.
      */
     async backfillBilling(execute: boolean): Promise<{ bills: number[]; payments: number[]; supplierPayments: string[]; executed: boolean }> {
          const db = await KnexConnection(this.tenantId);
          const goLive = await this.goLive(db);
          if (!goLive) return { bills: [], payments: [], supplierPayments: [], executed: false };

          const [billRows] = await db.raw(
               `SELECT b.billingid FROM billing b
                LEFT JOIN acc_journal_entries j ON j.source_module = 'billing' AND j.source_table = 'billing'
                  AND j.source_pk = b.billingid AND j.transaction_type = 'accrual'
                WHERE j.id IS NULL AND b.status <> 'voided' AND b.payable > 0 AND DATE(b.billedon) >= ?
                LIMIT 1000`,
               [goLive]
          );
          const [payRows] = await db.raw(
               `SELECT h.KeyID, h.Billingid, h.Amount, h.employeeid FROM billinghx h
                LEFT JOIN acc_journal_entries j ON j.source_module = 'billing' AND j.source_table = 'billinghx'
                  AND j.source_pk = h.KeyID AND j.transaction_type = 'payment'
                WHERE j.id IS NULL AND h.type = 'credit' AND h.Amount > 0 AND COALESCE(h.isVoided, 0) = 0
                  AND DATE(h.Date) >= ? LIMIT 1000`,
               [goLive]
          );

          const bills = (billRows as any[]).map((r) => Number(r.billingid));
          const payments = (payRows as any[]).map((r) => Number(r.KeyID));

          const [supRows] = await db.raw(
               `SELECT p.id FROM inv_supplier_payments p
                LEFT JOIN acc_subledger_entries s ON s.ledger = 'AP' AND s.source_table = 'inv_supplier_payments' AND s.source_ref = p.id
                WHERE s.id IS NULL AND p.payment_amount > 0 AND DATE(p.payment_date) >= ?`,
               [goLive]
          );
          const supplierPayments = (supRows as any[]).map((r) => String(r.id));

          if (execute) {
               for (const id of supplierPayments) await enqueueSupplierPayment(this.tenantId, id);
               // accrue first so payments land on the receivable basis
               for (const id of bills) await enqueueBillingReceivable(this.tenantId, id, 0, 0);
               for (const p of payRows as any[]) {
                    await enqueueBillingPayment(this.tenantId, Number(p.KeyID), Number(p.Billingid), Number(p.Amount), p.employeeid ?? null);
               }
          }
          return { bills, payments, supplierPayments, executed: execute };
     }
}
