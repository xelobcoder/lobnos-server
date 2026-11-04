import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import { financialDayLimit, financialDayReadinessHandler, financialTransactionLedger } from './financialDayLimit';
import { FinancialDayLimitService, financialDayReadiness } from '../accountingModule/services/FinancialDayLimitService';

const mocks = vi.hoisted(() => ({
     actor: { employeeid: 8, tenantId: 17, role: 'admin', branch: 2 } as { employeeid: number; tenantId: number; role: string; branch: number } | null,
     log: vi.fn(),
}));
vi.mock('../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../hooks/logger', () => ({ default: { error: mocks.log } }));
vi.mock('./authority', () => ({ getAuthUser: () => mocks.actor }));
beforeEach(() => {
     vi.restoreAllMocks(); vi.clearAllMocks();
     mocks.actor = { employeeid: 8, tenantId: 17, role: 'admin', branch: 2 };
});
async function request(method: string, path: string, body = {}) {
     const app = express();
     app.use(express.json());
     app.get('/api/v1/financial-day/readiness', financialDayReadinessHandler);
     app.use(financialDayLimit);
     app.use((_req, res) => res.status(201).json({ reachedTransaction: true }));
     const server = createServer(app);
     try {
          await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Test server did not start');
          const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
               method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
          });
          return { status: response.status, body: await response.json() };
     } finally {
          server.closeAllConnections();
          await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
     }
}
const blocked = (pharmacy = false) => financialDayReadiness(2, '2026-11-02', new Date('2026-11-04T00:00:00Z'), pharmacy);
describe('financial mutation route coverage', () => {
     it.each([
          '/api/v1/billing/multi/submit', '/api/v1/billing/multi', '/api/v1/billing',
          '/api/v1/billing/refund-all', '/api/v1/billing/previous/refund/update/cashout',
          '/api/v1/billing/multi-service/payment', '/api/v1/billing/payment/update',
          '/api/v1/billing/management/void/12', '/api/v1/billing/suspended/12/finalize',
          '/api/v1/expenses', '/api/v1/expenses/payment', '/api/v1/expenses/payment/reverse',
          '/api/v1/organization-invoices/12/payments', '/api/v1/organization/update/payment',
          '/api/v1/inventory/supplier-payments/payments/12', '/api/v1/accounting/manual-journals/12/post',
          '/api/v1/inventory/orders/12/receive', '/api/v1/inventory/transactions/create',
          '/api/v1/entityorders/12/convert', '/api/v1/appointments/12/convert',
     ])('gates laboratory financial action %s', path => {
          expect(financialTransactionLedger('POST', path)).toBe('facility');
     });
     it.each([
          '/api/v1/pharmacy/sales', '/api/v1/pharmacy/sales/12/reverse',
          '/api/v1/pharmacy/sales/held/12/complete', '/api/v1/pharmacy/counter/invoices/12/pay',
          '/api/v1/pharmacy/counter/invoices/12/collect', '/api/v1/pharmacy/credit/invoices/12/payment',
          '/api/v1/pharmacy/management/expenses', '/api/v1/pharmacy/management/supplier-payments',
          '/api/v1/pharmacy/management/open-day', '/api/v1/pharmacy/shifts/open',
          '/api/v1/pharmacy/items/12/stock-up', '/api/v1/pharmacy/items/12/write-off',
          '/api/v1/pharmacy/receiving/invoices', '/api/v1/pharmacy/purchasing/12/submit',
          '/api/v1/pharmacy/accounting/journals/12/post', '/api/v1/pharmacy/accounting/payables/settlements/12/pay',
          '/api/v1/pharmacy/accounting/receivables/adjustments/12/post',
          '/api/v1/pharmacy/accounting/expense-refunds/12/receive', '/api/v1/pharmacy/nhis/claims/12/action',
     ])('gates pharmacy financial action %s', path => {
          expect(financialTransactionLedger('POST', path)).toBe('pharmacy');
     });
     it.each([
          '/api/v1/accounting/daily-closes/12/finalize', '/api/v1/accounting/daily-closes/2026-11-02/accountant-submit',
          '/api/v1/accounting/reconciliation/backfill', '/api/v1/accounting/outbox/12/replay',
          '/api/v1/billing/correction/source', '/api/v1/billing/sales/session/endsession',
          '/api/v1/billing/multi/checkout', '/api/v1/billing/services',
          '/api/v1/result/entry/customtest', '/api/v1/prime/financial-pin/verify',
          '/api/v1/pharmacy/management/close-day', '/api/v1/pharmacy/management/reconcile',
          '/api/v1/pharmacy/management/shifts/12/review', '/api/v1/pharmacy/shifts/close',
          '/api/v1/pharmacy/cashier/reconcile', '/api/v1/pharmacy/accounting/reconciliation/finalize',
          '/api/v1/pharmacy/accounting/settings', '/api/v1/pharmacy/clinical/prescriptions/12/document',
          '/api/v1/pharmacy/receiving/policy', '/api/v1/pharmacy/receiving/prices/preview',
          '/api/v1/pharmacy/accounting/expenses/12/attachments',
     ])('keeps closing, reconciliation, configuration and clinical work accessible: %s', path => {
          expect(financialTransactionLedger('POST', path)).toBeNull();
     });
});
describe('financial day limit HTTP behavior', () => {
     it.each([false, true])('blocks before any transaction handler executes (pharmacy=%s)', async pharmacy => {
          const check = vi.spyOn(FinancialDayLimitService.prototype, 'transactionStatus').mockResolvedValue(blocked(pharmacy));
          const response = await request('POST', pharmacy ? '/api/v1/pharmacy/sales' : '/api/v1/billing/multi/submit', {
               branchid: 99, tenantId: 99, billedon: '2026-11-03', overrideSegregationOfDuties: true,
          });
          expect(response.status).toBe(409);
          expect(response.body).toMatchObject({ success: false, code: 'FINANCIAL_DAY_OVERDUE', result: { oldestFinancialDate: '2026-11-02', graceHours: 48 } });
          expect(response.body.reachedTransaction).toBeUndefined();
          expect(response.body.error.message).toContain('48-hour closing limit');
          expect(check).toHaveBeenCalledWith(2, pharmacy);
          expect(check.mock.contexts[0]).toEqual(expect.objectContaining({ tenantId: 17 }));
     });
     it('allows transactions inside the grace period', async () => {
          vi.spyOn(FinancialDayLimitService.prototype, 'transactionStatus').mockResolvedValue(financialDayReadiness(2, '2026-11-02', new Date('2026-11-03T23:59:59.999Z')));
          expect((await request('POST', '/api/v1/billing/multi/submit')).body.reachedTransaction).toBe(true);
     });
     it('cannot bypass the gate with Express-compatible casing or trailing slashes', async () => {
          vi.spyOn(FinancialDayLimitService.prototype, 'transactionStatus').mockResolvedValue(blocked());
          for (const path of ['/API/V1/BILLING/MULTI/SUBMIT/', '/api/v1/pharmacy/sales/']) {
               expect((await request('POST', path)).status).toBe(409);
          }
     });
     it('never checks reads or blocks the operations needed to close an overdue day', async () => {
          const check = vi.spyOn(FinancialDayLimitService.prototype, 'transactionStatus').mockResolvedValue(blocked());
          for (const [method, path] of [
               ['GET', '/api/v1/billing'], ['POST', '/api/v1/accounting/daily-closes/12/finalize'],
               ['POST', '/api/v1/pharmacy/management/close-day'], ['POST', '/api/v1/result/entry/customtest'],
          ]) expect((await request(method, path)).body.reachedTransaction).toBe(true);
          expect(check).not.toHaveBeenCalled();
     });
     it('fails closed without leaking SQL or database internals', async () => {
          vi.spyOn(FinancialDayLimitService.prototype, 'transactionStatus').mockRejectedValue(Object.assign(new Error('select * from secret_schema.billing SQL failed'), { code: 'ER_NO_SUCH_TABLE' }));
          const response = await request('POST', '/api/v1/pharmacy/sales');
          expect(response.status).toBe(503);
          expect(response.body.code).toBe('FINANCIAL_DAY_CHECK_FAILED');
          expect(JSON.stringify(response.body)).not.toMatch(/select|secret_schema|ER_NO_SUCH_TABLE/);
          expect(response.body.reachedTransaction).toBeUndefined();
          expect(mocks.log).toHaveBeenCalled();
     });
     it('requires an authenticated employee for financial writes', async () => {
          mocks.actor = null;
          expect((await request('POST', '/api/v1/pharmacy/sales')).status).toBe(401);
     });
     it('returns the same shared-ledger blocker and closing link on the readiness endpoint', async () => {
          const check = vi.spyOn(FinancialDayLimitService.prototype, 'transactionStatus').mockResolvedValue(blocked());
          const response = await request('GET', '/api/v1/financial-day/readiness?ledger=pharmacy');
          expect(response.body).toMatchObject({ status: 'success', result: { blocked: true, closeUrl: '/accounting/daily-close?financialDate=2026-11-02' } });
          expect(check).toHaveBeenCalledWith(2, true);
     });
});
