import { randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PharmacyAccountingCore, accountingDate, amount, assertTransition, assertVersion, fail, journalLines, journalNumbers, stableHash, text } from './PharmacyAccountingCore';
import { pharmacyAccount } from './PharmacyAccountingCatalogue';
import { postPharmacyJournal, resolvePharmacyDestination } from '../PharmacyLedger';
import { json } from '../PharmacyEnterpriseCore';

/**
 * Documents own approvals, not another ledger. Every posting goes through the existing
 * pharmacy journal writer (and its shared-ledger bridge), within this same transaction.
 */
export class PharmacyAccountingWorkflows extends PharmacyAccountingCore {
     async list(kind: string, query: any = {}): Promise<any> {
          const limit = Math.min(200, Math.max(1, Number(query.limit) || 100)), offset = Math.max(0, Number(query.offset) || 0);
          const q = this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind });
          if (query.status) q.where('status', String(query.status));
          const items = await q.orderBy('created_at', 'desc').orderBy('id').limit(limit).offset(offset);
          return { items: items.map(r => ({ ...r, details: json(r.details) })), limit, offset };
     }
     async detail(id: string, kind: string): Promise<any> {
          const row = await this.db('pharmacy_accounting_documents').where({ id, branchid: this.context.branch, kind }).first();
          if (!row) fail('Document not found in this branch', 'NOT_FOUND', 404);
          const allocationDocument = ['supplier_allocate', 'supplier_unallocate'].includes(kind);
          const [audit, payments, reversals, sourceUses] = await Promise.all([
               this.db('pharmacy_accounting_audit').where({ branchid: this.context.branch, entity_id: id }).orderBy('id'),
               kind === 'expense' ? this.db('pharmacy_accounting_expense_payments').where({ branchid: this.context.branch, expense_id: id }).orderBy('created_at') : Promise.resolve([]),
               this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch, reversal_of: id }).select('id', 'status', 'financial_date', 'description', 'reversal_of', 'replaces_intent_id'),
               allocationDocument ? this.db('pharmacy_accounting_supplier_uses').where({ branchid: this.context.branch, document_id: id }).orderBy('id').limit(100) : Promise.resolve([]),
          ]);
          const journals = await this.db('pharmacy_journals').where({ branchid: this.context.branch }).whereIn('source_ref', [id, ...payments.map(p => p.id), ...reversals.map(r => r.id)]).orderBy('created_at');
          return { ...row, details: json(row.details), payments, journals, reversals,
               ...(allocationDocument ? { sourceUses: sourceUses.map(u => ({ ...u, amount: amount(u.amount, true), financial_date: accountingDate(u.financial_date) })) } : {}),
               audit: audit.map(a => ({ ...a, before_state: json(a.before_state, null), after_state: json(a.after_state) })) };
     }
     async createJournal(input: any): Promise<any> {
          return this.atomic(input, 'journals:create', async (trx, settings) => {
               const lines = journalLines(input.lines);
               for (const line of lines) await pharmacyAccount(trx, this.context.branch, settings, line.account);
               const id = randomUUID(), date = accountingDate(input.date), description = text(input.description, 'journal description');
               const total = lines.reduce((s, l) => s.plus(l.debit), new Decimal(0)).toFixed(2);
               amount(total); // aggregate must fit the money column too
               const row = { id, branchid: this.context.branch, kind: 'journal', status: 'draft', version: 1, financial_date: date, description, amount: total, created_by: this.context.actor, details: JSON.stringify({ lines }) };
               await trx('pharmacy_accounting_documents').insert(row);
               const result = { id, status: 'draft', version: 1 };
               await this.audit(trx, 'journals:create', id, null, { ...row, details: { lines } }); return result;
          });
     }
     async journalAction(id: string, action: string, input: any): Promise<any> {
          return this.atomic(input, `journals:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, 'journal'); assertVersion(row, input);
               // Approval is not posting. Never allow the generic transition helper to reverse an unposted journal.
               if (action === 'reverse' && row.status !== 'posted') fail('Only a posted journal can be reversed', 'INVALID_STATE', 409);
               const status = assertTransition(row, action, this.context.actor);
               if (action === 'pay') fail('Journals do not support payment');
               const lines = journalLines(row.details.lines);
               let reversalId: string | undefined;
               if (action === 'post' || action === 'reverse') {
                    for (const line of lines) await pharmacyAccount(trx, this.context.branch, settings, line.account, action === 'reverse');
                    const date = action === 'reverse' ? accountingDate(input.date) : accountingDate(row.financial_date);
                    await this.postingAllowed(trx, date);
                    if (action === 'post') {
                         await postPharmacyJournal(trx, this.context.branch, id, 'manual_approved', row.description, this.context.actor, journalNumbers(lines), date);
                    } else {
                         const reason = text(input.reason, 'reversal reason');
                         reversalId = randomUUID();
                         const reversed = lines.map(l => ({ account: l.account, debit: l.credit, credit: l.debit }));
                         // A distinct linked source preserves the original posted journal and its shared link.
                         await trx('pharmacy_accounting_documents').insert({ id: reversalId, branchid: this.context.branch, kind: 'journal', status: 'posted', version: 1, financial_date: date, description: reason, amount: row.amount, created_by: this.context.actor, reversal_of: id, details: JSON.stringify({ lines: reversed, originalDocumentId: id }) });
                         await postPharmacyJournal(trx, this.context.branch, reversalId, 'manual_reversal', reason, this.context.actor, journalNumbers(reversed), date);
                         await this.audit(trx, 'journals:reversal_created', reversalId, null, { originalDocumentId: id, reason, date });
                    }
               }
               if (action === 'void') text(input.reason, 'void reason');
               const next: any = { status, version: Number(row.version) + 1, updated_at: new Date() };
               if (action === 'submit') next.submitted_by = this.context.actor;
               if (action === 'approve') next.approved_by = this.context.actor;
               await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch }).update(next);
               const result = { id, status, version: next.version, ...(reversalId ? { reversalId } : {}) };
               await this.audit(trx, 'journals:' + action, id, row, { ...result, reason: input.reason || null }); return result;
          });
     }
     async createExpense(input: any): Promise<any> {
          return this.atomic(input, 'expenses:create', async (trx, settings) => {
               const value = amount(input.amount), date = accountingDate(input.date), dueDate = input.dueDate == null ? null : accountingDate(input.dueDate);
               if (dueDate && dueDate < date) fail('dueDate cannot precede expense date');
               if (typeof input.expenseAccount !== 'string' || (input.expenseAccount !== 'operating_expenses' && !/^expense:[A-Za-z0-9_-]{1,92}$/.test(input.expenseAccount))) fail('Choose an active pharmacy expense account; stock purchases belong to receiving');
               const account = await pharmacyAccount(trx, this.context.branch, settings, input.expenseAccount);
               if (account.type !== 'expense') fail('Expense account must be an expense, never inventory or an asset');
               if (typeof input.supplierId !== 'string' || !await trx('pharmacy_suppliers').where({ id: input.supplierId, branchid: this.context.branch, is_active: true }).forUpdate().first()) fail('Select an active supplier in this branch');
               await pharmacyAccount(trx, this.context.branch, settings, 'payable:' + input.supplierId);
               const description = text(input.description, 'expense description'), id = randomUUID();
               if (['inventoryItemId', 'purchaseOrderId', 'receiptId', 'tax', 'taxRate', 'attachments', 'attachmentIds'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Inventory purchases, tax calculations and attachments are not supported by this non-inventory expense workflow', 'UNSUPPORTED', 422);
               const details = { expenseAccount: input.expenseAccount, supplierId: input.supplierId, dueDate, paidAmount: '0.00', outstandingAmount: value };
               await trx('pharmacy_accounting_documents').insert({ id, branchid: this.context.branch, kind: 'expense', status: 'draft', version: 1, financial_date: date, description, amount: value, created_by: this.context.actor, details: JSON.stringify(details) });
               const result = { id, status: 'draft', version: 1 };
               await this.audit(trx, 'expenses:create', id, null, { ...result, date, description, amount: value, details }); return result;
          });
     }
     async expenseAction(id: string, action: string, input: any): Promise<any> {
          return this.atomic(input, `expenses:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, 'expense'); assertVersion(row, input);
               if (action === 'post') fail('Expense approval posts the accrual; use pay for settlement', 'UNSUPPORTED', 422);
               let status = assertTransition(row, action, this.context.actor);
               const details = { ...row.details };
               let paymentId: string | undefined, reversalId: string | undefined;
               if (['approve', 'pay', 'reverse'].includes(action)) {
                    await pharmacyAccount(trx, this.context.branch, settings, details.expenseAccount);
                    await pharmacyAccount(trx, this.context.branch, settings, 'payable:' + details.supplierId);
                    const date = accountingDate(action === 'approve' ? row.financial_date : input.date);
                    await this.postingAllowed(trx, date);
                    if (action !== 'approve') {
                         const bill = await trx('pharmacy_accounting_bills').where({ branchid: this.context.branch, source_kind: 'expense', source_ref: id }).forUpdate().first();
                         if (bill) {
                              const latest = await trx('pharmacy_accounting_allocations').where({ branchid: this.context.branch, bill_id: bill.id }).orderBy('financial_date', 'desc').first();
                              if (latest && date < accountingDate(latest.financial_date)) fail('Expense settlement cannot predate later bill applications or releases', 'BACKDATED_ALLOCATION', 409);
                         }
                    }
                    if (action === 'approve') {
                         await postPharmacyJournal(trx, this.context.branch, id, 'expense_accrual', row.description, this.context.actor, [
                              { account: details.expenseAccount, debit: Number(row.amount) }, { account: 'payable:' + details.supplierId, credit: Number(row.amount), documentRef: id },
                         ], date);
                         await trx('pharmacy_accounting_bills').insert({ id: randomUUID(), branchid: this.context.branch, supplier_id: details.supplierId, source_kind: 'expense', source_ref: id, reference: id, document_date: date, due_date: details.dueDate || null, amount: row.amount, created_by: this.context.actor });
                    } else if (action === 'pay') {
                         const value = amount(input.amount), paid = new Decimal(details.paidAmount).plus(value), outstanding = new Decimal(row.amount).minus(paid).minus(details.externalAllocatedAmount || 0);
                         if (outstanding.lt(0)) fail('Payment exceeds expense outstanding balance', 'OVERPAYMENT', 409);
                         const control = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
                              .where({ 'j.branchid': this.context.branch, 'l.account_code': 'payable:' + details.supplierId })
                              .sum('l.debit as debit').sum('l.credit as credit').first();
                         if (new Decimal(control?.credit || 0).minus(control?.debit || 0).lt(value)) fail('Supplier payable is insufficient; reconcile unallocated supplier payments or credits before settling this expense', 'PAYABLE_RECONCILIATION_REQUIRED', 409);
                         if (!['cash', 'card', 'mobile_money'].includes(input.method)) fail('Select cash, card or mobile_money');
                         const reference = input.reference == null ? null : text(input.reference, 'payment reference', 128);
                         if (input.method !== 'cash' && !reference) fail('Non-cash payment requires a reference');
                         const account = await resolvePharmacyDestination(trx, this.context.branch, input.method);
                         await pharmacyAccount(trx, this.context.branch, settings, 'collection:' + account.id);
                         let shift: any;
                         if (input.method === 'cash') {
                              shift = await trx('pharmacy_shifts').where({ active_key: `${this.context.branch}:${this.context.actor}`, financial_date: date }).forUpdate().first();
                              if (!shift) fail('An open pharmacy cash shift for the payment date is required');
                         }
                         if (reference && await trx('pharmacy_accounting_expense_payments').where({ branchid: this.context.branch, account_id: account.id, reference }).forUpdate().first()) fail('Payment reference already recorded', 'DUPLICATE_REFERENCE', 409);
                         paymentId = randomUUID();
                         await trx('pharmacy_accounting_expense_payments').insert({ id: paymentId, expense_id: id, branchid: this.context.branch, account_id: account.id, financial_date: date, amount: value, method: input.method, reference, created_by: this.context.actor });
                         // Existing shift handovers read disbursement evidence from pharmacy_documents.
                         // This is a payable settlement, NOT a second expense/accrual or stock purchase.
                         await trx('pharmacy_documents').insert({ id: paymentId, branchid: this.context.branch, kind: 'supplier_payment', request_key: 'accounting:payment:' + paymentId, request_hash: stableHash(input), supplier_id: details.supplierId, amount: value, created_by: this.context.actor, details: JSON.stringify({ expenseId: id, description: row.description, method: input.method, reference, accountId: account.id, shiftId: shift?.id || null, accountingWorkflow: true }) });
                         await postPharmacyJournal(trx, this.context.branch, paymentId, 'expense_payment', row.description, this.context.actor, [
                              { account: 'payable:' + details.supplierId, debit: Number(value), documentRef: id }, { account: 'collection:' + account.id, credit: Number(value) },
                         ], date);
                         const bill = await trx('pharmacy_accounting_bills').where({ branchid: this.context.branch, source_kind: 'expense', source_ref: id }).forUpdate().first();
                         if (!bill) fail('Expense bill allocation source missing; reconciliation required', 'BILL_SOURCE_MISSING', 409);
                         await trx('pharmacy_accounting_allocations').insert({ id: randomUUID(), branchid: this.context.branch, bill_id: bill.id, document_id: paymentId, kind: 'expense_payment', financial_date: date, amount: value, created_by: this.context.actor });
                         details.paidAmount = paid.toFixed(2); details.outstandingAmount = outstanding.toFixed(2);
                         status = outstanding.isZero() ? 'paid' : 'partially_paid';
                    } else {
                         if (new Decimal(details.externalAllocatedAmount || 0).gt(0)) fail('Release reviewed legacy supplier allocations before reversing this expense', 'SOURCE_ALLOCATED', 409);
                         // Never assert money was refunded just because someone clicked Reverse.
                         if (!new Decimal(details.paidAmount).isZero()) fail('Paid expense reversal requires a separately evidenced refund workflow, not implemented', 'REFUND_REQUIRED', 422);
                         const reason = text(input.reason, 'expense reversal reason'); reversalId = randomUUID();
                         await trx('pharmacy_accounting_documents').insert({ id: reversalId, branchid: this.context.branch, kind: 'journal', status: 'posted', version: 1, financial_date: date, description: reason, amount: row.amount, created_by: this.context.actor, reversal_of: id, details: JSON.stringify({ originalDocumentId: id, lines: [{ account: 'payable:' + details.supplierId, debit: row.amount, credit: 0 }, { account: details.expenseAccount, credit: row.amount, debit: 0 }] }) });
                         await postPharmacyJournal(trx, this.context.branch, reversalId, 'expense_reversal', reason, this.context.actor, [
                              { account: 'payable:' + details.supplierId, debit: Number(row.amount), documentRef: id }, { account: details.expenseAccount, credit: Number(row.amount) },
                         ], date);
                         const bill = await trx('pharmacy_accounting_bills').where({ branchid: this.context.branch, source_kind: 'expense', source_ref: id }).forUpdate().first();
                         if (!bill) fail('Expense bill allocation source missing; reconciliation required', 'BILL_SOURCE_MISSING', 409);
                         await trx('pharmacy_accounting_allocations').insert({ id: randomUUID(), branchid: this.context.branch, bill_id: bill.id, document_id: reversalId, kind: 'expense_reversal', financial_date: date, amount: row.amount, created_by: this.context.actor });
                         details.outstandingAmount = '0.00';
                    }
               }
               if (action === 'void') text(input.reason, 'void reason');
               const next: any = { status, details: JSON.stringify(details), version: Number(row.version) + 1, updated_at: new Date() };
               if (action === 'submit') next.submitted_by = this.context.actor;
               if (action === 'approve') next.approved_by = this.context.actor;
               await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch }).update(next);
               const result = { id, status, version: next.version, paidAmount: details.paidAmount, outstandingAmount: details.outstandingAmount, ...(paymentId ? { paymentId } : {}), ...(reversalId ? { reversalId } : {}) };
               await this.audit(trx, 'expenses:' + action, id, row, { ...result, reason: input.reason || null }); return result;
          });
     }
}
