import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { PharmacyAccountingCore, accountingDate, amount, assertTransition, assertVersion, fail, stableHash, text } from './PharmacyAccountingCore';
import { pharmacyAccount } from './PharmacyAccountingCatalogue';
import { postPharmacyJournal, resolvePharmacyDestination } from '../PharmacyLedger';
import { json } from '../PharmacyEnterpriseCore';
import { PharmacyAccountingTaxCredits, TAX_CREDIT_POLICY } from './PharmacyAccountingTaxCredits';

const today = () => new Date().toISOString().slice(0, 10);
export function agingBucket(due: string | null, asOf: string): string {
     if (!due) return 'unknown_due_date';
     const days = Math.floor((Date.parse(asOf) - Date.parse(due)) / 86400000);
     return days <= 0 ? 'current' : days <= 30 ? 'days_1_30' : days <= 60 ? 'days_31_60' : days <= 90 ? 'days_61_90' : 'days_91_plus';
}
const decimal = (n: any) => new Decimal(n || 0);

type TermsParty = 'payables' | 'receivables';
interface TermsDetails { sourceId: string; previousDueDate: string; dueDate: string; previousRevision: number; revision?: number }
interface TermsAmendment { financial_date: string | Date; details: string | TermsDetails }
export function effectiveTerms(sourceId: string, original: string | Date | null, amendments: TermsAmendment[]): { dueDate: string | null; revision: number } {
     const latest = amendments.map(row => json(row.details) as TermsDetails).filter(detail => detail.sourceId === sourceId)
          .sort((a, b) => Number(b.revision) - Number(a.revision))[0];
     return { dueDate: latest ? accountingDate(latest.dueDate) : original ? accountingDate(original) : null, revision: latest?.revision || 0 };
}

/** Approved source allocations. Recognition always remains in the existing immutable local journal. */
export class PharmacyAccountingSubledgers extends PharmacyAccountingCore {
     private termsKind(party: TermsParty): string { return party === 'payables' ? 'ap_terms' : 'ar_terms'; }
     async postedTerms(party: TermsParty, asOf = today(), db: Knex | Knex.Transaction = this.db): Promise<TermsAmendment[]> {
          return db('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind: this.termsKind(party), status: 'posted' })
               .where('financial_date', '<=', asOf).select('financial_date', 'details');
     }
     private async termsSource(trx: Knex.Transaction, party: TermsParty, id: string): Promise<{ date: string; dueDate: string | null }> {
          if (party === 'payables') {
               const bill = await trx('pharmacy_accounting_bills').where({ id, branchid: this.context.branch }).forUpdate().first();
               if (!bill) fail('Bill not found in this branch', 'NOT_FOUND', 404);
               return { date: accountingDate(bill.document_date), dueDate: bill.due_date ? accountingDate(bill.due_date) : null };
          }
          const sale = await this.sale(trx, id);
          const terms = await trx('pharmacy_accounting_invoice_terms').where({ sale_id: id, branchid: this.context.branch }).forUpdate().first();
          return { date: accountingDate(sale.completed_at), dueDate: terms ? accountingDate(terms.due_date) : null };
     }
     async createTermsAmendment(party: TermsParty, sourceId: string, input: any): Promise<any> {
          return this.atomic(input, `${party}:terms:create:${sourceId}`, async trx => {
               const source = await this.termsSource(trx, party, sourceId), date = accountingDate(input.date), dueDate = accountingDate(input.dueDate);
               const amendments = await this.postedTerms(party, today(), trx), current = effectiveTerms(sourceId, source.dueDate, amendments);
               if (!current.dueDate) fail('Record the original evidenced due date before requesting a correction', 'TERMS_UNKNOWN', 409);
               if (input.expectedDueDate !== current.dueDate) fail('Due date changed; refresh the original bill or invoice before requesting a correction', 'TERMS_CONFLICT', 409);
               if (dueDate === current.dueDate || dueDate < source.date) fail('Choose a different due date on or after the original bill or invoice date');
               if (date < source.date || date > today() || amendments.some(a => json(a.details).sourceId === sourceId && accountingDate(a.financial_date) > date))
                    fail('Correction date must follow the original document and latest correction, and cannot be in the future');
               const id = randomUUID(), reason = text(input.reason, 'due-date correction evidence');
               const details: TermsDetails = { sourceId, previousDueDate: current.dueDate, dueDate, previousRevision: current.revision };
               const row = { id, branchid: this.context.branch, kind: this.termsKind(party), status: 'draft', version: 1, financial_date: date, amount: '0.00', description: reason, created_by: this.context.actor, details: JSON.stringify(details) };
               await trx('pharmacy_accounting_documents').insert(row);
               await this.audit(trx, `${party}:terms:create`, id, null, row);
               return { id, status: 'draft', version: 1 };
          });
     }
     async termsAmendmentAction(party: TermsParty, id: string, action: string, input: any): Promise<any> {
          return this.atomic(input, `${party}:terms:${id}:${action}`, async trx => {
               const row = await this.document(trx, id, this.termsKind(party)); assertVersion(row, input);
               if (!['submit', 'approve', 'post', 'void'].includes(action)) fail('Unsupported due-date correction action', 'UNSUPPORTED', 422);
               if (['date', 'dueDate', 'sourceId', 'previousDueDate', 'previousRevision'].some(key => Object.prototype.hasOwnProperty.call(input, key)))
                    fail('Due-date correction evidence is immutable; cancel the unposted request and create a replacement', 'HISTORY_PROTECTED', 409);
               const before = { ...row, details: { ...row.details } };
               const status = action === 'void' && row.status === 'approved' ? 'voided' : assertTransition(row, action, this.context.actor);
               if (action === 'post') {
                    const source = await this.termsSource(trx, party, row.details.sourceId);
                    const amendments = await this.postedTerms(party, today(), trx), current = effectiveTerms(row.details.sourceId, source.dueDate, amendments);
                    if (current.dueDate !== row.details.previousDueDate || current.revision !== row.details.previousRevision)
                         fail('Due date changed since this correction was prepared; create a new correction from the current terms', 'TERMS_CONFLICT', 409);
                    if (amendments.some(a => json(a.details).sourceId === row.details.sourceId && accountingDate(a.financial_date) > accountingDate(row.financial_date)))
                         fail('Correction cannot predate a later posted due-date correction', 'TERMS_CONFLICT', 409);
                    row.details.revision = current.revision + 1;
               }
               return this.transition(trx, row, action, status, input, before);
          });
     }
     async registerBill(input: any): Promise<any> {
          return this.atomic(input, 'ap:bill:register', async trx => {
               if (typeof input.receiptId !== 'string' || !input.receiptId || input.receiptId.length > 64) fail('Supply the original receiptId');
               const receipt = await trx('pharmacy_documents').where({ id: input.receiptId, branchid: this.context.branch, kind: 'receipt' }).forUpdate().first();
               if (!receipt || !receipt.supplier_id) fail('Posted supplier receipt not found in this branch', 'NOT_FOUND', 404);
               const supplier = await trx('pharmacy_suppliers').where({ id: receipt.supplier_id, branchid: this.context.branch }).forUpdate().first();
               if (!supplier) fail('Receipt supplier is not in this branch');
               if (await trx('pharmacy_accounting_bills').where({ branchid: this.context.branch, source_kind: 'receipt', source_ref: receipt.id }).first()) fail('Receipt already registered as a bill', 'DUPLICATE_BILL', 409);
               const lines = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where({ 'j.branchid': this.context.branch, 'j.source_ref': receipt.id, 'l.account_code': 'payable:' + supplier.id }).select('l.debit', 'l.credit', 'j.financial_date');
               if (!lines.length) fail('Receipt has no posted supplier liability; historical source reconciliation is required', 'UNPOSTED_RECEIPT', 409);
               const value = amount(lines.reduce((s, l) => s.plus(l.credit).minus(l.debit), decimal(0)).toFixed(2));
               if (!decimal(value).eq(receipt.amount)) fail('Receipt amount does not reconcile to its posted liability', 'SOURCE_MISMATCH', 409);
               const date = accountingDate(lines[0].financial_date), due = input.dueDate == null ? null : accountingDate(input.dueDate);
               if (due && due < date) fail('Bill dueDate cannot precede recognition date');
               const row = { id: randomUUID(), branchid: this.context.branch, supplier_id: supplier.id, source_kind: 'receipt', source_ref: receipt.id, reference: input.reference == null ? receipt.id : text(input.reference, 'bill reference', 128), document_date: date, due_date: due, amount: value, created_by: this.context.actor };
               await trx('pharmacy_accounting_bills').insert(row); await this.audit(trx, 'ap:bill:register', row.id, null, row); return row;
          });
     }
     async billDueDate(id: string, input: any): Promise<any> {
          return this.atomic(input, `ap:bill:terms:${id}`, async trx => {
               const row = await trx('pharmacy_accounting_bills').where({ id, branchid: this.context.branch }).forUpdate().first();
               if (!row) fail('Bill not found in this branch', 'NOT_FOUND', 404);
               if (row.due_date) fail('Recorded due dates are immutable. Use Correct due date on the original bill, then submit it for independent review', 'HISTORY_PROTECTED', 409);
               const due = accountingDate(input.dueDate), reason = text(input.reason, 'terms evidence');
               if (due < accountingDate(row.document_date)) fail('Bill dueDate cannot precede recognition date');
               await trx('pharmacy_accounting_bills').where({ id, branchid: this.context.branch }).update({ due_date: due });
               await this.audit(trx, 'ap:bill:terms', id, row, { due_date: due, reason }); return { id, due_date: due };
          });
     }
     private async allocationLines(trx: Knex.Transaction, allocations: any, date: string): Promise<{ items: any[]; supplierId: string; total: string }> {
          if (!Array.isArray(allocations) || !allocations.length || allocations.length > 100 || allocations.some(a => !a || typeof a.billId !== 'string' || !a.billId) || new Set(allocations.map(a => a.billId)).size !== allocations.length) fail('Select 1-100 distinct bills');
          const items: any[] = [];
          for (const line of [...allocations].sort((a, b) => String(a.billId).localeCompare(String(b.billId)))) {
               const bill = await trx('pharmacy_accounting_bills').where({ id: line.billId, branchid: this.context.branch }).forUpdate().first();
               if (!bill) fail('Bill not found in this branch', 'NOT_FOUND', 404);
               if (!['receipt', 'supplier_invoice'].includes(bill.source_kind)) fail('Expense bills must use the approved expense payment workflow', 'EXPENSE_PAYMENT_REQUIRED', 409);
               if (date < accountingDate(bill.document_date)) fail('Settlement cannot predate bill recognition');
               const value = amount(line.amount), used = await trx('pharmacy_accounting_allocations').where({ branchid: this.context.branch, bill_id: bill.id }).sum('amount as amount').first();
               const latest = await trx('pharmacy_accounting_allocations').where({ branchid: this.context.branch, bill_id: bill.id }).orderBy('financial_date', 'desc').first();
               if (latest && date < accountingDate(latest.financial_date)) fail('Settlement cannot predate a later bill allocation or reversal', 'BACKDATED_ALLOCATION', 409);
               if (decimal(used?.amount).plus(value).gt(bill.amount)) fail('Allocation exceeds bill outstanding balance', 'OVERALLOCATION', 409);
               items.push({ billId: bill.id, amount: value, supplierId: bill.supplier_id, documentRef: bill.source_ref });
          }
          if (new Set(items.map(a => a.supplierId)).size !== 1) fail('One settlement must belong to one supplier');
          return { items, supplierId: items[0].supplierId, total: amount(items.reduce((s, l) => s.plus(l.amount), decimal(0)).toFixed(2)) };
     }
     async createSettlement(input: any): Promise<any> {
          return this.atomic(input, 'ap:settlement:create', async (trx, settings) => {
               const date = accountingDate(input.date), checked = await this.allocationLines(trx, input.allocations, date);
               if (input.replacesSettlementId !== undefined) {
                    if (typeof input.replacesSettlementId !== 'string' || !input.replacesSettlementId || input.replacesSettlementId.length > 36) fail('Select the original cancelled supplier payment request');
                    const original = await this.document(trx, input.replacesSettlementId, 'ap_settlement');
                    if (original.status !== 'voided') fail('Cancel the original unpaid request before preparing its replacement', 'INVALID_STATE', 409);
               }
               await pharmacyAccount(trx, this.context.branch, settings, 'payable:' + checked.supplierId);
               const id = randomUUID(), row = { id, branchid: this.context.branch, kind: 'ap_settlement', status: 'draft', version: 1, financial_date: date, amount: checked.total, description: text(input.description, 'settlement description'), created_by: this.context.actor, details: JSON.stringify({ supplierId: checked.supplierId, allocations: checked.items, ...(input.replacesSettlementId ? { replacesSettlementId: input.replacesSettlementId } : {}) }) };
               await trx('pharmacy_accounting_documents').insert(row); await this.audit(trx, 'ap:settlement:create', id, null, row);
               return { id, status: 'draft', version: 1, amount: checked.total };
          });
     }
     /** One-step supplier payment: records and posts the payment immediately, like the facility bill payment workflow. */
     async recordSupplierPayment(input: any): Promise<any> {
          return this.atomic(input, 'ap:payment:record', async (trx, settings) => {
               const date = accountingDate(input.date), checked = await this.allocationLines(trx, input.allocations, date);
               const supplier = await trx('pharmacy_suppliers').where({ id: checked.supplierId, branchid: this.context.branch }).first();
               const description = input.description == null || input.description === '' ? `Payment to ${supplier?.name || 'supplier'}` : text(input.description, 'payment note');
               const id = randomUUID(), actor = this.context.actor;
               const row: any = { id, branchid: this.context.branch, kind: 'ap_settlement', status: 'paid', version: 1, financial_date: date, amount: checked.total, description, created_by: actor, submitted_by: actor, approved_by: actor, details: { supplierId: checked.supplierId, allocations: checked.items, recordedDirectly: true } };
               await trx('pharmacy_accounting_documents').insert({ ...row, details: JSON.stringify(row.details) });
               await this.postSettlementPayment(trx, settings, row, input);
               await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch }).update({ details: JSON.stringify(row.details) });
               await this.audit(trx, 'ap:payment:record', id, null, row);
               return { id, status: 'paid', version: 1, amount: checked.total, supplierId: checked.supplierId, payment: row.details.payment };
          });
     }
     async settlementAction(id: string, action: string, input: any): Promise<any> {
          return this.atomic(input, `ap:settlement:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, 'ap_settlement'); assertVersion(row, input);
               const before = { ...row, details: { ...row.details } };
               if (!['submit', 'approve', 'pay', 'void', 'record_payment'].includes(action)) fail('Unsupported settlement action', 'UNSUPPORTED', 422);
               if (['amount', 'allocations', 'date', 'supplierId', 'accountId'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Settlement date, supplier and allocations are immutable after draft creation. Cancel this unpaid request with a reason, then prepare a replacement', 'HISTORY_PROTECTED', 409);
               if (action === 'record_payment') {
                    // Completes a pending payment request directly under the recording user's finance authority.
                    if (!['draft', 'submitted', 'approved'].includes(row.status)) fail(`Cannot record payment for a ${row.status} payment request`, 'INVALID_STATE', 409);
                    await this.postSettlementPayment(trx, settings, row, input);
                    return this.transition(trx, row, action, 'paid', input, before);
               }
               let status = action === 'void' && row.status === 'approved' ? 'voided' : assertTransition(row, action, this.context.actor);
               if (action === 'pay') {
                    if (row.status !== 'approved') fail('Settlement must be independently approved', 'INVALID_STATE', 409);
                    await this.postSettlementPayment(trx, settings, row, input);
                    status = 'paid';
               }
               return this.transition(trx, row, action, status, input, before);
          });
     }
     private async postSettlementPayment(trx: Knex.Transaction, settings: any, row: any, input: any): Promise<void> {
          const id = row.id, date = accountingDate(row.financial_date), checked = await this.allocationLines(trx, row.details.allocations, date);
          if (checked.supplierId !== row.details.supplierId || !decimal(checked.total).eq(row.amount)) fail('Settlement allocation identity changed', 'SOURCE_MISMATCH', 409);
          await pharmacyAccount(trx, this.context.branch, settings, 'payable:' + checked.supplierId);
          const balance = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where({ 'j.branchid': this.context.branch, 'l.account_code': 'payable:' + checked.supplierId }).sum('l.debit as debit').sum('l.credit as credit').first();
          if (decimal(balance?.credit).minus(balance?.debit || 0).lt(checked.total)) fail('Supplier control balance is insufficient; resolve unallocated payments/credits', 'PAYABLE_RECONCILIATION_REQUIRED', 409);
          const destination = await this.destination(trx, input.method, date);
          await pharmacyAccount(trx, this.context.branch, settings, 'collection:' + destination.account.id);
          const reference = await this.paymentReference(trx, destination.account.id, input.reference, input.method);
          await this.postingAllowed(trx, date);
          await postPharmacyJournal(trx, this.context.branch, id, 'supplier_settlement', row.description, this.context.actor, [...checked.items.map(a => ({ account: 'payable:' + checked.supplierId, debit: Number(a.amount), documentRef: a.documentRef })), { account: 'collection:' + destination.account.id, credit: Number(checked.total) }], date);
          for (const allocation of checked.items) await trx('pharmacy_accounting_allocations').insert({ id: randomUUID(), branchid: this.context.branch, bill_id: allocation.billId, document_id: id, kind: 'supplier_settlement', financial_date: date, amount: allocation.amount, created_by: this.context.actor });
          await trx('pharmacy_documents').insert({ id, branchid: this.context.branch, kind: 'supplier_payment', request_key: 'accounting:settlement:' + id, request_hash: stableHash(input), supplier_id: checked.supplierId, amount: checked.total, created_by: this.context.actor, details: JSON.stringify({ description: row.description, method: input.method, reference, accountId: destination.account.id, shiftId: destination.shift?.id || null, settlementId: id }) });
          row.details.payment = { accountId: destination.account.id, method: input.method, reference };
     }
     async invoiceDueDate(saleId: string, input: any): Promise<any> {
          return this.atomic(input, `ar:terms:${saleId}`, async trx => {
               const sale = await this.sale(trx, saleId), due = accountingDate(input.dueDate), reason = text(input.reason, 'invoice terms evidence');
               if (due < accountingDate(sale.completed_at)) fail('Invoice dueDate cannot precede invoice date');
               if (await trx('pharmacy_accounting_invoice_terms').where({ sale_id: sale.id }).forUpdate().first()) fail('Recorded invoice terms are immutable. Use Correct due date in customer invoice aging, then submit it for independent review', 'HISTORY_PROTECTED', 409);
               const row = { sale_id: sale.id, branchid: this.context.branch, due_date: due, reason, created_by: this.context.actor };
               await trx('pharmacy_accounting_invoice_terms').insert(row); await this.audit(trx, 'ar:terms', sale.id, null, row); return row;
          });
     }
     private async sale(trx: Knex.Transaction, id: string): Promise<any> {
          if (typeof id !== 'string' || !id || id.length > 36) fail('Supply the original saleId');
          const sale = await trx('pharmacy_sales').where({ id, branchid: this.context.branch, accounting_version: 3, status: 'completed' }).forUpdate().first();
          if (!sale || !sale.customer_account_id) fail('Completed credit invoice not found in this branch', 'NOT_FOUND', 404);
          if (!await trx('pharmacy_customer_accounts').where({ id: sale.customer_account_id, branchid: this.context.branch }).forUpdate().first()) fail('Invoice customer account is not in this branch', 'NOT_FOUND', 404);
          return sale;
     }
     async createAdjustment(input: any): Promise<any> {
          return this.atomic(input, 'ar:adjustment:create', async (trx, settings) => {
               const sale = await this.sale(trx, input.saleId), date = accountingDate(input.date), value = amount(input.amount);
               if (!['credit', 'writeoff'].includes(input.kind)) fail('Adjustment kind must be credit or writeoff');
               let snapshot: any;
               if (input.kind === 'credit') {
                    snapshot = await new PharmacyAccountingTaxCredits(this.db, this.context).snapshots(trx, sale);
                    if ((snapshot.taxed || input.taxPolicy !== undefined) && input.taxPolicy !== TAX_CREDIT_POLICY) fail('Taxed credits require explicit taxPolicy original_gross_proportional_v1 based on frozen sale snapshots', 'TAX_CREDIT_POLICY_REQUIRED', 422);
               } else if (input.taxPolicy !== undefined) fail('Writeoffs do not reverse VAT or accept a tax-relief policy', 'UNSUPPORTED_TAX_RELIEF', 422);
               if (date < accountingDate(sale.completed_at) || decimal(value).gt(sale.outstanding_amount)) fail('Adjustment must follow invoice date and be within its outstanding balance');
               const counterpart = await pharmacyAccount(trx, this.context.branch, settings, input.account);
               if (counterpart.type !== (input.kind === 'credit' ? 'revenue' : 'expense')) fail('Credit requires a revenue contra-account; writeoff requires an expense account');
               await pharmacyAccount(trx, this.context.branch, settings, 'receivable:' + sale.customer_account_id);
               const id = randomUUID(), reason = text(input.reason, 'adjustment evidence');
               const details = { saleId: sale.id, customerAccountId: sale.customer_account_id, adjustmentKind: input.kind, account: input.account, reason, ...(snapshot ? { taxPolicy: TAX_CREDIT_POLICY, taxSnapshotHash: snapshot.hash } : {}) };
               await trx('pharmacy_accounting_documents').insert({ id, branchid: this.context.branch, kind: 'ar_adjustment', status: 'draft', version: 1, financial_date: date, description: reason, amount: value, created_by: this.context.actor, details: JSON.stringify(details) });
               await this.audit(trx, 'ar:adjustment:create', id, null, { id, date, amount: value, details }); return { id, status: 'draft', version: 1 };
          });
     }
     async adjustmentAction(id: string, action: string, input: any): Promise<any> {
          return this.atomic(input, `ar:adjustment:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, 'ar_adjustment'); assertVersion(row, input);
               const before = { ...row, details: { ...row.details } };
               if (!['submit', 'approve', 'post', 'void'].includes(action)) fail('Unsupported adjustment action', 'UNSUPPORTED', 422);
               if (['amount', 'account', 'date', 'saleId', 'kind'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Adjustment financial terms are immutable after draft creation');
               const status = assertTransition(row, action, this.context.actor);
               if (action === 'post') {
                    const sale = await this.sale(trx, row.details.saleId);
                    if (Number(sale.customer_account_id) !== Number(row.details.customerAccountId) || decimal(row.amount).gt(sale.outstanding_amount)) fail('Invoice changed; adjustment exceeds the remaining balance', 'OVERADJUSTMENT', 409);
                    await pharmacyAccount(trx, this.context.branch, settings, row.details.account);
                    await pharmacyAccount(trx, this.context.branch, settings, 'receivable:' + sale.customer_account_id);
                    const date = accountingDate(row.financial_date);
                    const corrections = await trx('pharmacy_accounting_documents').where({ branchid: this.context.branch }).whereIn('kind', ['ar_adjustment', 'ar_reversal']).whereIn('status', ['posted', 'reversed']).select('financial_date', 'details');
                    if (corrections.some(c => json(c.details).saleId === sale.id && accountingDate(c.financial_date) > date)) fail('Correction cannot predate a later posted invoice correction or reversal', 'BACKDATED_ADJUSTMENT', 409);
                    await this.postingAllowed(trx, date);
                    const debit = row.details.adjustmentKind === 'credit'
                         ? await new PharmacyAccountingTaxCredits(this.db, this.context).credit(trx, sale, row, settings)
                         : { lines: [{ account: row.details.account, debit: Number(row.amount), documentRef: sale.id }], net: String(row.amount), tax: '0.00' };
                    row.details.postedTax = { net: debit.net, tax: debit.tax };
                    await postPharmacyJournal(trx, this.context.branch, id, 'receivable_adjustment', row.description, this.context.actor, [...debit.lines, { account: 'receivable:' + sale.customer_account_id, credit: Number(row.amount), documentRef: sale.id }], date);
                    await trx('pharmacy_sales').where({ id: sale.id, branchid: this.context.branch }).update({ outstanding_amount: decimal(sale.outstanding_amount).minus(row.amount).toFixed(2) });
                    // paid_amount remains actual money collected, not a fictional cash receipt.
               }
               return this.transition(trx, row, action, status, input, before);
          });
     }
     private async transition(trx: Knex.Transaction, row: any, action: string, status: string, input: any, before = row): Promise<any> {
          if (action === 'void') text(input.reason, 'void evidence');
          const next: any = { status, version: Number(row.version) + 1, details: JSON.stringify(row.details), updated_at: new Date() };
          if (action === 'submit') next.submitted_by = this.context.actor;
          if (action === 'approve') next.approved_by = this.context.actor;
          if (action === 'record_payment') { next.submitted_by = row.submitted_by ?? this.context.actor; next.approved_by = row.approved_by ?? this.context.actor; }
          await trx('pharmacy_accounting_documents').where({ id: row.id, branchid: this.context.branch }).update(next);
          const result = { id: row.id, status, version: next.version };
          await this.audit(trx, row.kind + ':' + action, row.id, before, { ...result, reason: input.reason || null }); return result;
     }
     async destination(trx: Knex.Transaction, method: any, date: string): Promise<any> {
          if (!['cash', 'card', 'mobile_money'].includes(method)) fail('Select cash, card or mobile_money');
          const account = await resolvePharmacyDestination(trx, this.context.branch, method);
          const shift = method === 'cash' ? await trx('pharmacy_shifts').where({ active_key: `${this.context.branch}:${this.context.actor}`, financial_date: date }).forUpdate().first() : null;
          if (method === 'cash' && !shift) fail('An open cash shift for the posting date is required. Open Cashier & shift; if this request has the wrong date, cancel it and prepare a replacement', 'CASH_SHIFT_REQUIRED', 409);
          return { account, shift };
     }
     async paymentReference(trx: Knex.Transaction, accountId: number, ref: any, method: string): Promise<string | null> {
          const reference = ref == null ? null : text(ref, 'external payment reference', 128);
          if (method !== 'cash' && !reference) fail('Non-cash settlement requires an external reference from the actual bank, card or mobile money transaction', 'PAYMENT_REFERENCE_REQUIRED', 422);
          if (reference) {
               const documents = await trx('pharmacy_documents').where({ branchid: this.context.branch, kind: 'supplier_payment' }).select('details');
               if (documents.some(d => { const detail = json(d.details); return Number(detail.accountId) === Number(accountId) && detail.reference === reference; })) fail('External payment reference already recorded', 'DUPLICATE_REFERENCE', 409);
          }
          return reference;
     }
     async bills(query: any = {}): Promise<any> { return this.payableAging({ ...query, asOf: query.asOf || today() }); }
     async payableAging(query: any): Promise<any> {
          const asOf = accountingDate(query.asOf || today());
          const [bills, allocations, control, suppliers, amendments] = await Promise.all([
               this.db('pharmacy_accounting_bills').where({ branchid: this.context.branch }).where('document_date', '<=', asOf).orderBy('document_date'),
               this.db('pharmacy_accounting_allocations').where({ branchid: this.context.branch }).where('financial_date', '<=', asOf),
               this.control('payable:', asOf),
               this.db('pharmacy_suppliers').where({ branchid: this.context.branch }).select('id', 'name'),
               this.postedTerms('payables', asOf),
          ]);
          const supplierNames = new Map<string, string>((suppliers || []).map((s: any) => [String(s.id), s.name]));
          const items = bills.map(b => {
               const paid = allocations.filter(a => a.bill_id === b.id).reduce((s, a) => s.plus(a.amount), decimal(0));
               const due = effectiveTerms(b.id, b.due_date, amendments).dueDate;
               return { ...b, supplier_name: supplierNames.get(String(b.supplier_id)) ?? null, due_date: due, allocated_amount: paid.toFixed(2), outstanding_amount: decimal(b.amount).minus(paid).toFixed(2), bucket: agingBucket(due, asOf) };
          });
          return this.agingResult(items, control, asOf, 'payable:');
     }
     async receivableAging(query: any): Promise<any> {
          const asOf = accountingDate(query.asOf || today());
          const [sales, terms, events, adjustments, lines, control, amendments] = await Promise.all([
               this.db('pharmacy_sales').where({ branchid: this.context.branch, accounting_version: 3 }).whereNotNull('customer_account_id').whereRaw('DATE(completed_at) <= ?', [asOf]),
               this.db('pharmacy_accounting_invoice_terms').where({ branchid: this.context.branch }),
               this.db('pharmacy_cash_events').where({ branchid: this.context.branch }).select('id', 'sale_id'),
               this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch }).whereIn('kind', ['ar_adjustment', 'ar_reversal']).whereIn('status', ['posted', 'reversed']).select('id', 'details'),
               this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where('j.branchid', this.context.branch).where('l.account_code', 'like', 'receivable:%').where('j.financial_date', '<=', asOf).select('l.account_code', 'l.debit', 'l.credit', 'l.document_ref', 'j.source_ref'),
               this.control('receivable:', asOf),
               this.postedTerms('receivables', asOf),
          ]);
          const sources = new Map<string, string>(sales.map(s => [s.id, s.id]));
          events.forEach(e => sources.set(e.id, e.sale_id)); adjustments.forEach(a => sources.set(a.id, json(a.details).saleId));
          const items = sales.map(s => {
               const invoiceLines = lines.filter(l => (l.document_ref || sources.get(l.source_ref)) === s.id && l.account_code === 'receivable:' + s.customer_account_id);
               const outstanding = invoiceLines.reduce((v, l) => v.plus(l.debit).minus(l.credit), decimal(0));
               const due = effectiveTerms(s.id, terms.find(t => t.sale_id === s.id)?.due_date || null, amendments).dueDate;
               return { id: s.id, receipt_number: s.receipt_number, customer_account_id: s.customer_account_id, customer_name: s.customer_name, document_date: accountingDate(s.completed_at), due_date: due, outstanding_amount: outstanding.toFixed(2), bucket: agingBucket(due, asOf) };
          });
          return this.agingResult(items, control, asOf, 'receivable:');
     }
     private control(prefix: string, date: string) {
          return this.db('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where('j.branchid', this.context.branch).where('l.account_code', 'like', prefix + '%').where('j.financial_date', '<=', date).select('l.account_code').sum('l.debit as debit').sum('l.credit as credit').groupBy('l.account_code');
     }
     private agingResult(items: any[], control: any[], asOf: string, prefix: string): any {
          const buckets: Record<string, Decimal> = Object.fromEntries(['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_91_plus', 'unknown_due_date'].map(k => [k, decimal(0)]));
          items.forEach(i => { buckets[i.bucket] = buckets[i.bucket].plus(i.outstanding_amount); });
          const parties = control.map(c => {
               const partyId = c.account_code.slice(prefix.length), balance = decimal(prefix === 'payable:' ? c.credit : c.debit).minus(prefix === 'payable:' ? c.debit : c.credit);
               const assigned = items.filter(i => String(prefix === 'payable:' ? i.supplier_id : i.customer_account_id) === partyId).reduce((s, i) => s.plus(i.outstanding_amount), decimal(0));
               return { partyId, controlBalance: balance.toFixed(2), allocatedBalance: assigned.toFixed(2), unallocatedBalance: balance.minus(assigned).toFixed(2) };
          });
          const total = items.reduce((s, i) => s.plus(i.outstanding_amount), decimal(0)), ledger = parties.reduce((s, p) => s.plus(p.controlBalance), decimal(0));
          return { asOf, items, buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.toFixed(2)])), total: total.toFixed(2), reconciliation: { controlBalance: ledger.toFixed(2), allocatedBalance: total.toFixed(2), difference: ledger.minus(total).toFixed(2), reconciled: ledger.eq(total) && parties.every(p => decimal(p.unallocatedBalance).isZero()), parties }, note: 'Unknown due dates are not treated as overdue. Unregistered sources and unallocated historical payments/credits remain explicit reconciliation differences.' };
     }
}
