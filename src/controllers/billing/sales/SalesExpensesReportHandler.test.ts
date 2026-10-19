import express from 'express';
import { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     validate: vi.fn(), decode: vi.fn(), role: vi.fn(), session: vi.fn(), generate: vi.fn(),
}));
vi.mock('../../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../../hooks/helper', () => ({
     customError: (message: string, statusCode: number, response: any) => response.status(statusCode).json({ status: 'error', statusCode, message }),
     responseError: (response: any) => response.status(500).json({ status: 'error' }),
     handleOverLoad: (handler: any) => handler,
}));
vi.mock('../../../hooks/configuration', () => ({
     configuration: { isMultiTenant: true }, effectiveTenantId: (id: number) => id,
}));
vi.mock('../../../middleware/resolveLoginTenant', () => ({ LOGIN_ROUTES: [] }));
vi.mock('../../../models/Tenancy/tenancyRepo', () => ({ TenancyRepository: class {} }));
vi.mock('../../../models/settings/users/TokenValidator', () => ({
     default: class { validateAccessToken = mocks.validate; decodeAccessToken = mocks.decode; },
}));
vi.mock('../../../models/settings/users/RolesRepository', () => ({
     default: class { getRoleByEmail = mocks.role; },
}));
vi.mock('../../../models/security/repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class { findSessionById = mocks.session; },
}));
vi.mock('../../../middleware/authority', () => ({ getAuthUser: (req: any) => req.authUser || null }));
vi.mock('./FinancialSummaryHandler', () => ({
     handleFinancialAnalytics: vi.fn(), handleFinancialAnalyticsGetKeys: vi.fn(), handleSalesSummaryDailyBreakDown: vi.fn(),
}));
vi.mock('../../../models/billing/sales/SalesExpensesReport', async importOriginal => {
     const actual: any = await importOriginal();
     return { ...actual, SalesExpensesReportService: class {
          constructor(private tenantId: number) { }
          generate(query: any) { return mocks.generate(this.tenantId, query); }
     } };
});

import router from './route';
import { requireSalesReportAccess } from './SalesExpensesReportHandler';
import { SalesReportError } from '../../../models/billing/sales/SalesExpensesReport';

let server: ReturnType<ReturnType<typeof express>['listen']>;
let url: string;
const validQuery = 'tenantId=3&branchid=2&from=2026-10-01&to=2026-10-19';
const headers = { 'pls-prime-tenant-session': 'signed-token' };

beforeEach(async () => {
     vi.clearAllMocks();
     mocks.validate.mockResolvedValue({ expired: false });
     mocks.decode.mockResolvedValue({ email: 'staff@example.test', employeeid: 8, tid: 3, sid: 'verified-session' });
     mocks.role.mockResolvedValue({ employeeid: 8, role: 'accountant', branch: 2 });
     mocks.session.mockResolvedValue({ loggedout: false, logoutTime: new Date(Date.now() + 60000) });
     mocks.generate.mockResolvedValue({
          from: '2026-10-01', to: '2026-10-19', generatedAt: '2026-10-19T12:00:00Z',
          branch: { id: 2, name: 'Main' }, company: {}, summary: { receipts: 100 },
          transactions: [], receipts: [], expenses: [], outstanding: [], paymentMethods: [], outstandingBySource: [], notes: [],
     });
     const app = express();
     app.use(router);
     server = app.listen(0, '127.0.0.1');
     await new Promise<void>(resolve => server.once('listening', resolve));
     url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/billing/sales/report`;
});
afterEach(async () => {
     server.closeAllConnections();
     await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

const get = (query = validQuery, requestHeaders: Record<string, string> = headers) => fetch(`${url}?${query}`, { headers: requestHeaders });

describe('authenticated sales report route', () => {
     it.each(['admin', 'accountant', 'manager'])('serves the exact success envelope to a verified %s in their branch', async role => {
          mocks.role.mockResolvedValue({ employeeid: 8, role, branch: 2 });
          const response = await get();
          expect(response.status).toBe(200);
          expect(response.headers.get('cache-control')).toBe('no-store');
          expect(await response.json()).toMatchObject({ status: 'success', statusCode: 200, data: { branch: { id: 2 }, receipts: [] } });
          expect(mocks.session).toHaveBeenCalledWith(8, 'verified-session');
          expect(mocks.generate).toHaveBeenCalledWith(3, expect.objectContaining({ branchid: '2' }));
     });
     it('rejects missing or expired tokens before generating the report', async () => {
          expect((await get(validQuery, {})).status).toBe(401);
          mocks.validate.mockResolvedValue({ expired: true });
          expect((await get()).status).toBe(401);
          expect(mocks.generate).not.toHaveBeenCalled();
     });
     it('rejects revoked sessions and tenant switching even when the role/email exists in the target tenant', async () => {
          mocks.session.mockResolvedValue({ loggedout: 1, logoutTime: new Date(Date.now() + 60000) });
          expect((await get()).status).toBe(401);
          mocks.session.mockResolvedValue({ loggedout: 0, logoutTime: new Date(Date.now() + 60000) });
          expect((await get(validQuery.replace('tenantId=3', 'tenantId=4'))).status).toBe(403);
          expect(mocks.generate).not.toHaveBeenCalled();
     });
     it.each(['cashier', 'scientist', 'receptionist', 'clinician', 'patient'])('does not allow %s to read financial reports', async role => {
          mocks.role.mockResolvedValue({ employeeid: 8, role, branch: 2 });
          expect((await get()).status).toBe(403);
          expect(mocks.generate).not.toHaveBeenCalled();
     });
     it.each(['admin', 'accountant', 'manager'])('does not let %s cross branches or forge a requester role', async role => {
          mocks.role.mockResolvedValue({ employeeid: 8, role, branch: 1 });
          expect((await get(`${validQuery}&employeeid=999&requesterEmployeeid=999&role=super-admin`)).status).toBe(403);
          expect(mocks.generate).not.toHaveBeenCalled();
     });
     it('denies unassigned staff but preserves the existing super-admin cross-branch exception', async () => {
          mocks.role.mockResolvedValue({ employeeid: 8, role: 'accountant', branch: null });
          expect((await get()).status).toBe(403);
          mocks.role.mockResolvedValue({ employeeid: 8, role: 'Super Admin', branch: null });
          expect((await get()).status).toBe(200);
     });
     it.each([
          validQuery.replace('2026-10-01', '2026-02-30'),
          validQuery.replace('2026-10-01', '2026-10-20'),
          validQuery.replace('branchid=2', 'branchid=all'),
          validQuery.replace('branchid=2', 'branchid=2&branchid=3'),
          validQuery.replace('&to=2026-10-19', ''),
     ])('returns explicit 400 errors for invalid report queries: %s', async query => {
          const response = await get(query);
          expect(response.status).toBe(400);
          expect(await response.json()).toMatchObject({ status: 'error', statusCode: 400 });
          expect(mocks.generate).not.toHaveBeenCalled();
     });
     it('returns 404 for an authorized but nonexistent branch', async () => {
          mocks.generate.mockRejectedValue(new SalesReportError(404, 'Branch not found'));
          const response = await get();
          expect(response.status).toBe(404);
          expect(await response.json()).toMatchObject({ message: 'Branch not found' });
     });
     it('returns a safe explicit error without internal SQL/provider details', async () => {
          mocks.generate.mockRejectedValue(new Error('SQL SELECT secret FROM private; credentials=hidden'));
          const response = await get();
          expect(response.status).toBe(500);
          const body = await response.json();
          expect(body).toEqual({ status: 'error', statusCode: 500, message: 'Unable to generate sales and expenses report' });
          expect(JSON.stringify(body)).not.toMatch(/SELECT|credentials|private/);
     });
     it('fails closed if mounted without verified session middleware or with a mismatched injected tenant', () => {
          const status = vi.fn().mockReturnThis();
          const response = { status, json: vi.fn() } as any;
          const next = vi.fn();
          requireSalesReportAccess({ query: {} } as any, response, next);
          expect(status).toHaveBeenLastCalledWith(401);
          requireSalesReportAccess({ authUser: { role: 'admin', tenantId: 3, branch: 2 }, query: { tenantId: '4' } } as any, response, next);
          expect(status).toHaveBeenLastCalledWith(403);
          expect(next).not.toHaveBeenCalled();
     });
});
