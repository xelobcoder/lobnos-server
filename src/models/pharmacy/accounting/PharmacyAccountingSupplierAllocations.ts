import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { PharmacyAccountingCore, accountingDate, amount, assertTransition, assertVersion, fail, positiveId, stableHash, text } from './PharmacyAccountingCore';
import { json } from '../PharmacyEnterpriseCore';
import { assertPharmacyDayOpen } from '../PharmacyLedger';

type SourceKind = 'payment' | 'credit_note';
const allocateKind = 'supplier_allocate', releaseKind = 'supplier_unallocate';
const d = (v: any) => new Decimal(v || 0);
const identifier = (v: any): string => {
     if (typeof v !== 'string' || !v || v.length > 64) fail('Supply an existing source identifier');
     return v;
};
const sourceKind = (v: any): SourceKind => {
     if (!['payment', 'credit_note'].includes(v)) fail('sourceKind must be payment or credit_note');
     return v;
};
const page = (q: any) => {
     const limit = q.limit == null ? 50 : Number(q.limit), offset = q.offset == null ? 0 : Number(q.offset);
     if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail('Use limit 1-100 and nonnegative offset up to 100000');
     return { limit, offset };
};

/** Future correction-path prerequisite; current legacy payment creation and terminal credit
 * confirmation expose no source-correction method, so neither is a caller of this helper.
 * Call inside the ORIGINAL source-correction transaction, before changing/reversing source
 * evidence. Settings-before-source lock order matches allocation writers. Retirement rolls back
 * with the producer if its correction fails. Never call after a producer has committed.
 */
export async function retirePharmacySupplierAllocationSource(trx: Knex.Transaction, input: {
     branch: number; actor: number; sourceKind: SourceKind; sourceRef: string; reason: string;
}): Promise<void> {
     const branch = positiveId(input.branch), actor = positiveId(input.actor), kind = sourceKind(input.sourceKind), ref = identifier(input.sourceRef);
     const reason = text(input.reason, 'source correction evidence');
     await trx('pharmacy_accounting_settings').where({ branchid: branch }).forUpdate().first();
     const source = await trx('pharmacy_accounting_supplier_sources').where({ branchid: branch, source_kind: kind, source_ref: ref }).forUpdate().first();
     if (source) {
          const uses = await trx('pharmacy_accounting_supplier_uses').where({ branchid: branch, source_id: source.id }).sum('amount as amount').first();
          if (!d(uses?.amount).isZero()) fail('Release all reviewed supplier allocations before correcting this source', 'SOURCE_ALLOCATED', 409);
          const pending = await trx('pharmacy_accounting_documents').where({ branchid: branch })
               .where({ supplier_source_id: source.id }).whereIn('kind', [allocateKind, releaseKind]).whereIn('status', ['draft', 'submitted', 'approved']).forUpdate().first();
          if (pending) fail('Void pending allocation requests before correcting this source', 'SOURCE_REVIEW_PENDING', 409);
          if (source.status === 'retired') return;
     }
     const original = kind === 'payment'
          ? await trx('pharmacy_documents').where({ branchid: branch, id: ref, kind: 'supplier_payment' }).forUpdate().first()
          : await trx('pharmacy_workflows').where({ branchid: branch, id: ref, kind: 'supplier_return' }).forUpdate().first();
     if (!original) fail('Original supplier source not found in this branch', 'NOT_FOUND', 404);
     // Tombstone even an unregistered source: a later registration must not revive corrected cash/AP.
     const key = { branchid: branch, source_kind: kind, source_ref: ref };
     if (await trx('pharmacy_accounting_supplier_retirements').where(key).forUpdate().first()) return;
     await trx('pharmacy_accounting_supplier_retirements').insert({ ...key, created_by: actor, reason });
     if (source) await trx('pharmacy_accounting_supplier_sources').where({ id: source.id, branchid: branch }).update({ status: 'retired', retired_at: trx.fn.now(), retired_by: actor, retirement_reason: reason });
     await trx('pharmacy_accounting_audit').insert({ branchid: branch, actor_id: actor, action: 'ap:source:retire', entity_id: source?.id || ref,
          before_state: source ? JSON.stringify(source) : null, after_state: JSON.stringify({ ...key, status: 'retired', reason }) });
}

/** Attribution ONLY: no cash movement and no second payable/expense/inventory recognition.
 * The existing source journal is frozen evidence; signed allocations explain its application.
 */
export class PharmacyAccountingSupplierAllocations extends PharmacyAccountingCore {
     private async evidence(trx: Knex.Transaction, kind: SourceKind, ref: string): Promise<any> {
          let original: any, details: any, supplierId: string, value: string, journalKind: string;
          if (kind === 'payment') {
               original = await trx('pharmacy_documents').where({ id: ref, branchid: this.context.branch, kind: 'supplier_payment' }).forUpdate().first();
               if (!original) fail('Posted supplier payment not found in this branch', 'NOT_FOUND', 404);
               details = json(original.details); supplierId = String(original.supplier_id || ''); value = amount(original.amount); journalKind = 'supplier_payment';
               if (String(original.request_key).startsWith('accounting:') || details.accountingWorkflow || details.expenseId || details.settlementId || details.direction ||
                    !['cash', 'card', 'mobile_money'].includes(details.method)) fail('Only original legacy supplier payments are eligible; managed payments/refunds cannot be allocated twice', 'INELIGIBLE_SOURCE', 409);
          } else {
               original = await trx('pharmacy_workflows').where({ id: ref, branchid: this.context.branch, kind: 'supplier_return', status: 'credited' }).forUpdate().first();
               if (!original) fail('Confirmed supplier credit note not found in this branch', 'NOT_FOUND', 404);
               details = json(original.details); supplierId = String(details.supplierId || ''); value = amount(details.creditAmount); journalKind = 'supplier_credit';
               text(details.creditReference, 'original supplier credit reference', 128);
               const receipt = await trx('pharmacy_documents').where({ id: details.receiptId, branchid: this.context.branch, kind: 'receipt', supplier_id: supplierId }).forUpdate().first();
               if (!receipt) fail('Credit note original receipt does not belong to this supplier/branch', 'SOURCE_MISMATCH', 409);
          }
          if (await trx('pharmacy_accounting_supplier_retirements').where({ branchid: this.context.branch, source_kind: kind, source_ref: ref }).forUpdate().first()) fail('Supplier source was retired by a financial correction', 'SOURCE_RETIRED', 409);
          if (!await trx('pharmacy_suppliers').where({ id: supplierId, branchid: this.context.branch }).forUpdate().first()) fail('Source supplier not found in this branch', 'SOURCE_MISMATCH', 409);
          const journals = await trx('pharmacy_journals').where({ branchid: this.context.branch, source_ref: ref }).orderBy('id').forUpdate();
          const headers = journals.filter(j => j.kind === journalKind);
          if (headers.length !== 1) fail('Source requires exactly one original posted journal', 'SOURCE_MISMATCH', 409);
          const header = headers[0], rows = await trx('pharmacy_journal_lines').where({ journal_id: header.id }).orderBy('id').forUpdate();
          const lines = rows.map(l => ({ id: l.id, account: l.account_code, debit: amount(l.debit || 0, false, true), credit: amount(l.credit || 0, false, true), documentRef: l.document_ref || null }));
          if (lines.length < 2 || !lines.reduce((s, l) => s.plus(l.debit).minus(l.credit), d(0)).isZero() ||
               lines.some(l => d(l.debit).gt(0) === d(l.credit).gt(0))) fail('Source journal is not balanced authentic posting evidence', 'SOURCE_MISMATCH', 409);
          const payable = lines.filter(l => l.account.startsWith('payable:'));
          if (payable.length !== 1 || payable[0].account !== 'payable:' + supplierId || !d(payable[0].debit).eq(value) || !d(payable[0].credit).isZero()) fail('Source supplier debit does not match confirmed amount', 'SOURCE_MISMATCH', 409);
          if (kind === 'payment') {
               const accountId = positiveId(details.accountId, 'original payment account');
               if (!await trx('pharmacy_collection_accounts').where({ id: accountId, branchid: this.context.branch }).first()) fail('Original collection account is outside this branch', 'SOURCE_MISMATCH', 409);
               if (lines.length !== 2 || !lines.some(l => l.account === 'collection:' + accountId && d(l.credit).eq(value) && d(l.debit).isZero())) fail('Original payment destination evidence does not reconcile', 'SOURCE_MISMATCH', 409);
          }
          // Other source journals containing AP represent a source correction, not unused capacity.
          for (const other of journals.filter(j => j.id !== header.id)) {
               if (await trx('pharmacy_journal_lines').where({ journal_id: other.id }).where('account_code', 'like', 'payable:%').first()) fail('Original supplier source has correction evidence', 'SOURCE_CORRECTED', 409);
          }
          const snapshot = { sourceKind: kind, sourceRef: ref, supplierId, amount: value, financialDate: accountingDate(header.financial_date), journalId: header.id,
               source: { id: original.id, requestHash: original.request_hash || null, version: original.version || null, status: original.status || null, createdBy: original.created_by, details }, lines };
          return { ...snapshot, hash: stableHash(snapshot) };
     }
     private async source(trx: Knex.Transaction, id: string, verify = true): Promise<any> {
          const row = await trx('pharmacy_accounting_supplier_sources').where({ id, branchid: this.context.branch }).forUpdate().first();
          if (!row) fail('Registered supplier source not found in this branch', 'NOT_FOUND', 404);
          if (row.status !== 'available') fail('Supplier source was retired by a financial correction', 'SOURCE_RETIRED', 409);
          if (verify) {
               const evidence = await this.evidence(trx, row.source_kind, row.source_ref);
               if (evidence.hash !== row.source_hash || evidence.journalId !== row.journal_id || !d(evidence.amount).eq(row.amount)) fail('Original supplier evidence changed after registration', 'SOURCE_MISMATCH', 409);
          }
          return row;
     }
     async register(input: any): Promise<any> {
          return this.atomic(input, 'ap:source:register', async trx => {
               const kind = sourceKind(input.sourceKind), ref = identifier(input.sourceRef);
               if (await trx('pharmacy_accounting_supplier_sources').where({ branchid: this.context.branch, source_kind: kind, source_ref: ref }).first()) fail('Source already registered', 'DUPLICATE_SOURCE', 409);
               const evidence = await this.evidence(trx, kind, ref);
               const row = { id: randomUUID(), branchid: this.context.branch, supplier_id: evidence.supplierId, source_kind: kind, source_ref: ref,
                    journal_id: evidence.journalId, source_hash: evidence.hash, amount: evidence.amount, financial_date: evidence.financialDate,
                    evidence: JSON.stringify(evidence), registered_by: this.context.actor, status: 'available' };
               await trx('pharmacy_accounting_supplier_sources').insert(row); await this.audit(trx, 'ap:source:register', row.id, null, row);
               return { id: row.id, sourceKind: kind, sourceRef: ref, supplierId: row.supplier_id, amount: row.amount, allocatedAmount: '0.00', availableAmount: row.amount, financialDate: row.financial_date, status: row.status };
          });
     }
     async sources(q: any = {}): Promise<any> {
          const { limit, offset } = page(q);
          let query = this.db('pharmacy_accounting_supplier_sources').where({ branchid: this.context.branch });
          if (q.sourceKind) query = query.where({ source_kind: sourceKind(q.sourceKind) });
          if (q.supplierId) query = query.where({ supplier_id: identifier(q.supplierId) });
          const rows = await query.orderBy('created_at', 'desc').orderBy('id').limit(limit).offset(offset), items = [];
          for (const row of rows) {
               const used = await this.db('pharmacy_accounting_supplier_uses').where({ branchid: this.context.branch, source_id: row.id }).sum('amount as amount').first();
               items.push({ id: row.id, sourceKind: row.source_kind, sourceRef: row.source_ref, supplierId: row.supplier_id, journalId: row.journal_id,
                    financialDate: accountingDate(row.financial_date), amount: amount(row.amount), allocatedAmount: d(used?.amount).toFixed(2),
                    unappliedAmount: d(row.amount).minus(used?.amount || 0).toFixed(2), availableAmount: row.status === 'available' ? d(row.amount).minus(used?.amount || 0).toFixed(2) : '0.00', status: row.status });
          }
          return { items, limit, offset };
     }
     async candidates(q: any = {}): Promise<any> {
          const { limit, offset } = page(q), kind = sourceKind(q.sourceKind), items = [];
          return this.db.transaction(async trx => {
               let query = kind === 'payment' ? trx('pharmacy_documents').where({ branchid: this.context.branch, kind: 'supplier_payment' }).where('amount', '>', 0)
                    : trx('pharmacy_workflows').where({ branchid: this.context.branch, kind: 'supplier_return', status: 'credited' });
               if (q.supplierId && kind === 'payment') query = query.where({ supplier_id: identifier(q.supplierId) });
               const rows = await query.orderBy('created_at', 'desc').orderBy('id').limit(limit).offset(offset);
               for (const row of rows) {
                    if (await trx('pharmacy_accounting_supplier_sources').where({ branchid: this.context.branch, source_kind: kind, source_ref: row.id }).first()) continue;
                    try {
                         const evidence = await this.evidence(trx, kind, row.id);
                         if (q.supplierId && evidence.supplierId !== identifier(q.supplierId)) continue;
                         items.push({ sourceKind: kind, sourceRef: row.id, supplierId: evidence.supplierId, amount: evidence.amount, financialDate: evidence.financialDate, journalId: evidence.journalId });
                    } catch (e: any) { if (!e?.code || !['INELIGIBLE_SOURCE', 'SOURCE_MISMATCH', 'SOURCE_CORRECTED', 'SOURCE_RETIRED', 'INVALID_REQUEST', 'NOT_FOUND'].includes(e.code)) throw e; }
               }
               return { items, limit, offset, scanned: rows.length, nextOffset: rows.length === limit ? offset + limit : null };
          });
     }
     private async validate(trx: Knex.Transaction, source: any, allocations: any, date: string): Promise<{ items: any[]; total: string }> {
          if (!Array.isArray(allocations) || !allocations.length || allocations.length > 100 ||
               allocations.some(l => !l || typeof l.billId !== 'string' || !l.billId) || new Set(allocations.map(l => l.billId)).size !== allocations.length) fail('Select 1-100 distinct bills');
          if (date < accountingDate(source.financial_date)) fail('Allocation cannot predate its original supplier source', 'BACKDATED_ALLOCATION', 409);
          const sourceLatest = await trx('pharmacy_accounting_supplier_uses').where({ source_id: source.id, branchid: this.context.branch }).orderBy('financial_date', 'desc').first();
          if (sourceLatest && date < accountingDate(sourceLatest.financial_date)) fail('Allocation cannot predate later source applications/releases', 'BACKDATED_ALLOCATION', 409);
          const items = [];
          for (const line of [...allocations].sort((a, b) => a.billId.localeCompare(b.billId))) {
               const bill = await trx('pharmacy_accounting_bills').where({ id: line.billId, branchid: this.context.branch, supplier_id: source.supplier_id }).forUpdate().first();
               if (!bill) fail('Bill does not belong to this supplier/branch', 'NOT_FOUND', 404);
               if (date < accountingDate(bill.document_date)) fail('Allocation cannot predate bill recognition', 'BACKDATED_ALLOCATION', 409);
               // Revalidate the immutable original liability rather than trusting a client or stale bill.
               let sourceAmount: any;
               if (['receipt', 'supplier_invoice'].includes(bill.source_kind)) {
                    const receipt = await trx('pharmacy_documents').where({ id: bill.source_ref, branchid: this.context.branch, supplier_id: source.supplier_id, kind: bill.source_kind }).forUpdate().first();
                    sourceAmount = receipt?.amount;
               } else if (bill.source_kind === 'expense') {
                    const expense = await this.document(trx, bill.source_ref, 'expense');
                    if (expense.details.supplierId !== source.supplier_id || !['approved', 'partially_paid', 'paid'].includes(expense.status)) fail('Expense bill is not an open approved supplier liability', 'INVALID_STATE', 409);
                    sourceAmount = expense.amount;
               } else fail('Unsupported bill source', 'SOURCE_MISMATCH', 409);
               const recognition = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
                    .where({ 'j.branchid': this.context.branch, 'j.source_ref': bill.source_ref, 'l.account_code': 'payable:' + source.supplier_id }).sum('l.credit as credit').sum('l.debit as debit').first();
               if (sourceAmount == null || !d(sourceAmount).eq(bill.amount) || !d(recognition?.credit).minus(recognition?.debit || 0).eq(bill.amount)) fail('Bill original recognition changed', 'SOURCE_MISMATCH', 409);
               const current = await trx('pharmacy_accounting_allocations').where({ bill_id: bill.id, branchid: this.context.branch }).sum('amount as amount').first();
               const latest = await trx('pharmacy_accounting_allocations').where({ bill_id: bill.id, branchid: this.context.branch }).orderBy('financial_date', 'desc').first();
               if (latest && date < accountingDate(latest.financial_date)) fail('Allocation cannot predate a later bill allocation/reversal', 'BACKDATED_ALLOCATION', 409);
               const value = amount(line.amount);
               if (d(current?.amount).lt(0) || d(current?.amount).plus(value).gt(bill.amount)) fail('Allocation exceeds bill outstanding', 'OVERALLOCATION', 409);
               items.push({ billId: bill.id, documentRef: bill.source_ref, amount: value });
          }
          const total = amount(items.reduce((s, l) => s.plus(l.amount), d(0)).toFixed(2));
          const used = await trx('pharmacy_accounting_supplier_uses').where({ branchid: this.context.branch, source_id: source.id }).sum('amount as amount').first();
          if (d(used?.amount).lt(0) || d(used?.amount).plus(total).gt(source.amount)) fail('Allocation exceeds original unused supplier source', 'SOURCE_OVERALLOCATION', 409);
          return { items, total };
     }
     async create(input: any): Promise<any> {
          return this.atomic(input, 'ap:allocation:create', async trx => {
               const source = await this.source(trx, identifier(input.sourceId)), date = accountingDate(input.date);
               const checked = await this.validate(trx, source, input.allocations, date);
               const row = { id: randomUUID(), branchid: this.context.branch, kind: allocateKind, supplier_source_id: source.id, status: 'draft', version: 1, financial_date: date, amount: checked.total,
                    description: text(input.reason, 'allocation review evidence'), created_by: this.context.actor,
                    details: JSON.stringify({ sourceId: source.id, sourceHash: source.source_hash, supplierId: source.supplier_id, allocations: checked.items }) };
               await trx('pharmacy_accounting_documents').insert(row); await this.audit(trx, 'ap:allocation:create', row.id, null, row);
               return { id: row.id, sourceId: source.id, status: 'draft', version: 1, amount: checked.total };
          });
     }
     async createRelease(originalId: string, input: any): Promise<any> {
          return this.atomic(input, `ap:allocation:release:create:${originalId}`, async trx => {
               const original = await this.document(trx, originalId, allocateKind);
               if (original.status !== 'posted') fail('Only a posted application can be released', 'INVALID_STATE', 409);
               const history = await trx('pharmacy_accounting_documents').where({ reversal_of: originalId }).forUpdate();
               if (history.some(r => r.status !== 'voided')) fail('An active or posted release already exists', 'REVERSAL_EXISTS', 409);
               let replaces: string = null;
               if (history.length) {
                    const prior = history.find(r => r.id === input.replacesIntentId && r.kind === releaseKind && r.branchid === this.context.branch);
                    if (!prior || history.some(r => r.replaces_intent_id === prior.id)) fail('Name the latest voided release intent in replacesIntentId', 'REPLACEMENT_REQUIRED', 409);
                    assertVersion(prior, input); replaces = prior.id;
               }
               const source = await this.source(trx, original.details.sourceId), date = accountingDate(input.date);
               if (date < accountingDate(original.financial_date)) fail('Release cannot predate application', 'BACKDATED_ALLOCATION', 409);
               const rows = await trx('pharmacy_accounting_supplier_uses').where({ branchid: this.context.branch, document_id: originalId }).orderBy('id').forUpdate();
               if (!rows.length || !rows.reduce((s, r) => s.plus(r.amount), d(0)).eq(original.amount)) fail('Original application evidence does not reconcile', 'SOURCE_MISMATCH', 409);
               await this.originalUses(trx, original, source, rows);
               const row = { id: randomUUID(), branchid: this.context.branch, kind: releaseKind, supplier_source_id: source.id, status: 'draft', version: 1, financial_date: date, amount: original.amount,
                    description: text(input.reason, 'allocation release evidence'), created_by: this.context.actor, reversal_of: originalId, replaces_intent_id: replaces,
                    details: JSON.stringify({ sourceId: source.id, sourceHash: source.source_hash, supplierId: source.supplier_id, originalUsesHash: stableHash(rows.map(r => this.useSnapshot(r))) }) };
               await trx('pharmacy_accounting_documents').insert(row); await this.audit(trx, 'ap:allocation:release:create', row.id, null, row);
               return { id: row.id, originalDocumentId: originalId, replacesIntentId: replaces, status: 'draft', version: 1, amount: amount(original.amount) };
          });
     }
     private useSnapshot(r: any): any {
          return { id: r.id, sourceId: r.source_id, billId: r.bill_id, allocationId: r.allocation_id, amount: amount(r.amount), date: accountingDate(r.financial_date) };
     }
     async action(id: string, release: boolean, action: string, input: any): Promise<any> {
          return this.atomic(input, `ap:allocation:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, release ? releaseKind : allocateKind); assertVersion(row, input);
               if (!['submit', 'approve', 'post', 'void'].includes(action)) fail('Unsupported allocation action', 'UNSUPPORTED', 422);
               if (['date', 'allocations', 'amount', 'sourceId', 'supplierId', 'accountId', 'method'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Reviewed allocation terms are immutable');
               const status = assertTransition(row, action, this.context.actor);
               if (action === 'void') text(input.reason, 'allocation void evidence');
               if (action !== 'void') {
                    const source = await this.source(trx, row.details.sourceId);
                    if (source.source_hash !== row.details.sourceHash || source.supplier_id !== row.details.supplierId) fail('Registered supplier source changed', 'SOURCE_MISMATCH', 409);
                    const date = accountingDate(row.financial_date);
                    if (action === 'post') {
                         await this.postingAllowed(trx, date);
                         await assertPharmacyDayOpen(trx, this.context.branch, date);
                         if (settings.enabled && !await trx('pharmacy_accounting_posting_links').where({ branchid: this.context.branch, journal_id: source.journal_id }).first())
                              fail('Consolidate the original supplier source before allocating it in enabled accounting', 'SOURCE_NOT_CONSOLIDATED', 409);
                         if (!release) {
                              const checked = await this.validate(trx, source, row.details.allocations, date);
                              if (!d(checked.total).eq(row.amount)) fail('Application reviewed amount changed', 'SOURCE_MISMATCH', 409);
                              if (settings.enabled) for (const line of checked.items) {
                                   const journals = await trx('pharmacy_journals as j').join('pharmacy_journal_lines as l', 'l.journal_id', 'j.id')
                                        .where({ 'j.branchid': this.context.branch, 'j.source_ref': line.documentRef, 'l.account_code': 'payable:' + source.supplier_id }).select('j.id');
                                   for (const journal of journals) if (!await trx('pharmacy_accounting_posting_links').where({ branchid: this.context.branch, journal_id: journal.id }).first())
                                        fail('Consolidate original bill recognition before applying supplier evidence', 'BILL_NOT_CONSOLIDATED', 409);
                              }
                              for (const line of checked.items) {
                                   const allocationId = randomUUID();
                                   await trx('pharmacy_accounting_allocations').insert({ id: allocationId, branchid: this.context.branch, bill_id: line.billId,
                                        document_id: id, kind: 'supplier_application', financial_date: date, amount: line.amount, created_by: this.context.actor });
                                   await trx('pharmacy_accounting_supplier_uses').insert({ id: randomUUID(), branchid: this.context.branch, source_id: source.id,
                                        document_id: id, bill_id: line.billId, allocation_id: allocationId, financial_date: date, amount: line.amount, created_by: this.context.actor });
                                   await this.syncExpense(trx, line.billId);
                              }
                         } else await this.release(trx, row, source, date);
                    }
               }
               const next: any = { status, version: Number(row.version) + 1, updated_at: new Date() };
               if (action === 'submit') next.submitted_by = this.context.actor;
               if (action === 'approve') next.approved_by = this.context.actor;
               const changed = await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch, version: row.version, status: row.status }).update(next);
               if (changed !== 1) fail('Allocation changed; reload before continuing', 'VERSION_CONFLICT', 409);
               const result = { id, sourceId: row.details.sourceId, status, version: next.version, amount: amount(row.amount) };
               await this.audit(trx, 'ap:allocation:' + action, id, row, { ...result, reason: input.reason || null }); return result;
          });
     }
     private async release(trx: Knex.Transaction, row: any, source: any, date: string): Promise<void> {
          const original = await this.document(trx, row.reversal_of, allocateKind);
          if (original.status !== 'posted' || original.details.sourceId !== source.id) fail('Original application is not posted', 'SOURCE_MISMATCH', 409);
          const uses = await trx('pharmacy_accounting_supplier_uses').where({ branchid: this.context.branch, document_id: original.id, source_id: source.id }).orderBy('id').forUpdate();
          if (!uses.length || stableHash(uses.map(r => this.useSnapshot(r))) !== row.details.originalUsesHash || !uses.reduce((s, r) => s.plus(r.amount), d(0)).eq(row.amount)) fail('Original allocation evidence changed after review', 'SOURCE_MISMATCH', 409);
          await this.originalUses(trx, original, source, uses);
          const latestSource = await trx('pharmacy_accounting_supplier_uses').where({ branchid: this.context.branch, source_id: source.id }).orderBy('financial_date', 'desc').first();
          if (latestSource && date < accountingDate(latestSource.financial_date)) fail('Release cannot predate a later supplier application', 'BACKDATED_ALLOCATION', 409);
          for (const use of [...uses].sort((a, b) => a.bill_id.localeCompare(b.bill_id))) {
               const bill = await trx('pharmacy_accounting_bills').where({ id: use.bill_id, branchid: this.context.branch, supplier_id: source.supplier_id }).forUpdate().first();
               const positive = await trx('pharmacy_accounting_allocations').where({ id: use.allocation_id, branchid: this.context.branch, bill_id: use.bill_id, document_id: original.id }).forUpdate().first();
               if (!bill || !positive || !d(positive.amount).eq(use.amount) || !d(use.amount).gt(0) || accountingDate(positive.financial_date) !== accountingDate(use.financial_date)) fail('Original bill application evidence changed', 'SOURCE_MISMATCH', 409);
               if (await trx('pharmacy_accounting_supplier_uses').where({ reversal_of_use_id: use.id }).first()) fail('Application already released', 'ALREADY_REVERSED', 409);
               const latest = await trx('pharmacy_accounting_allocations').where({ bill_id: bill.id, branchid: this.context.branch }).orderBy('financial_date', 'desc').first();
               if (latest && date < accountingDate(latest.financial_date)) fail('Release cannot predate a later bill allocation', 'BACKDATED_ALLOCATION', 409);
               const allocationId = randomUUID(), value = d(use.amount).negated().toFixed(2);
               await trx('pharmacy_accounting_allocations').insert({ id: allocationId, branchid: this.context.branch, bill_id: bill.id, document_id: row.id,
                    kind: 'supplier_unapplication', financial_date: date, amount: value, reversal_of_allocation_id: positive.id,
                    original_financial_date: accountingDate(positive.financial_date), created_by: this.context.actor });
               await trx('pharmacy_accounting_supplier_uses').insert({ id: randomUUID(), branchid: this.context.branch, source_id: source.id, document_id: row.id,
                    bill_id: bill.id, allocation_id: allocationId, financial_date: date, amount: value, reversal_of_use_id: use.id, created_by: this.context.actor });
               await this.syncExpense(trx, bill.id);
          }
          // Original application and all original positive evidence stay immutable.
     }
     private async originalUses(trx: Knex.Transaction, original: any, source: any, uses: any[]): Promise<void> {
          if (!Array.isArray(original.details.allocations) || uses.length !== original.details.allocations.length ||
               original.details.sourceId !== source.id || original.details.supplierId !== source.supplier_id) fail('Original application evidence changed', 'SOURCE_MISMATCH', 409);
          for (const use of uses) {
               const expected = original.details.allocations.find(l => l.billId === use.bill_id);
               const allocation = await trx('pharmacy_accounting_allocations').where({ id: use.allocation_id, branchid: this.context.branch,
                    document_id: original.id, bill_id: use.bill_id, kind: 'supplier_application' }).forUpdate().first();
               if (!expected || !allocation || use.source_id !== source.id || !d(use.amount).gt(0) || !d(use.amount).eq(expected.amount) ||
                    !d(allocation.amount).eq(use.amount) || use.reversal_of_use_id || allocation.reversal_of_allocation_id ||
                    accountingDate(use.financial_date) !== accountingDate(original.financial_date) || accountingDate(allocation.financial_date) !== accountingDate(use.financial_date))
                    fail('Original application evidence changed', 'SOURCE_MISMATCH', 409);
          }
     }
     private async syncExpense(trx: Knex.Transaction, billId: string): Promise<void> {
          const bill = await trx('pharmacy_accounting_bills').where({ id: billId, branchid: this.context.branch }).first();
          if (bill.source_kind !== 'expense') return;
          const expense = await this.document(trx, bill.source_ref, 'expense');
          const total = await trx('pharmacy_accounting_allocations').where({ bill_id: billId, branchid: this.context.branch }).sum('amount as amount').first();
          const external = await trx('pharmacy_accounting_supplier_uses').where({ bill_id: billId, branchid: this.context.branch }).sum('amount as amount').first();
          const outstanding = d(bill.amount).minus(total?.amount || 0);
          if (outstanding.lt(0) || outstanding.gt(bill.amount)) fail('Expense bill allocations do not reconcile', 'SOURCE_MISMATCH', 409);
          const details = { ...expense.details, externalAllocatedAmount: d(external?.amount).toFixed(2), outstandingAmount: outstanding.toFixed(2) };
          const status = ['refunded', 'partially_refunded'].includes(expense.status) ? expense.status : outstanding.isZero() ? 'paid' : outstanding.eq(bill.amount) ? 'approved' : 'partially_paid';
          const next = { details: JSON.stringify(details), status, version: Number(expense.version) + 1, updated_at: new Date() };
          await trx('pharmacy_accounting_documents').where({ id: expense.id, branchid: this.context.branch, version: expense.version }).update(next);
          await this.audit(trx, 'expenses:supplier-allocation', expense.id, expense, { ...next, details });
     }
}
