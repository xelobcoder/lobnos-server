import Decimal from 'decimal.js';
import { PharmacyAccountingCore, accountingDate, fail, positiveId } from './PharmacyAccountingCore';
import { json } from '../PharmacyEnterpriseCore';
import { effectiveTerms, PharmacyAccountingSubledgers } from './PharmacyAccountingSubledgers';

const sum = (rows: any[], field: string) => rows.reduce((s, r) => s.plus(r[field] || 0), new Decimal(0)).toFixed(2);
const paging = (query: any) => ({ limit: Math.min(200, Math.max(1, Math.floor(Number(query.limit) || 100))), offset: Math.max(0, Math.floor(Number(query.offset) || 0)) });

/** Source registers, not replicas of the facility AR/AP engine or fabricated bill allocations. */
export class PharmacyAccountingRegisters extends PharmacyAccountingCore {
     private dates(q: any, column: string, query: any): any {
          if (query.from) q.where(column, '>=', accountingDate(query.from));
          if (query.to) q.where(column, '<=', accountingDate(query.to));
          if (query.from && query.to && query.from > query.to) fail('from must not exceed to');
          return q;
     }
     async receivables(query: any = {}): Promise<any> {
          const page = paging(query);
          if (query.from && query.to && accountingDate(query.from) > accountingDate(query.to)) fail('from must not exceed to');
          // Use DATE for timestamp boundaries rather than a client-dependent timezone timestamp.
          const q = this.db('pharmacy_sales as s').join('pharmacy_customer_accounts as a', 'a.id', 's.customer_account_id')
               .where({ 's.branchid': this.context.branch, 'a.branchid': this.context.branch }).whereIn('s.accounting_version', [2, 3]);
          if (query.from) q.whereRaw('DATE(s.completed_at) >= ?', [accountingDate(query.from)]);
          if (query.to) q.whereRaw('DATE(s.completed_at) <= ?', [accountingDate(query.to)]);
          if (query.customerAccountId) q.where('a.id', positiveId(query.customerAccountId));
          const [rows, totals, terms, adjustments, amendments] = await Promise.all([
               q.clone().select('s.id', 's.receipt_number', 's.customer_name', 's.customer_account_id', 's.patient_id', 's.total_amount', 's.paid_amount', 's.outstanding_amount', 's.status', 's.completed_at')
                    .orderBy('s.completed_at', 'desc').orderBy('s.id').limit(page.limit).offset(page.offset),
               q.clone().sum('s.total_amount as total').sum('s.paid_amount as paid').sum('s.outstanding_amount as outstanding').count('* as count').first(),
               this.db('pharmacy_accounting_invoice_terms').where({ branchid: this.context.branch }),
               this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind: 'ar_adjustment', status: 'posted' }).select('amount', 'details'),
               new PharmacyAccountingSubledgers(this.db, this.context).postedTerms('receivables'),
          ]);
          return { items: rows.map(r => ({ ...r, adjusted_amount: adjustments.filter(a => json(a.details).saleId === r.id).reduce((s, a) => s.plus(a.amount), new Decimal(0)).toFixed(2), due_date: effectiveTerms(r.id, terms.find(t => t.sale_id === r.id)?.due_date || null, amendments).dueDate })), ...page, totals: { count: Number(totals?.count || 0), total: new Decimal(totals?.total || 0).toFixed(2), paid: new Decimal(totals?.paid || 0).toFixed(2), outstanding: new Decimal(totals?.outstanding || 0).toFixed(2) }, capabilities: { dueDates: true, aging: true, credits: true, writeoffs: true, invoiceCollections: 'existing pharmacy customer-account collection workflow' } };
     }
     async payables(query: any = {}): Promise<any> {
          const page = paging(query);
          const balances = await this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
               .where('j.branchid', this.context.branch).where('l.account_code', 'like', 'payable:%')
               .select('l.account_code').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code');
          const suppliers = await this.db('pharmacy_suppliers').where({ branchid: this.context.branch }).orderBy('name');
          const all = suppliers.map(s => {
               const b = balances.find(r => r.account_code === 'payable:' + s.id);
               return { supplier_id: s.id, name: s.name, is_active: Boolean(s.is_active), outstanding_amount: new Decimal(b?.credit || 0).minus(b?.debit || 0).toFixed(2), due_date: null };
          });
          const [receipts, expenses, bills, allocations, amendments] = await Promise.all([
               this.db('pharmacy_documents').where({ branchid: this.context.branch }).whereIn('kind', ['receipt', 'supplier_invoice']).orderBy('created_at', 'desc').limit(page.limit).offset(page.offset),
               this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind: 'expense' }).whereIn('status', ['approved', 'partially_paid']).orderBy('created_at', 'desc').limit(page.limit),
               this.db('pharmacy_accounting_bills').where({ branchid: this.context.branch }),
               this.db('pharmacy_accounting_allocations').where({ branchid: this.context.branch }),
               new PharmacyAccountingSubledgers(this.db, this.context).postedTerms('payables'),
          ]);
          return { items: all.slice(page.offset, page.offset + page.limit), ...page, totals: { count: all.length, outstanding: sum(all, 'outstanding_amount') },
               receipts: receipts.map(r => {
                    const bill = bills.find(b => b.source_kind === r.kind && b.source_ref === r.id);
                    return { ...r, details: json(r.details), bill_id: bill?.id || null, source_kind: r.kind, source_ref: r.id,
                         ...(r.kind === 'supplier_invoice' ? { invoice_id: r.id, invoice_reference: bill?.reference || json(r.details).reference, invoice_date: bill?.document_date || json(r.details).invoiceDate } : {}),
                         allocation_status: bill ? 'registered' : 'unregistered', outstanding_amount: bill ? new Decimal(bill.amount).minus(allocations.filter(a => a.bill_id === bill.id).reduce((s, a) => s.plus(a.amount), new Decimal(0))).toFixed(2) : null, due_date: bill ? effectiveTerms(bill.id, bill.due_date, amendments).dueDate : null };
               }),
               unpaidExpenses: expenses.map(r => ({ ...r, details: json(r.details) })),
               capabilities: { supplierBalances: true, partialSupplierPayments: true, receiptLevelPaymentAllocations: true, supplierInvoiceAllocations: true, receiptDueDates: true, legacyUnallocatedPaymentsRequireReview: true },
               note: 'Registered bills support approved partial allocations. Existing aggregate supplier payments/credits are not silently assigned to receipts; consult aging reconciliation for unallocated differences.' };
     }
     async statement(id: string, party: 'supplier' | 'customer', query: any = {}): Promise<any> {
          const table = party === 'supplier' ? 'pharmacy_suppliers' : 'pharmacy_customer_accounts';
          const partyId = party === 'supplier' ? id : positiveId(id);
          const owner = await this.db(table).where({ id: partyId, branchid: this.context.branch }).first();
          if (!owner) fail('Financial account not found in this branch', 'NOT_FOUND', 404);
          const account = (party === 'supplier' ? 'payable:' : 'receivable:') + partyId;
          const base = this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
               .where({ 'j.branchid': this.context.branch, 'l.account_code': account });
          let opening = new Decimal(0);
          if (query.from) {
               const aggregate = await base.clone().where('j.financial_date', '<', accountingDate(query.from)).sum('l.debit as debit').sum('l.credit as credit').first();
               opening = new Decimal(aggregate?.debit || 0).minus(aggregate?.credit || 0);
          }
          const rows = await this.dates(base.clone(), 'j.financial_date', query).select('l.id', 'l.journal_id', 'l.debit', 'l.credit', 'j.financial_date', 'j.description', 'j.source_ref', 'j.kind')
               .orderBy('j.financial_date').orderBy('j.created_at').orderBy('l.id').limit(5001);
          if (rows.length > 5000) fail('Statement exceeds 5000 lines; narrow the date range', 'RANGE_TOO_LARGE', 422);
          const sign = party === 'supplier' ? -1 : 1;
          let balance = opening;
          const items = rows.map(r => { balance = balance.plus(r.debit).minus(r.credit); return { ...r, balance: balance.mul(sign).toFixed(2) }; });
          return { party: owner, account_code: account, items, openingBalance: opening.mul(sign).toFixed(2), closingBalance: balance.mul(sign).toFixed(2), balanceConvention: party === 'supplier' ? 'credit-positive' : 'debit-positive' };
     }
     async inventory(query: any = {}): Promise<any> {
          const page = paging(query);
          const base = this.db('pharmacy_inventory_items').where({ branchid: this.context.branch });
          const [items, totals, book] = await Promise.all([
               base.clone().select('id', 'name', 'sku', 'current_stock', 'cost_price', 'is_active', 'status').orderBy('name').limit(page.limit).offset(page.offset),
               base.clone().select(this.db.raw('COALESCE(SUM(ROUND(current_stock * cost_price, 2)), 0) as valuation')).count('* as count').first<any>(),
               this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where({ 'j.branchid': this.context.branch, 'l.account_code': 'inventory' }).sum('l.debit as debit').sum('l.credit as credit').first(),
          ]);
          const valuation = new Decimal(totals?.valuation || 0), ledger = new Decimal(book?.debit || 0).minus(book?.credit || 0);
          return { items: items.map(r => ({ ...r, value: new Decimal(r.current_stock).mul(r.cost_price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2) })), ...page,
               totals: { count: Number(totals?.count || 0), onHandValue: valuation.toFixed(2), inventoryControlBalance: ledger.toFixed(2), difference: valuation.minus(ledger).toFixed(2) },
               valuationPolicy: 'current moving weighted-average cost, rounded per item; quarantine and transit are separate control accounts' };
     }
     async revenue(query: any = {}): Promise<any> {
          const page = paging(query);
          const q = this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
               .where('j.branchid', this.context.branch).where(function () { this.where('l.account_code', 'sales').orWhere('l.account_code', 'like', 'revenue:%'); });
          this.dates(q, 'j.financial_date', query);
          const [items, total] = await Promise.all([
               q.clone().select('l.id', 'l.account_code', 'l.debit', 'l.credit', 'j.id as journal_id', 'j.source_ref', 'j.kind', 'j.financial_date', 'j.description')
                    .orderBy('j.financial_date', 'desc').orderBy('l.id', 'desc').limit(page.limit).offset(page.offset),
               q.clone().sum('l.debit as debit').sum('l.credit as credit').count('* as count').first(),
          ]);
          return { items, ...page, totals: { count: Number(total?.count || 0), credits: new Decimal(total?.credit || 0).toFixed(2), debits: new Decimal(total?.debit || 0).toFixed(2), netRevenue: new Decimal(total?.credit || 0).minus(total?.debit || 0).toFixed(2) }, taxRegisterSupported: false };
     }
     async overview(): Promise<any> {
          const [documents, receivables, payables, reconciliations] = await Promise.all([
               this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch }).select('kind', 'status').count('* as count').groupBy('kind', 'status'),
               this.db('pharmacy_sales').where({ branchid: this.context.branch }).whereIn('accounting_version', [2, 3]).sum('outstanding_amount as amount').first(),
               this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where('j.branchid', this.context.branch).where('l.account_code', 'like', 'payable:%').sum('l.debit as debit').sum('l.credit as credit').first(),
               this.db('pharmacy_accounting_statements').where({ branchid: this.context.branch }).select('status').count('* as count').groupBy('status'),
          ]);
          return { documents, receivables: new Decimal(receivables?.amount || 0).toFixed(2), payables: new Decimal(payables?.credit || 0).minus(payables?.debit || 0).toFixed(2), reconciliations };
     }
     async audit(query: any = {}): Promise<any> {
          const page = paging(query), q = this.db('pharmacy_accounting_audit').where({ branchid: this.context.branch });
          if (query.entityId) q.where('entity_id', String(query.entityId));
          if (query.action) q.where('action', String(query.action));
          const items = await q.orderBy('id', 'desc').limit(page.limit).offset(page.offset);
          return { items: items.map(r => ({ ...r, before_state: json(r.before_state, null), after_state: json(r.after_state) })), ...page };
     }
     async periods(): Promise<any> {
          return { items: await this.db('acc_periods').select('period_code', 'period_start', 'period_end', 'status').orderBy('period_code', 'desc').limit(120), scope: 'organization', pharmacyCanChangeStatus: false };
     }
}
