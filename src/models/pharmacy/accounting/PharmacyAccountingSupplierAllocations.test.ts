import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../PharmacyAccountingBridge', () => ({ synchronizePharmacyJournal: vi.fn() }));
import { allocationFixture, ctx, firstDate, allocationDate, releaseDate } from './testSupport/fixture';
import { PharmacyAccountingSupplierAllocations, retirePharmacySupplierAllocationSource } from './PharmacyAccountingSupplierAllocations';
import { PharmacyAccountingSubledgers } from './PharmacyAccountingSubledgers';
import { PharmacyAccountingWorkflows } from './PharmacyAccountingWorkflows';
import { ensurePharmacyAccountingSchema, ensureReversalIntentIdentity, REVERSAL_IDENTITY_SQL } from './PharmacyAccountingSchema';
import knex from 'knex';
let f: Awaited<ReturnType<typeof allocationFixture>>;
beforeEach(async () => { f = await allocationFixture(); });
afterEach(async () => { await f?.db.destroy(); });
const retirement = (sourceRef = 'legacy-payment', sourceKind: 'payment' | 'credit_note' = 'payment') => ({
     branch: 2, actor: 4, sourceKind, sourceRef, reason: 'Correct original producer evidence after reviewed release',
});
const setup = async (value = '40.01') => {
     const bill = await f.bill(); await f.payment(value); const source = await f.register();
     return { bill, source };
};
const committed = async () => {
     const { bill, source } = await setup(), doc = await f.create(source.id, bill.id);
     await f.approve(doc.id); await f.post(doc.id);
     return { bill, source, doc };
};
const release = async (id: string) => {
     const doc = await f.service.createRelease(id, { idempotencyKey: 'release-create:' + id, date: releaseDate, reason: 'Release application for reviewed source correction' });
     await f.approve(doc.id, true); await f.post(doc.id, true); return doc;
};
describe('Authentic supplier allocation sources: real SQL', () => {
     it('discovers and freezes original payments and confirmed credit notes, not managed payments', async () => {
          await f.bill(); await f.payment(); await f.credit();
          await f.payment('10.00', 'managed-payment');
          await f.db('pharmacy_documents').where({ id: 'managed-payment' }).update({ request_key: 'accounting:payment:managed' });
          expect((await f.service.candidates({ sourceKind: 'payment' })).items.map(x => x.sourceRef)).toEqual(['legacy-payment']);
          expect((await f.service.candidates({ sourceKind: 'credit_note' })).items.map(x => x.sourceRef)).toEqual(['supplier-credit']);
          const registered = await f.register();
          expect(await f.register()).toEqual(registered);
          expect((await f.service.candidates({ sourceKind: 'payment' })).items).toHaveLength(0);
          expect((await f.service.sources()).items[0]).toMatchObject({ amount: '40.01', allocatedAmount: '0.00', availableAmount: '40.01' });
          await expect(f.service.register({ idempotencyKey: 'other-register-source', sourceKind: 'payment', sourceRef: 'legacy-payment' })).rejects.toThrow('already registered');
          await expect(f.service.candidates({ sourceKind: 'payment', limit: 101 })).rejects.toThrow('limit');
     });
     it('never accepts a foreign source, altered supplier/destination, negative refund or unposted amount', async () => {
          await f.payment();
          const foreign = new PharmacyAccountingSupplierAllocations(f.db, { ...ctx, branch: 9 });
          await expect(foreign.register({ idempotencyKey: 'foreign-register-source', sourceKind: 'payment', sourceRef: 'legacy-payment' })).rejects.toThrow('not found');
          await f.db('pharmacy_documents').where({ id: 'legacy-payment' }).update({ supplier_id: 's2' });
          await expect(f.register()).rejects.toThrow('supplier debit');
          await f.db('pharmacy_documents').where({ id: 'legacy-payment' }).update({ supplier_id: 's1', amount: '-40.01' });
          await expect(f.register()).rejects.toThrow('monetary');
          await f.db('pharmacy_documents').where({ id: 'legacy-payment' }).update({ amount: '40.01' });
          await f.db('pharmacy_collection_accounts').where({ id: 10 }).update({ branchid: 9 });
          await expect(f.register()).rejects.toThrow('outside this branch');
          await f.db('pharmacy_collection_accounts').where({ id: 10 }).update({ branchid: 2 });
          await f.db('pharmacy_journal_lines').where({ account_code: 'collection:10' }).update({ credit: '40.00' });
          await expect(f.register()).rejects.toThrow('balanced');
          expect(await f.db('pharmacy_accounting_supplier_sources')).toHaveLength(0);
     });
     it('requires a credited original return, same-branch receipt and a matching posted supplier debit', async () => {
          await f.bill(); await f.credit();
          await f.db('pharmacy_workflows').where({ id: 'supplier-credit' }).update({ status: 'awaiting_credit' });
          await expect(f.register('supplier-credit', 'credit_note')).rejects.toThrow('not found');
          await f.db('pharmacy_workflows').where({ id: 'supplier-credit' }).update({ status: 'credited' });
          await f.db('pharmacy_documents').where({ id: 'receipt-one' }).update({ supplier_id: 's2' });
          await expect(f.register('supplier-credit', 'credit_note')).rejects.toThrow('receipt');
          await f.db('pharmacy_documents').where({ id: 'receipt-one' }).update({ supplier_id: 's1' });
          const source = await f.register('supplier-credit', 'credit_note');
          expect(source.amount).toBe('25.01');
     });
     it('rejects source correction journal evidence and changed immutable source hashes', async () => {
          const { bill, source } = await setup();
          await f.db('pharmacy_documents').where({ id: 'legacy-payment' }).update({ request_hash: 'changed-after-approval' });
          await expect(f.create(source.id, bill.id)).rejects.toThrow('changed after registration');
          await f.db('pharmacy_documents').where({ id: 'legacy-payment' }).update({ request_hash: 'immutable-producer-hash' });
          await f.journal('legacy-payment', 'supplier_payment_correction', [{ account: 'collection:10', debit: 40.01 }, { account: 'payable:s1', credit: 40.01 }]);
          await expect(f.create(source.id, bill.id)).rejects.toThrow('correction evidence');
     });
});
describe('Reviewed existing-source applications: real SQL', () => {
     it('applies exact partial amounts without a second cash/AP journal and preserves original evidence', async () => {
          const { bill, source } = await setup('60.01'), originalJournals = await f.db('pharmacy_journals').orderBy('id'), originalLines = await f.db('pharmacy_journal_lines').orderBy('id');
          const doc = await f.create(source.id, bill.id, '40.01');
          await expect(f.service.action(doc.id, false, 'post', { idempotencyKey: 'bypass-allocation-post', expectedVersion: 1 })).rejects.toThrow('Cannot post');
          await f.service.action(doc.id, false, 'submit', { idempotencyKey: 'review-self-submit', expectedVersion: 1 });
          await expect(f.service.action(doc.id, false, 'approve', { idempotencyKey: 'review-self-approve', expectedVersion: 2 })).rejects.toThrow('own document');
          await new PharmacyAccountingSupplierAllocations(f.db, { ...ctx, actor: 4 }).action(doc.id, false, 'approve', { idempotencyKey: 'review-other-approve', expectedVersion: 2 });
          await f.post(doc.id); await f.post(doc.id);
          expect(await f.db('pharmacy_journals').orderBy('id')).toEqual(originalJournals);
          expect(await f.db('pharmacy_journal_lines').orderBy('id')).toEqual(originalLines);
          expect(await f.db('pharmacy_accounting_allocations')).toHaveLength(1);
          expect((await f.service.sources()).items[0]).toMatchObject({ allocatedAmount: '40.01', availableAmount: '20.00' });
          const remainder = await f.create(source.id, bill.id, '20.00', 'allocate:remainder');
          await f.approve(remainder.id); await f.post(remainder.id);
          expect((await f.service.sources()).items[0].availableAmount).toBe('0.00');
          await expect(f.create(source.id, bill.id, '0.01', 'allocate:excess')).rejects.toThrow('unused supplier source');
          await expect(f.service.action(doc.id, false, 'void', { idempotencyKey: 'posted-allocation-void', expectedVersion: 4, reason: 'Attempt to mutate posted application' })).rejects.toThrow('Cannot void');
     });
     it('allocates a confirmed credit without inventory/AP recognition and reconciles dated bill aging', async () => {
          const bill = await f.bill(); await f.credit();
          const source = await f.register('supplier-credit', 'credit_note'), count = await f.db('pharmacy_journals').count('* as n').first();
          const doc = await f.create(source.id, bill.id, '25.01');
          await f.approve(doc.id); await f.post(doc.id);
          const s = new PharmacyAccountingSubledgers(f.db, ctx);
          const before = await s.payableAging({ asOf: firstDate }), after = await s.payableAging({ asOf: allocationDate });
          expect(before.total).toBe('100.01'); expect(before.reconciliation.difference).toBe('-25.01');
          expect(after.total).toBe('75.00'); expect(after.reconciliation.reconciled).toBe(true);
          expect(await f.db('pharmacy_journals').count('* as n').first()).toEqual(count);
     });
     it('rejects source and target overallocations and serializes competing approved applications', async () => {
          const { bill, source } = await setup('60.01');
          const one = await f.create(source.id, bill.id, '40.01', 'allocate:race-one'), two = await f.create(source.id, bill.id, '40.01', 'allocate:race-two');
          await f.approve(one.id); await f.approve(two.id);
          const race = await Promise.allSettled([f.post(one.id), f.post(two.id)]);
          expect(race.filter(r => r.status === 'fulfilled')).toHaveLength(1);
          expect(await f.db('pharmacy_accounting_supplier_uses')).toHaveLength(1);
          await f.payment('100.00', 'second-payment'); const other = await f.register('second-payment');
          await expect(f.create(other.id, bill.id, '60.01', 'allocate:bill-overflow')).rejects.toThrow('bill outstanding');
     });
     it('supports multiple bills but forbids cross-party, cross-branch, duplicate and backdated applications', async () => {
          const { bill, source } = await setup('80.00'), bill2 = await f.bill('10.00', 'receipt-two'), wrong = await f.bill('10.00', 'receipt-wrong', 's2');
          const request = { idempotencyKey: 'multiple-bills-apply', sourceId: source.id, date: allocationDate, reason: 'Explicit two bill allocation', allocations: [{ billId: bill.id, amount: '20.01' }, { billId: bill2.id, amount: '10.00' }] };
          const doc = await f.service.create(request); await f.approve(doc.id); await f.post(doc.id);
          expect(await f.db('pharmacy_accounting_allocations').where({ document_id: doc.id })).toHaveLength(2);
          await expect(f.service.create({ ...request, idempotencyKey: 'duplicate-bills-apply', allocations: [request.allocations[0], request.allocations[0]] })).rejects.toThrow('distinct bills');
          await expect(f.create(source.id, wrong.id, '1.00', 'wrong-supplier-apply')).rejects.toThrow('supplier/branch');
          await expect(new PharmacyAccountingSupplierAllocations(f.db, { ...ctx, branch: 9 }).create({ ...request, idempotencyKey: 'foreign-bill-apply' })).rejects.toThrow('not found');
          await expect(f.service.create({ ...request, idempotencyKey: 'backdated-bill-apply', date: firstDate })).rejects.toThrow('later source');
     });
     it('does not silently consolidate historical sources when enabled', async () => {
          const { bill, source } = await setup(), doc = await f.create(source.id, bill.id);
          await f.approve(doc.id);
          await f.db('pharmacy_accounting_settings').where({ branchid: 2 }).update({ enabled: true, effective_date: firstDate });
          await expect(f.post(doc.id)).rejects.toThrow('Consolidate the original supplier source');
          expect(await f.db('pharmacy_accounting_allocations')).toHaveLength(0);
          const journal = await f.db('pharmacy_journals').where({ source_ref: 'legacy-payment', kind: 'supplier_payment' }).first();
          await f.db('pharmacy_accounting_posting_links').insert({ journal_id: journal.id, shared_entry_id: 1, branchid: 2 });
          await expect(f.post(doc.id)).rejects.toThrow('Consolidate original bill');
          const receipt = await f.db('pharmacy_journals').where({ source_ref: 'receipt-one', kind: 'stock_receipt' }).first();
          await f.db('pharmacy_accounting_posting_links').insert({ journal_id: receipt.id, shared_entry_id: 2, branchid: 2 });
          await f.post(doc.id);
          expect(await f.db('pharmacy_accounting_allocations')).toHaveLength(1);
     });
     it('enforces shared periods and financial-day locks; failures leave approval intact', async () => {
          const { bill, source } = await setup(), doc = await f.create(source.id, bill.id);
          await f.approve(doc.id);
          await f.db('acc_periods').insert({ period_code: '2026-11', period_start: '2026-11-01', period_end: '2026-11-30', status: 'closed' });
          await expect(f.post(doc.id)).rejects.toThrow();
          await f.db('acc_periods').where({ period_code: '2026-11' }).update({ status: 'open' });
          await f.db('pharmacy_financial_days').where({ branchid: 2, financial_date: allocationDate }).update({ status: 'closed' });
          await expect(f.post(doc.id)).rejects.toThrow('financial day');
          expect(await f.db('pharmacy_accounting_supplier_uses')).toHaveLength(0);
          expect((await f.db('pharmacy_accounting_documents').where({ id: doc.id }).first()).status).toBe('approved');
     });
     it('rolls back allocations, source uses, state, audit and idempotency on audit failure', async () => {
          const { bill, source } = await setup(), doc = await f.create(source.id, bill.id); await f.approve(doc.id);
          f.native.exec("CREATE TRIGGER reject_allocation_audit BEFORE INSERT ON pharmacy_accounting_audit WHEN NEW.action='ap:allocation:post' BEGIN SELECT RAISE(FAIL,'audit unavailable'); END;");
          await expect(f.post(doc.id)).rejects.toThrow('audit unavailable');
          expect(await f.db('pharmacy_accounting_allocations')).toHaveLength(0);
          expect(await f.db('pharmacy_accounting_supplier_uses')).toHaveLength(0);
          expect(await f.db('pharmacy_accounting_requests').where({ request_key: 'post:' + doc.id })).toHaveLength(0);
          f.native.exec('DROP TRIGGER reject_allocation_audit');
          await f.post(doc.id);
          expect(await f.db('pharmacy_accounting_supplier_uses')).toHaveLength(1);
     });
     it('maintains approved expense balances and prevents paying or reversing externally settled amounts twice', async () => {
          const w = new PharmacyAccountingWorkflows(f.db, ctx), expense = await w.createExpense({ idempotencyKey: 'legacy-expense-create', date: firstDate, description: 'Original approved office rent', amount: '100.01', expenseAccount: 'expense:rent', supplierId: 's1' });
          await w.expenseAction(expense.id, 'submit', { idempotencyKey: 'legacy-expense-submit', expectedVersion: 1 });
          await new PharmacyAccountingWorkflows(f.db, { ...ctx, actor: 4 }).expenseAction(expense.id, 'approve', { idempotencyKey: 'legacy-expense-approve', expectedVersion: 2 });
          const bill = await f.db('pharmacy_accounting_bills').where({ source_kind: 'expense', source_ref: expense.id }).first();
          await f.payment(); const source = await f.register(), doc = await f.create(source.id, bill.id);
          await f.approve(doc.id); await f.post(doc.id);
          expect((await w.detail(expense.id, 'expense')).details).toMatchObject({ paidAmount: '0.00', externalAllocatedAmount: '40.01', outstandingAmount: '60.00' });
          await expect(w.expenseAction(expense.id, 'reverse', { idempotencyKey: 'external-expense-reverse', expectedVersion: 4, date: allocationDate, reason: 'Cannot discard allocated supplier source' })).rejects.toThrow('Release reviewed legacy');
          await expect(w.expenseAction(expense.id, 'pay', { idempotencyKey: 'external-expense-overpay', expectedVersion: 4, date: allocationDate, amount: '60.01', method: 'card', reference: 'BANK-REMAINDER' })).rejects.toThrow('exceeds');
          const paid = await w.expenseAction(expense.id, 'pay', { idempotencyKey: 'external-expense-pay', expectedVersion: 4, date: allocationDate, amount: '60.00', method: 'card', reference: 'BANK-REMAINDER' });
          expect(paid).toMatchObject({ status: 'paid', outstandingAmount: '0.00', paidAmount: '60.00' });
          expect((await new PharmacyAccountingSubledgers(f.db, ctx).payableAging({ asOf: allocationDate })).reconciliation.reconciled).toBe(true);
     });
});
describe('Reviewed signed allocation releases and source correction guards', () => {
     it('restores exact capacity on the release date and leaves original evidence immutable', async () => {
          const { bill, source, doc } = await committed(), original = await f.db('pharmacy_accounting_supplier_uses').first(), journals = await f.db('pharmacy_journals').orderBy('id');
          const reversed = await release(doc.id);
          expect(await f.db('pharmacy_accounting_supplier_uses').where({ id: original.id }).first()).toEqual(original);
          expect(await f.db('pharmacy_accounting_supplier_uses').where({ document_id: reversed.id }).first()).toMatchObject({ amount: -40.01, reversal_of_use_id: original.id });
          expect((await f.service.sources()).items[0].availableAmount).toBe('40.01');
          expect((await f.db('pharmacy_accounting_documents').where({ id: doc.id }).first()).status).toBe('posted');
          expect(await f.db('pharmacy_journals').orderBy('id')).toEqual(journals);
          const aging = new PharmacyAccountingSubledgers(f.db, ctx);
          expect((await aging.payableAging({ asOf: allocationDate })).total).toBe('60.00');
          expect((await aging.payableAging({ asOf: releaseDate })).total).toBe('100.01');
          await expect(f.create(source.id, bill.id, '40.01', 'reapply-backdated')).rejects.toThrow('later source');
     });
     it('requires independent review and permits only one posted release, including voided replacements', async () => {
          const { doc } = await committed();
          const input = { idempotencyKey: 'release-first-intent', date: releaseDate, reason: 'First allocation release evidence' };
          const first = await f.service.createRelease(doc.id, input);
          await f.service.action(first.id, true, 'void', { idempotencyKey: 'release-first-void', expectedVersion: 1, reason: 'Evidence was incomplete' });
          await expect(f.service.createRelease(doc.id, { ...input, idempotencyKey: 'release-no-lineage' })).rejects.toThrow('latest voided');
          const next = await f.service.createRelease(doc.id, { ...input, idempotencyKey: 'release-replacement', replacesIntentId: first.id, expectedVersion: 2 });
          await f.service.action(next.id, true, 'submit', { idempotencyKey: 'release-submit-next', expectedVersion: 1 });
          await expect(f.service.action(next.id, true, 'approve', { idempotencyKey: 'release-self-next', expectedVersion: 2 })).rejects.toThrow('own document');
          await new PharmacyAccountingSupplierAllocations(f.db, { ...ctx, actor: 4 }).action(next.id, true, 'approve', { idempotencyKey: 'release-other-next', expectedVersion: 2 });
          await f.post(next.id, true);
          await expect(f.service.createRelease(doc.id, { ...input, idempotencyKey: 'release-duplicate-next' })).rejects.toThrow('already exists');
          expect(await f.db('pharmacy_accounting_documents').where({ reversal_of: doc.id })).toHaveLength(2);
     });
     it('blocks source correction until allocations are released and pending requests voided; retirement is transactional', async () => {
          const { doc, source, bill } = await committed();
          await expect(f.db.transaction(trx => retirePharmacySupplierAllocationSource(trx, retirement()))).rejects.toThrow('Release all reviewed');
          await release(doc.id);
          const draft = await f.service.create({ idempotencyKey: 'reapply-after-release', sourceId: source.id, date: releaseDate, reason: 'Pending replacement application', allocations: [{ billId: bill.id, amount: '40.01' }] });
          await expect(f.db.transaction(trx => retirePharmacySupplierAllocationSource(trx, retirement()))).rejects.toThrow('Void pending');
          await f.service.action(draft.id, false, 'void', { idempotencyKey: 'void-pending-reapply', expectedVersion: 1, reason: 'Proceed with source correction instead' });
          await expect(f.db.transaction(async trx => { await retirePharmacySupplierAllocationSource(trx, retirement()); throw new Error('producer correction failed'); })).rejects.toThrow('producer correction failed');
          expect((await f.service.sources()).items[0].status).toBe('available');
          await f.db.transaction(trx => retirePharmacySupplierAllocationSource(trx, retirement()));
          expect((await f.service.sources()).items[0].status).toBe('retired');
          await expect(f.create(source.id, bill.id, '1.00', 'retired-source-create')).rejects.toThrow('retired');
          expect(await f.db('pharmacy_accounting_audit').where({ action: 'ap:source:retire' })).toHaveLength(1);
     });
     it('revalidates exact signed original allocations rather than trusting draft release snapshots', async () => {
          const { doc } = await committed();
          const r = await f.service.createRelease(doc.id, { idempotencyKey: 'release-hash-create', date: releaseDate, reason: 'Release reviewed allocation evidence' });
          await f.approve(r.id, true);
          await f.db('pharmacy_accounting_allocations').where({ document_id: doc.id }).update({ amount: '40.00' });
          await expect(f.post(r.id, true)).rejects.toThrow('evidence changed');
          expect(await f.db('pharmacy_accounting_supplier_uses').where({ document_id: r.id })).toHaveLength(0);
     });
     it('records retirement before registration so corrected original sources cannot be revived later', async () => {
          await f.bill(); await f.payment();
          await f.db.transaction(trx => retirePharmacySupplierAllocationSource(trx, retirement()));
          await expect(f.register()).rejects.toThrow('retired');
          expect((await f.service.candidates({ sourceKind: 'payment' })).items).toHaveLength(0);
          expect(await f.db('pharmacy_accounting_supplier_retirements')).toHaveLength(1);
          await f.db.transaction(trx => retirePharmacySupplierAllocationSource(trx, retirement()));
          expect(await f.db('pharmacy_accounting_audit').where({ action: 'ap:source:retire' })).toHaveLength(1);
     });
});
describe('History-preserving schema upgrades', () => {
     it('compiles native MySQL generated identity/index DDL without opening a connection', async () => {
          const mysql = knex({ client: 'mysql2' });
          try {
               const ddl = mysql.schema.alterTable('pharmacy_accounting_documents', t => {
                    t.specificType('active_reversal_of', REVERSAL_IDENTITY_SQL);
                    t.unique(['active_reversal_of'], 'uq_pharm_acc_active_reversal');
               }).toSQL().map(s => s.sql).join('; ');
               expect(ddl).toContain(REVERSAL_IDENTITY_SQL);
               expect(ddl).toContain('unique `uq_pharm_acc_active_reversal`');
               const drop = mysql.schema.alterTable('pharmacy_accounting_documents', t => t.dropUnique(['reversal_of'], 'pharmacy_accounting_documents_reversal_of_unique')).toSQL();
               expect(drop[0].sql).toContain('drop index `pharmacy_accounting_documents_reversal_of_unique`');
          } finally { await mysql.destroy(); }
     });
     it('upgrades the legacy unique reversal_of without dropping source links and enforces active identity in SQLite', async () => {
          await f.db.schema.dropTable('pharmacy_accounting_documents');
          await f.db.schema.createTable('pharmacy_accounting_documents', t => {
               t.string('id', 36).primary(); t.integer('branchid'); t.string('kind'); t.string('status'); t.text('details');
               t.string('reversal_of', 36).unique();
          });
          const prior = { id: 'voided-old', branchid: 2, kind: 'ap_reversal', status: 'voided', details: '{"originalDocumentId":"source"}', reversal_of: 'source' };
          await f.db('pharmacy_accounting_documents').insert(prior);
          await ensureReversalIntentIdentity(f.db); await ensureReversalIntentIdentity(f.db);
          expect(await f.db('pharmacy_accounting_documents').where({ id: prior.id }).first()).toMatchObject(prior);
          await f.db('pharmacy_accounting_documents').insert({ ...prior, id: 'active-new', status: 'draft', replaces_intent_id: prior.id });
          await expect(f.db('pharmacy_accounting_documents').insert({ ...prior, id: 'competing-new', status: 'approved' })).rejects.toThrow('UNIQUE');
          await f.db('pharmacy_accounting_documents').where({ id: 'active-new' }).update({ status: 'posted' });
          await expect(f.db('pharmacy_accounting_documents').insert({ ...prior, id: 'posted-duplicate', status: 'posted' })).rejects.toThrow('UNIQUE');
          expect(await f.db('pharmacy_accounting_documents')).toHaveLength(2);
     });
     it('repeated schema initialization preserves registered sources and signed evidence', async () => {
          const { doc } = await committed(); await release(doc.id);
          const uses = await f.db('pharmacy_accounting_supplier_uses').orderBy('id');
          await ensurePharmacyAccountingSchema(f.db); await ensurePharmacyAccountingSchema(f.db);
          expect(await f.db('pharmacy_accounting_supplier_uses').orderBy('id')).toEqual(uses);
     });
});
