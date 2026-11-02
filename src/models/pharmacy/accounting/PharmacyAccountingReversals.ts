import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { PharmacyAccountingCore, accountingDate, amount, assertTransition, assertVersion, fail, positiveId, stableHash, text } from './PharmacyAccountingCore';
import { mappedAccount } from './PharmacyAccountingCatalogue';
import { postPharmacyJournal } from '../PharmacyLedger';
import { PharmacyAccountingSubledgers } from './PharmacyAccountingSubledgers';
import { PharmacyAccountingTaxCredits } from './PharmacyAccountingTaxCredits';

type ReversalKind = 'ap_reversal' | 'ar_reversal';
/** Reviewed corrections never overwrite original journals, allocations or tax snapshots. */
export class PharmacyAccountingReversals extends PharmacyAccountingCore {
     private async original(trx: Knex.Transaction, id: string, kind: ReversalKind): Promise<any> {
          const row = await this.document(trx, id, kind === 'ap_reversal' ? 'ap_settlement' : 'ar_adjustment');
          if (row.status !== (kind === 'ap_reversal' ? 'paid' : 'posted')) fail('Original document is not posted or is already reversed', 'INVALID_STATE', 409);
          return row;
     }
     private async journal(trx: Knex.Transaction, original: any, kind: ReversalKind): Promise<any> {
          const header = await trx('pharmacy_journals').where({ source_ref: original.id, branchid: this.context.branch, kind: kind === 'ap_reversal' ? 'supplier_settlement' : 'receivable_adjustment' }).forUpdate().first();
          if (!header || accountingDate(header.financial_date) !== accountingDate(original.financial_date)) fail('Original posting evidence is missing or inconsistent', 'SOURCE_MISMATCH', 409);
          const rows = await trx('pharmacy_journal_lines').where({ journal_id: header.id }).orderBy('id').forUpdate();
          const lines = rows.map(l => ({ id: l.id, account: l.account_code, debit: amount(l.debit || 0, false, true), credit: amount(l.credit || 0, false, true), documentRef: l.document_ref || undefined }));
          if (lines.length < 2 || !lines.reduce((s, l) => s.plus(l.debit).minus(l.credit), new Decimal(0)).isZero() || !lines.some(l => new Decimal(l.debit).gt(0))) fail('Original journal evidence is not balanced', 'SOURCE_MISMATCH', 409);
          const snapshot = { journalId: header.id, financialDate: accountingDate(header.financial_date), lines };
          return { ...snapshot, hash: stableHash(snapshot) };
     }
     private async allocations(trx: Knex.Transaction, original: any): Promise<any[]> {
          const rows = await trx('pharmacy_accounting_allocations').where({ branchid: this.context.branch, document_id: original.id, kind: 'supplier_settlement' }).orderBy('id').forUpdate();
          if (!rows.length || rows.length !== original.details.allocations.length || !rows.reduce((s, r) => s.plus(r.amount), new Decimal(0)).eq(original.amount)) fail('Original settlement allocations do not reconcile', 'SOURCE_MISMATCH', 409);
          for (const row of rows) {
               if (!new Decimal(row.amount).gt(0) || accountingDate(row.financial_date) !== accountingDate(original.financial_date)) fail('Original allocation amount/date changed', 'SOURCE_MISMATCH', 409);
               const expected = original.details.allocations.find(a => a.billId === row.bill_id);
               if (!expected || !new Decimal(expected.amount).eq(row.amount)) fail('Original bill allocation changed', 'SOURCE_MISMATCH', 409);
               const bill = await trx('pharmacy_accounting_bills').where({ id: row.bill_id, branchid: this.context.branch, supplier_id: original.details.supplierId }).forUpdate().first();
               if (!bill) fail('Original bill is not in this supplier/branch', 'SOURCE_MISMATCH', 409);
               if (await trx('pharmacy_accounting_allocations').where({ reversal_of_allocation_id: row.id }).first()) fail('Original allocation is already reversed', 'ALREADY_REVERSED', 409);
          }
          return rows.map(r => ({ id: r.id, billId: r.bill_id, amount: amount(r.amount), date: accountingDate(r.financial_date) }));
     }
     async replace(voidedId: string, kind: ReversalKind, input: any): Promise<any> {
          // Resolve only within authenticated branch; create() re-locks and checks the predecessor
          // in its atomic transaction, so this preliminary read grants no state authority.
          const prior = await this.db('pharmacy_accounting_documents').where({ id: voidedId, branchid: this.context.branch, kind }).first();
          if (!prior) fail('Reversal intent not found in this branch', 'NOT_FOUND', 404);
          return this.create(prior.reversal_of, kind, input, voidedId);
     }
     async create(originalId: string, kind: ReversalKind, input: any, predecessorId?: string): Promise<any> {
          return this.atomic(input, `${kind}:create:${originalId}:${predecessorId || 'initial'}`, async trx => {
               const original = await this.original(trx, originalId, kind);
               const history = await trx('pharmacy_accounting_documents').where({ reversal_of: originalId }).forUpdate();
               if (history.some(r => r.status !== 'voided')) fail('An active or posted reversal already exists', 'REVERSAL_EXISTS', 409);
               if (predecessorId) {
                    const prior = history.find(r => r.id === predecessorId && r.branchid === this.context.branch && r.kind === kind);
                    if (!prior || prior.status !== 'voided') fail('Only a voided reversal intent can be replaced', 'INVALID_STATE', 409);
                    assertVersion(prior, input);
                    if (history.some(r => r.replaces_intent_id === predecessorId)) fail('This voided intent was already replaced; replace the latest voided intent', 'REVERSAL_EXISTS', 409);
               } else if (history.length) fail('Use the explicit replacement endpoint for the voided intent', 'REPLACEMENT_REQUIRED', 409);
               if (['amount', 'allocations', 'account', 'accountId', 'saleId', 'supplierId'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Reversal always uses the exact original amount, lines and destination');
               const date = accountingDate(input.date), reason = text(input.reason, 'reviewed reversal reason');
               if (date < accountingDate(original.financial_date)) fail('Reversal cannot predate the original posting');
               const journal = await this.journal(trx, original, kind);
               const details: any = { originalDocumentId: original.id, originalJournalId: journal.journalId, originalJournalHash: journal.hash };
               if (kind === 'ap_reversal') {
                    if (!original.details.payment) fail('Original settlement payment evidence is missing', 'SOURCE_MISMATCH', 409);
                    details.supplierId = original.details.supplierId; details.payment = original.details.payment;
                    details.allocations = await this.allocations(trx, original);
               } else {
                    details.saleId = original.details.saleId; details.customerAccountId = original.details.customerAccountId; details.adjustmentKind = original.details.adjustmentKind;
               }
               if (predecessorId) details.replacesIntentId = predecessorId;
               const row = { id: randomUUID(), branchid: this.context.branch, kind, status: 'draft', version: 1, financial_date: date, description: reason, amount: original.amount, reversal_of: original.id, replaces_intent_id: predecessorId || null, created_by: this.context.actor, details: JSON.stringify(details) };
               await trx('pharmacy_accounting_documents').insert(row); await this.audit(trx, kind + ':create', row.id, null, { ...row, details });
               return { id: row.id, originalDocumentId: original.id, replacesIntentId: predecessorId || null, status: 'draft', version: 1, amount: amount(original.amount) };
          });
     }
     async action(id: string, kind: ReversalKind, action: string, input: any): Promise<any> {
          return this.atomic(input, `${kind}:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, kind); assertVersion(row, input);
               if (!['submit', 'approve', 'post', 'void'].includes(action)) fail('Unsupported reversal action', 'UNSUPPORTED', 422);
               if (['amount', 'allocations', 'date', 'account', 'accountId', 'method', 'paymentId', 'saleId'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Approved reversal financial terms are immutable');
               const status = assertTransition(row, action, this.context.actor);
               if (action === 'void') text(input.reason, 'reversal void evidence');
               if (action === 'post') {
                    const original = await this.original(trx, row.reversal_of, kind), journal = await this.journal(trx, original, kind);
                    if (journal.hash !== row.details.originalJournalHash || journal.journalId !== row.details.originalJournalId || !new Decimal(row.amount).eq(original.amount)) fail('Original financial evidence changed after reversal review', 'SOURCE_MISMATCH', 409);
                    const date = accountingDate(row.financial_date);
                    if (date < accountingDate(original.financial_date)) fail('Reversal cannot predate the original');
                    const reversed = journal.lines.map(l => ({ account: l.account, debit: Number(l.credit), credit: Number(l.debit), ...(l.documentRef ? { documentRef: l.documentRef } : {}) }));
                    for (const line of reversed) await mappedAccount(trx, this.context.branch, settings.mappings, line.account);
                    await this.postingAllowed(trx, date);
                    if (kind === 'ap_reversal') {
                         const allocations = await this.allocations(trx, original);
                         if (stableHash(allocations) !== stableHash(row.details.allocations) || stableHash(original.details.payment) !== stableHash(row.details.payment)) fail('Original settlement allocation/payment identity changed', 'SOURCE_MISMATCH', 409);
                         if (input.confirmedReceived !== true) fail('Confirm that the original payment was actually returned or cancelled with funds restored', 'FUNDS_RETURN_EVIDENCE_REQUIRED', 422);
                         const payment = row.details.payment, accountId = positiveId(payment.accountId);
                         if (!['cash', 'card', 'mobile_money'].includes(payment.method)) fail('Original settlement payment method is invalid', 'SOURCE_MISMATCH', 409);
                         const account = await trx('pharmacy_collection_accounts').where({ id: accountId, branchid: this.context.branch, is_active: true, currency: 'GHS', account_type: payment.method === 'card' ? 'bank' : payment.method }).forUpdate().first();
                         if (!account) fail('Original payment destination is unavailable in this branch');
                         const cashLines = journal.lines.filter(l => l.account.startsWith('collection:'));
                         if (cashLines.length !== 1 || cashLines[0].account !== 'collection:' + accountId || !new Decimal(cashLines[0].credit).eq(row.amount) || !new Decimal(cashLines[0].debit).isZero()) fail('Original payment does not match the reviewed journal', 'SOURCE_MISMATCH', 409);
                         const shift = payment.method === 'cash' ? await trx('pharmacy_shifts').where({ active_key: `${this.context.branch}:${this.context.actor}`, financial_date: date }).forUpdate().first() : null;
                         if (payment.method === 'cash' && !shift) fail('An open cash shift is required for returned settlement cash');
                         const reference = await new PharmacyAccountingSubledgers(this.db, this.context).paymentReference(trx, accountId, input.reference, payment.method);
                         await postPharmacyJournal(trx, this.context.branch, id, 'supplier_settlement_reversal', row.description, this.context.actor, reversed, date);
                         for (const allocation of allocations) await trx('pharmacy_accounting_allocations').insert({ id: randomUUID(), branchid: this.context.branch, bill_id: allocation.billId, document_id: id, kind: 'ap_settlement_reversal', financial_date: date, original_financial_date: allocation.date, reversal_of_allocation_id: allocation.id, amount: new Decimal(allocation.amount).negated().toFixed(2), created_by: this.context.actor });
                         await trx('pharmacy_documents').insert({ id, branchid: this.context.branch, kind: 'supplier_payment', request_key: 'accounting:ap-reversal:' + id, request_hash: stableHash(input), supplier_id: original.details.supplierId, amount: new Decimal(row.amount).negated().toFixed(2), created_by: this.context.actor, details: JSON.stringify({ originalSettlementId: original.id, settlementReversalId: id, direction: 'refund_received', accountId, method: payment.method, reference, shiftId: shift?.id || null }) });
                         // Original settlement header and positive allocations remain unchanged.
                    } else {
                         const sale = await trx('pharmacy_sales').where({ id: row.details.saleId, branchid: this.context.branch, accounting_version: 3, status: 'completed' }).forUpdate().first();
                         if (!sale || Number(sale.customer_account_id) !== Number(row.details.customerAccountId)) fail('Original credit invoice is unavailable in this branch', 'NOT_FOUND', 404);
                         if (!await trx('pharmacy_customer_accounts').where({ id: sale.customer_account_id, branchid: this.context.branch }).forUpdate().first()) fail('Customer account is unavailable in this branch');
                         const restored = new Decimal(sale.outstanding_amount).plus(row.amount);
                         if (restored.gt(new Decimal(sale.total_amount).minus(sale.paid_amount || 0))) fail('Restored outstanding would exceed unpaid original invoice gross', 'SOURCE_MISMATCH', 409);
                         const arLines = journal.lines.filter(l => l.account === 'receivable:' + sale.customer_account_id);
                         if (arLines.length !== 1 || !new Decimal(arLines[0].credit).eq(row.amount) || !new Decimal(arLines[0].debit).isZero()) fail('Original adjustment journal is not this invoice correction', 'SOURCE_MISMATCH', 409);
                         const taxRows = await trx('pharmacy_accounting_tax_adjustments').where({ branchid: this.context.branch, credit_document_id: original.id, event_type: 'credit' }).forUpdate();
                         if (taxRows.length) {
                              if (!taxRows.reduce((s, r) => s.plus(r.gross_amount), new Decimal(0)).eq(original.amount)) fail('Original tax credit evidence does not reconcile to gross credit', 'TAX_HISTORY_MISMATCH', 409);
                              for (const account of [...new Set(taxRows.map(t => t.local_account).filter(Boolean))]) {
                                   const expected = taxRows.filter(t => t.local_account === account).reduce((s, t) => s.plus(t.tax_amount), new Decimal(0));
                                   const posted = journal.lines.filter(l => l.account === account).reduce((s, l) => s.plus(l.debit).minus(l.credit), new Decimal(0));
                                   if (!posted.eq(expected)) fail('Original tax evidence differs from the posted tax journal', 'TAX_HISTORY_MISMATCH', 409);
                              }
                         }
                         await postPharmacyJournal(trx, this.context.branch, id, 'receivable_adjustment_reversal', row.description, this.context.actor, reversed, date);
                         await new PharmacyAccountingTaxCredits(this.db, this.context).reverse(trx, original.id, row);
                         await trx('pharmacy_sales').where({ id: sale.id, branchid: this.context.branch }).update({ outstanding_amount: restored.toFixed(2) });
                         // Lifecycle metadata changes; original amounts and posted lines do not.
                         await trx('pharmacy_accounting_documents').where({ id: original.id, branchid: this.context.branch }).update({ status: 'reversed', version: Number(original.version) + 1, updated_at: new Date() });
                         await this.audit(trx, 'ar_adjustment:reversed', original.id, original, { reversalId: id, status: 'reversed', restoredOutstanding: restored.toFixed(2) });
                    }
               }
               const next: any = { status, version: Number(row.version) + 1, updated_at: new Date() };
               if (action === 'submit') next.submitted_by = this.context.actor;
               if (action === 'approve') next.approved_by = this.context.actor;
               await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch }).update(next);
               const result = { id, originalDocumentId: row.reversal_of, status, version: next.version };
               await this.audit(trx, kind + ':' + action, id, row, { ...result, reason: input.reason || null }); return result;
          });
     }
}
