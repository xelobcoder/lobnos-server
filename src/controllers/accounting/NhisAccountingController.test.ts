import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AuthUser } from '../../middleware/authority';

const mocks = vi.hoisted(() => ({
     getAuthUser: vi.fn(), cohort: vi.fn(), cashReceipts: vi.fn(), events: vi.fn(), record: vi.fn(), reverse: vi.fn(),
     previewPeriod: vi.fn(), settlePeriod: vi.fn(), reversePeriod: vi.fn(),
     eventAllocations: vi.fn(),
}));
vi.mock('../../middleware/authority', () => ({ getAuthUser: mocks.getAuthUser }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('../../accountingModule/services/NhisReceivablesService', () => ({
     NhisReceivablesService: class {
          cohort = mocks.cohort; cashReceipts = mocks.cashReceipts; events = mocks.events;
          record = mocks.record; reverse = mocks.reverse;
          previewPeriod = mocks.previewPeriod; settlePeriod = mocks.settlePeriod; reversePeriod = mocks.reversePeriod;
          eventAllocations = mocks.eventAllocations;
     },
}));
import { nhisAccountingRouter } from './NhisAccountingController';
import { AccountingError } from '../../accountingModule/errors/AccountingErrors';

const actor: AuthUser = { tenantId: 17, branch: 4, employeeid: 9, role: 'accountant', email: 'accountant@example.test' };
let server: Server, base: string;
beforeEach(async () => {
     vi.clearAllMocks();
     mocks.getAuthUser.mockReturnValue(actor);
     for (const method of [mocks.cohort, mocks.cashReceipts, mocks.events, mocks.record, mocks.reverse]) method.mockResolvedValue({ rows: [], totals: { outstanding: 700000 } });
     for (const method of [mocks.previewPeriod, mocks.settlePeriod, mocks.reversePeriod]) method.mockResolvedValue({ billCount: 5001, eligibleOutstanding: 800000, received: 600000, remaining: 200000 });
     mocks.eventAllocations.mockResolvedValue({ rows: [], total: 5001, page: 2, count: 20 });
     const app = express(); app.use(express.json()); app.use(nhisAccountingRouter);
     server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
     const address = server.address();
     if (!address || typeof address === 'string') throw new Error('HTTP test listener unavailable');
     base = `http://127.0.0.1:${address.port}/api/v1/accounting/nhis`;
});
afterEach(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

describe('NHIS accounting HTTP contracts', () => {
     it('paginates event allocations through the session branch', async () => {
          const response = await fetch(`${base}/events/42/allocations?page=2&count=20`);
          expect(response.status).toBe(200);
          expect(mocks.eventAllocations).toHaveBeenCalledWith(actor, 42, { page: 2, count: 20 });
     });
     it.each([['period-settlements/preview', 'previewPeriod', 200], ['period-settlements', 'settlePeriod', 201]] as const)('routes %s with authoritative tenant/branch context and unmodified input', async (path, method, status) => {
          const input = { from: '2026-01-01', to: '2026-05-31', amount: '600000.00', date: '2026-11-04', remainingDisposition: 'pending' };
          const response = await fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
          expect(response.status).toBe(status);
          expect(await response.json()).toMatchObject({ result: { billCount: 5001, received: 600000 } });
          expect(mocks[method]).toHaveBeenCalledWith(actor, input);
     });
     it('returns stale period review as a visible 409 and routes atomic reversals', async () => {
          mocks.settlePeriod.mockRejectedValue(new AccountingError('Review cohort again', 'NHIS_SNAPSHOT_STALE', 409));
          const post = (path: string) => fetch(`${base}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          expect(await (await post('period-settlements')).json()).toMatchObject({ statusCode: 409, code: 'NHIS_SNAPSHOT_STALE' });
          expect((await post('period-settlements/12/reversal')).status).toBe(201);
          expect(mocks.reversePeriod).toHaveBeenCalledWith(actor, 12, {});
          expect((await post('period-settlements?tenantId=18')).status).toBe(403);
     });
     it.each([['receivables', 'cohort'], ['cash-receipts', 'cashReceipts'], ['events', 'events']] as const)('serves %s with session context and report filters', async (path, method) => {
          const response = await fetch(`${base}/${path}?tenantId=17&from=2026-01-01&to=2026-04-30&page=2&count=10`);
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({ status: 'success', statusCode: 200, result: { totals: { outstanding: 700000 } } });
          expect(mocks[method]).toHaveBeenCalledWith(actor, { from: '2026-01-01', to: '2026-04-30', page: 2, count: 10 });
     });
     it('rejects unauthenticated sessions and cross-tenant requests before any service execution', async () => {
          expect((await fetch(`${base}/receivables?tenantId=18`)).status).toBe(403);
          mocks.getAuthUser.mockReturnValue(null);
          expect((await fetch(`${base}/receivables`)).status).toBe(401);
          expect(mocks.cohort).not.toHaveBeenCalled();
     });
     it('rejects structured date filters instead of coercing them', async () => {
          expect((await fetch(`${base}/receivables?from[value]=2026-01-01`)).status).toBe(400);
          expect(mocks.cohort).not.toHaveBeenCalled();
     });
     it('requires an explicit adjustment type and retains the full request amount for service authorization', async () => {
          const post = (body: unknown) => fetch(`${base}/adjustments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
          expect((await post({ amount: 700000 })).status).toBe(400);
          expect((await post({ kind: 'write_off', amount: 700000, reason: 'Reviewed final bad debt' })).status).toBe(201);
          expect(mocks.record).toHaveBeenCalledWith(actor, 'write_off', { amount: 700000, reason: 'Reviewed final bad debt' });
     });
     it('surfaces accounting conflicts with their real status rather than returning success', async () => {
          mocks.record.mockRejectedValue(new AccountingError('Allocation exceeds remaining receivable', 'NHIS_OVERALLOCATION', 409));
          const response = await fetch(`${base}/receipts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
          expect(response.status).toBe(409);
          expect(await response.json()).toMatchObject({ status: 'error', code: 'NHIS_OVERALLOCATION' });
     });
     it('routes linked reversals to the authenticated actor', async () => {
          const input = { requestKey: 'nhis-http-reversal-0001', date: '2026-11-04', reference: 'Correction', reason: 'Reviewed correction' };
          expect((await fetch(`${base}/events/42/reversal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status).toBe(201);
          expect(mocks.reverse).toHaveBeenCalledWith(actor, 42, input);
     });
});
