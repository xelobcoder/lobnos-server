import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ tenants: [] as number[], findByMerchantName: vi.fn(), create: vi.fn(), update: vi.fn(), findById: vi.fn(), findAll: vi.fn() }));
vi.mock('../../middleware/authority', () => ({ getAuthUser: (req: any) => req.authUser }));
vi.mock('../../models/Expenses/expenseMerchants', () => ({ default: class {
     constructor(tenantId: number) { mocks.tenants.push(tenantId); }
     findByMerchantName = mocks.findByMerchantName;
     create = mocks.create;
     update = mocks.update;
     findById = mocks.findById;
     findAll = mocks.findAll;
} }));
import { createExpenseMerchant, updateExpenseMerchant, getAllExpenseMerchants } from './ExpenseMerchantController';
const actor = { employeeid: 77, tenantId: 3, branch: 4 };
const request = (body: any = {}, query: any = {}) => ({ authUser: actor, body, query } as any);
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any);
beforeEach(() => { vi.clearAllMocks(); mocks.tenants.length = 0; mocks.findByMerchantName.mockResolvedValue(undefined); mocks.create.mockResolvedValue({ id: 10, name: 'Merchant' }); mocks.findAll.mockResolvedValue([]); });
describe('expense merchant requests', () => {
     it('creates in the session tenant, never in the employee ID or supplied tenant', async () => {
          const res = response();
          await createExpenseMerchant(request({ name: ' Merchant ', employeeid: 1, tenantId: 999 }), res);
          expect(mocks.tenants).toEqual([3]);
          expect(mocks.create).toHaveBeenCalledWith({ name: 'Merchant', created_by: 77 });
          expect(res.status).toHaveBeenCalledWith(201);
          expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', merchant: { id: 10, name: 'Merchant' } }));
     });
     it('reports an existing merchant instead of claiming to create it', async () => {
          mocks.findByMerchantName.mockResolvedValue({ id: 10 });
          const res = response(); await createExpenseMerchant(request({ name: 'Merchant' }), res);
          expect(res.status).toHaveBeenCalledWith(409);
          expect(mocks.create).not.toHaveBeenCalled();
     });
     it('uses valid default pagination when the refresh omits page and count', async () => {
          const res = response(); await getAllExpenseMerchants(request(), res);
          expect(mocks.tenants).toEqual([3]);
          expect(mocks.findAll).toHaveBeenCalledWith(10, 1);
     });
     it('rejects invalid fields and pagination without writing', async () => {
          const invalid = response(); await createExpenseMerchant(request({ name: ' ', phone: 'abc' }), invalid);
          expect(invalid.status).toHaveBeenCalledWith(400);
          expect(mocks.create).not.toHaveBeenCalled();
          const pagination = response(); await getAllExpenseMerchants(request({}, { count: 'NaN', page: '-1' }), pagination);
          expect(pagination.status).toHaveBeenCalledWith(400);
     });
     it('updates in the authenticated tenant and records the authenticated editor', async () => {
          mocks.findById.mockResolvedValue({ id: 10 });
          const res = response(); await updateExpenseMerchant(request({ id: 10, name: 'Updated' }), res);
          expect(mocks.tenants).toEqual([3]);
          expect(mocks.update).toHaveBeenCalledWith({ id: 10, name: 'Updated', updated_by: 77 });
     });
});
