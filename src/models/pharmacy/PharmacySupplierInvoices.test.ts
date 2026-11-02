import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import type { AuthUser } from '../../middleware/authority';
import { PharmacySupplierInvoices } from './PharmacySupplierInvoices';
import { allocationFixture, ctx, firstDate } from './accounting/testSupport/fixture';
import { PharmacyAccountingSubledgers } from './accounting/PharmacyAccountingSubledgers';
import { PharmacyAccountingRegisters } from './accounting/PharmacyAccountingRegisters';
import { json } from './PharmacyEnterpriseCore';

const user: AuthUser = { tenantId: 1, branch: 2, employeeid: 3, role: 'pharmacy_manager', email: 'manager@example.invalid' };
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0)) await close(); vi.useRealTimers(); });
async function fixture(acceptedQuantity = 3, acceptedValue = '10.00') {
     vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
     const f = await allocationFixture();
     cleanup.push(() => f.db.destroy());
     f.native.exec(`
       ALTER TABLE pharmacy_workflows ADD COLUMN updated_at TEXT;
       CREATE TABLE pharmacy_enterprise_requests(request_key TEXT PRIMARY KEY,request_hash TEXT,branchid INTEGER,actor_id INTEGER,response TEXT,created_at TEXT);
       CREATE TABLE pharmacy_enterprise_events(id INTEGER PRIMARY KEY,workflow_id TEXT,branchid INTEGER,actor_id INTEGER,action TEXT,details TEXT,created_at TEXT);
     `);
     const details = { schemaVersion: 2, recognition: 'grni', supplierId: 's1', reference: 'DELIVERY-1',
          lines: [{ id: 'line-one', itemId: 'medicine', quantityDelivered: acceptedQuantity, acceptedQuantity, acceptedValue, returnedQuantity: 0 }] };
     await f.db('pharmacy_workflows').insert({ id: 'delivery-one', branchid: 2, kind: 'goods_delivery', status: 'accepted', version: 2,
          created_by: 3, reason: 'Supplier delivery evidence', details: JSON.stringify(details), created_at: firstDate });
     await f.db('pharmacy_enterprise_events').insert({ workflow_id: 'delivery-one', branchid: 2, actor_id: 3, action: 'delivery_accepted', details: '{}', created_at: firstDate });
     await f.journal('accepted-stock', 'goods_acceptance', [{ account: 'inventory', debit: Number(acceptedValue) }, { account: 'liability:grni', credit: Number(acceptedValue) }]);
     const service = new PharmacySupplierInvoices(f.db, user);
     const input = (quantity = acceptedQuantity, amount: string | number = acceptedValue, suffix = 'one') => ({
          idempotencyKey: 'invoice-request-' + suffix, supplierId: 's1', reference: 'VENDOR-INV-' + suffix, invoiceDate: firstDate, dueDate: '2026-11-30',
          reason: 'Matched accepted delivery evidence', lines: [{ deliveryId: 'delivery-one', lineId: 'line-one', quantity, amount }],
     });
     const delivery = async () => { const row = await f.db('pharmacy_workflows').where({ id: 'delivery-one' }).first(); return { ...row, details: json(row.details) }; };
     return { ...f, service, input, delivery };
}

describe('GRNI supplier invoices and existing AP allocations', () => {
     it('allocates partial quantities with a last-cent residual and recognizes AP exactly once', async () => {
          const f = await fixture();
          const one = await f.service.record(f.input(1, '3.33'));
          expect(await f.service.record(f.input(1, '3.33'))).toEqual(one);
          await f.service.record(f.input(1, '3.33', 'two'));
          await expect(f.service.record(f.input(1, '3.33', 'three'))).rejects.toThrow('3.34');
          await f.service.record(f.input(1, '3.34', 'three'));
          expect(await f.db('pharmacy_documents').where({ kind: 'supplier_invoice' })).toHaveLength(3);
          expect(await f.db('pharmacy_accounting_bills')).toHaveLength(3);
          expect((await f.delivery()).details.lines[0]).toMatchObject({ acceptedQuantity: 3, acceptedValue: '10.00', invoiceQuantity: 3, invoiceAmount: '10.00' });
          expect((await f.delivery()).details.lines[0].invoiceAllocations).toHaveLength(3);
          expect((await f.delivery()).version).toBe(5);
          const grni = await f.db('pharmacy_journal_lines').where({ account_code: 'liability:grni' }).sum('debit as debit').sum('credit as credit').first();
          const ap = await f.db('pharmacy_journal_lines').where({ account_code: 'payable:s1' }).sum('credit as credit').first();
          expect(grni).toMatchObject({ debit: 10, credit: 10 }); expect(ap.credit).toBe(10);
          await expect(f.service.record(f.input(0.001, '0.00', 'four'))).rejects.toThrow('quantity exceeds');
     });
     it('rejects duplicate normalized supplier references and semantic retry mismatches', async () => {
          const f = await fixture();
          await f.service.record(f.input(1, '3.33'));
          await expect(f.service.record({ ...f.input(1, '3.33'), reason: 'Changed financial evidence' })).rejects.toThrow('does not match');
          await expect(f.service.record({ ...f.input(1, '3.33', 'different'), reference: '  vendor-inv-ONE  ' })).rejects.toThrow('already recorded');
          expect(await f.db('pharmacy_accounting_bills')).toHaveLength(1);
          expect((await f.delivery()).details.lines[0].invoiceQuantity).toBe(1);
     });
     it('keeps duplicate concurrent retries and supplier-reference uniqueness atomic', async () => {
          const f = await fixture();
          const [first, retry] = await Promise.all([f.service.record(f.input(1, '3.33')), f.service.record(f.input(1, '3.33'))]);
          expect(retry).toEqual(first);
          const competing = await Promise.allSettled([
               f.service.record(f.input(1, '3.33', 'two')),
               f.service.record({ ...f.input(1, '3.33', 'other-key'), reference: 'VENDOR-INV-two' }),
          ]);
          expect(competing.filter(result => result.status === 'fulfilled')).toHaveLength(1);
          expect(await f.db('pharmacy_accounting_bills')).toHaveLength(2);
          expect(await f.db('pharmacy_journals').where({ kind: 'supplier_invoice' })).toHaveLength(2);
     });
     it('rolls back earlier allocations when another delivery line has the wrong supplier', async () => {
          const f = await fixture(), row = await f.delivery();
          await f.db('pharmacy_workflows').insert({ id: 'delivery-other', branchid: 2, kind: 'goods_delivery', status: 'accepted', version: 2, created_by: 3,
               reason: 'Different supplier delivery', details: JSON.stringify({ ...row.details, supplierId: 's2' }), created_at: firstDate });
          await expect(f.service.record({ ...f.input(1, '3.33'), lines: [f.input(1, '3.33').lines[0], {
               deliveryId: 'delivery-other', lineId: 'line-one', quantity: 1, amount: '3.33',
          }] })).rejects.toThrow('this supplier');
          expect(await f.db('pharmacy_accounting_bills')).toHaveLength(0);
          expect((await f.delivery()).details.lines[0].invoiceQuantity).toBeUndefined();
     });
     it('links invoice bills, partial settlements and aging without another AP credit', async () => {
          const f = await fixture(10, '100.00'), invoice = await f.service.record(f.input());
          const subledgers = new PharmacyAccountingSubledgers(f.db, ctx);
          const settlement = await subledgers.createSettlement({ idempotencyKey: 'invoice-part-settlement', date: firstDate, description: 'Part payment of matched vendor invoice',
               allocations: [{ billId: invoice.billId, amount: '40.00' }] });
          await subledgers.settlementAction(settlement.id, 'submit', { idempotencyKey: 'invoice-settle-submit', expectedVersion: 1 });
          await new PharmacyAccountingSubledgers(f.db, { ...ctx, actor: 4 }).settlementAction(settlement.id, 'approve', { idempotencyKey: 'invoice-settle-approve', expectedVersion: 2 });
          const pay = { idempotencyKey: 'invoice-settle-payment', expectedVersion: 3, method: 'card', reference: 'BANK-INVOICE-ONE' };
          await subledgers.settlementAction(settlement.id, 'pay', pay);
          await subledgers.settlementAction(settlement.id, 'pay', pay);
          expect(await subledgers.payableAging({ asOf: firstDate })).toMatchObject({ total: '60.00', reconciliation: { difference: '0.00', reconciled: true } });
          const payables = await new PharmacyAccountingRegisters(f.db, ctx).payables();
          expect(payables.receipts).toHaveLength(1);
          expect(payables.receipts[0]).toMatchObject({ kind: 'supplier_invoice', invoice_id: invoice.id, bill_id: invoice.billId, source_ref: invoice.id,
               invoice_reference: invoice.reference, invoice_date: firstDate, outstanding_amount: '60.00', due_date: '2026-11-30' });
          const allocation = await f.db('pharmacy_accounting_allocations').first();
          expect(allocation).toMatchObject({ bill_id: invoice.billId, document_id: settlement.id, amount: 40 });
          const paymentJournal = await f.db('pharmacy_journals').where({ source_ref: settlement.id }).first();
          expect(await f.db('pharmacy_journal_lines').where({ journal_id: paymentJournal.id, account_code: 'payable:s1' }).first()).toMatchObject({ document_ref: invoice.id, debit: 40 });
          expect(await f.db('pharmacy_journals').where({ kind: 'supplier_invoice' })).toHaveLength(1);
     });
     it('applies existing registered supplier payments to invoice-backed bills', async () => {
          const f = await fixture(10, '100.00'), invoice = await f.service.record(f.input());
          await f.payment('40.00'); const source = await f.register();
          const application = await f.create(source.id, invoice.billId, '40.00');
          await f.approve(application.id); await f.post(application.id);
          expect(await new PharmacyAccountingSubledgers(f.db, ctx).payableAging({ asOf: '2026-11-03' })).toMatchObject({ total: '60.00', reconciliation: { difference: '0.00' } });
          expect(await f.db('pharmacy_journals').where({ kind: 'supplier_invoice' })).toHaveLength(1);
     });
     it.each(['foreign-delivery', 'foreign-supplier', 'legacy', 'unaccepted', 'closed-day', 'closed-period', 'missing-map', 'wrong-map'])('rolls back documents, AP and cumulative allocations on %s', async mode => {
          const f = await fixture();
          if (mode === 'foreign-delivery') await f.db('pharmacy_workflows').update({ branchid: 9 });
          if (mode === 'foreign-supplier') await f.db('pharmacy_suppliers').where({ id: 's1' }).update({ branchid: 9 });
          if (mode === 'legacy' || mode === 'unaccepted') {
               const row = await f.delivery();
               if (mode === 'legacy') row.details.recognition = 'receipt';
               else row.details.lines[0].acceptedQuantity = 0;
               await f.db('pharmacy_workflows').update({ details: JSON.stringify(row.details) });
          }
          if (mode === 'closed-day') await f.db('pharmacy_financial_days').where({ financial_date: firstDate }).update({ status: 'closed' });
          if (mode === 'closed-period') await f.db('acc_periods').insert({ period_code: '2026-11', period_start: '2026-11-01', period_end: '2026-11-30', status: 'locked' });
          if (mode === 'missing-map' || mode === 'wrong-map') await f.db('pharmacy_accounting_settings').update({
               enabled: 1, effective_date: firstDate, mappings: JSON.stringify({ payable: 'gl-payable', ...(mode === 'wrong-map' ? { 'liability:grni': 'gl-bank' } : {}) }),
          });
          await expect(f.service.record(f.input())).rejects.toThrow();
          expect(await f.db('pharmacy_documents')).toHaveLength(0);
          expect(await f.db('pharmacy_accounting_bills')).toHaveLength(0);
          expect(await f.db('pharmacy_enterprise_requests')).toHaveLength(0);
          expect(await f.db('pharmacy_journals')).toHaveLength(1);
          expect((await f.delivery()).details.lines[0].invoiceQuantity).toBeUndefined();
     });
     it('restricts authority, dates, distinct line allocations, quantity precision and unsupported taxes', async () => {
          const f = await fixture();
          await expect(new PharmacySupplierInvoices(f.db, { ...user, role: 'pharmacy_accountant' }).record(f.input())).rejects.toThrow('manager authority');
          await expect(f.service.record({ ...f.input(), dueDate: '2026-11-01' })).rejects.toThrow('due date');
          await expect(f.service.record({ ...f.input(), invoiceDate: '2026-11-05' })).rejects.toThrow('future');
          await expect(f.service.record({ ...f.input(), lines: [...f.input().lines, ...f.input().lines] })).rejects.toThrow('distinct');
          await expect(f.service.record(f.input(0.0001, '0.00'))).rejects.toThrow('stock quantity');
          await expect(f.service.record({ ...f.input(), taxAmount: '10.00' } as any)).rejects.toThrow('configured purchase-tax');
          await f.db('pharmacy_enterprise_events').update({ created_at: '2026-11-03' });
          await expect(f.service.record(f.input())).rejects.toThrow('accepted stock recognition');
          expect(await f.db('pharmacy_documents')).toHaveLength(0);
     });
     it('keeps receipt-backed legacy bill registration unchanged and cannot register a financial invoice again', async () => {
          const f = await fixture(), invoice = await f.service.record(f.input()), legacy = await f.bill('50.00');
          expect(legacy.source_kind).toBe('receipt');
          await expect(new PharmacyAccountingSubledgers(f.db, ctx).registerBill({ idempotencyKey: 'duplicate-invoice-as-receipt', receiptId: invoice.id })).rejects.toThrow('receipt not found');
          expect(await f.db('pharmacy_accounting_bills')).toHaveLength(2);
     });
});
