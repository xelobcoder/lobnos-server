import { describe, expect, it, vi } from 'vitest';
vi.mock('./authority', () => ({ getAuthUser: (request: any) => request.authUser }));
import { bindExpenseIdentity, blockPublicExpenseReceipts } from './expenseIdentity';
describe('expense request identity', () => {
     it.each(['/uploads/expenses/receipts/10.jpg', '/uploads/%65xpenses/receipts/10.jpg', '/UPLOADS/EXPENSES/RECEIPTS/10.jpg', '/uploads/other/../expenses/receipts/10.jpg'])('blocks public receipt access at %s', (url) => {
          const res: any = { status: vi.fn().mockReturnThis(), end: vi.fn() }, next = vi.fn();
          blockPublicExpenseReceipts({ path: url } as any, res, next);
          expect(res.status).toHaveBeenCalledWith(404);
          expect(next).not.toHaveBeenCalled();
     });
     it('replaces forged query and body employee, tenant and branch identifiers', () => {
          const req: any = { authUser: { employeeid: 7, branch: 4, tenantId: 2 }, query: { employeeid: '1', tenantId: '99', branchid: '9', paymentId: '12' }, body: { employeeid: 1, tenantId: 99, branchid: 9, amount: 30 } };
          const next = vi.fn();
          bindExpenseIdentity(req, {} as any, next);
          expect(req.query).toEqual({ employeeid: '7', tenantId: '2', branchid: '4', paymentId: '12' });
          expect(req.body).toEqual({ employeeid: 7, tenantId: 2, branchid: 4, amount: 30 });
          expect(next).toHaveBeenCalledOnce();
     });
     it('does not reinterpret a batch decision array as an expense object', () => {
          const body = [{ expenseid: 12, status: 'approved' }];
          const req: any = { authUser: { employeeid: 7, branch: 4, tenantId: 2 }, query: {}, body };
          bindExpenseIdentity(req, {} as any, vi.fn());
          expect(req.body).toEqual(body);
          expect(Object.keys(req.body)).toEqual(['0']);
     });
     it('rejects requests without an authenticated actor', () => {
          const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
          bindExpenseIdentity({ query: {}, body: {} } as any, res, next);
          expect(res.status).toHaveBeenCalledWith(401);
          expect(next).not.toHaveBeenCalled();
     });
});
