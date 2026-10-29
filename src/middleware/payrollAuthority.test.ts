import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, Server } from 'node:http';
import payrollRouter from '../controllers/payroll/routes';

let server: Server, origin: string;
beforeAll(async () => {
     // Preserve the real route registrations and middleware order, replace business sinks only.
     for (const layer of (payrollRouter as any).stack) if (layer.route) {
          for (const handler of layer.route.stack) handler.handle = (req: any, res: any) => res.json({ body: req.body, params: req.params });
     }
     const app = express(); app.use(express.json());
     app.use((req: any, _res, next) => {
          if (req.headers['x-test-role']) req.authUser = { employeeid: 7, tenantId: 2, role: req.headers['x-test-role'], branch: 4 };
          next();
     });
     app.use('/api/v1/payroll', payrollRouter);
     server = createServer(app);
     await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
     origin = `http://127.0.0.1:${(server.address() as any).port}/api/v1/payroll`;
});
afterAll(async () => { if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
async function call(path: string, role: string | null = 'accountant', body?: unknown, method = body === undefined ? 'GET' : 'POST', tenant = 2) {
     return fetch(`${origin}${path}?tenantId=${tenant}`, { method, headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
describe('real payroll router finance boundary', () => {
     it.each(['/analytics', '/analytics/trend', '/periods/1', '/history', '/reversals', '/reversal-errors', '/tax-configurations', '/salary-grades', '/allowances', '/bonuses', '/deduction-definitions', '/other-deductions', '/deductions/other'])('denies ordinary staff finance access at %s', async path => {
          expect((await call(path, 'scientist')).status).toBe(403);
     });
     it.each(['admin', 'accountant', 'super_admin', 'Super Admin'])('keeps finance workflows available to %s', async role => {
          expect((await call('/periods/1/approve', role, { approved_by: 99 })).status).toBe(200);
     });
     it('rejects missing sessions and tenant mismatches before reaching financial sinks', async () => {
          expect((await call('/periods/1/approve', null, {})).status).toBe(401);
          expect((await call('/periods/1/approve', 'admin', {}, 'POST', 99)).status).toBe(403);
          expect((await call('/tax-configurations/1', 'scientist', undefined, 'DELETE')).status).toBe(403);
          expect((await call('/PERIODS/1/APPROVE', 'scientist', {})).status).toBe(403);
     });
     it.each([['process', 'calculated_by'], ['approve', 'approved_by'], ['lock', 'locked_by'], ['reverse', 'reversed_by'], ['recalculate-period', 'recalculated_by']])('binds omitted and forged actor on %s', async (action, field) => {
          for (const claimed of [undefined, 99]) {
               const response = await call(`/periods/1/${action}`, 'accountant', { ...(claimed ? { [field]: claimed } : {}), employeeIds: [3], branchid: 4, reason: 'Reviewed' });
               expect(response.status).toBe(200);
               expect((await response.json()).body).toMatchObject({ [field]: 7, employeeIds: [3], branchid: 4, reason: 'Reviewed' });
          }
     });
     it('binds payment actor without overwriting the employee whose salary is recalculated', async () => {
          const paid = await call('/periods/1/mark-paid', 'accountant', { employeeid: 99, paid_by: 99, branchid: 4, payment_method: 'Cash', payment_date: '2026-10-29' });
          expect((await paid.json()).body).toMatchObject({ employeeid: 7, paid_by: 7, branchid: 4, payment_method: 'Cash' });
          const recalc = await call('/periods/1/recalculate', 'accountant', { employeeid: 99 });
          expect((await recalc.json()).body.employeeid).toBe(99);
          expect((await call('/periods/1/approve', 'accountant', [])).status).toBe(400);
     });
     it.each(['all', 'garbage', '0', '%30', '8'])('prevents employee-history alias or subject bypass %s', async subject => {
          expect((await call(`/employee/${subject}/history`, 'scientist')).status).toBeGreaterThanOrEqual(400);
     });
     it('preserves own history/YTD, finance all-history, attendance and leave workflows', async () => {
          expect((await call('/employee/7/history', 'scientist')).status).toBe(200);
          expect((await call('/employee/7/ytd', 'scientist')).status).toBe(200);
          expect((await call('/employee/8/ytd', 'scientist')).status).toBe(403);
          expect((await call('/employee/all/history', 'accountant')).status).toBe(200);
          expect((await call('/attendance', 'scientist')).status).toBe(200);
          expect((await call('/leave', 'scientist', { employeeid: 7 })).status).toBe(200);
     });
});
