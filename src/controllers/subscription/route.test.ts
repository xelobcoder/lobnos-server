import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     checkTokenExists: vi.fn(), tenantPlanView: vi.fn(), createUpgradeRequest: vi.fn(), tenantUpgradeRequests: vi.fn(),
}));
vi.mock('../../middleware/validateTenancy', () => ({ checkTokenExists: mocks.checkTokenExists }));
vi.mock('../../models/Tenancy/FacilitySubscriptionTiers', () => ({
     FacilitySubscriptionTierService: class {
          tenantPlanView = mocks.tenantPlanView;
          createUpgradeRequest = mocks.createUpgradeRequest;
          tenantUpgradeRequests = mocks.tenantUpgradeRequests;
     },
}));

import router, { authorizeTenant } from './route';

const stack = (router as any).stack;
const routeList = stack.filter((layer: any) => layer.route).map((layer: any) => ({
     path: layer.route.path, method: Object.keys(layer.route.methods)[0], stack: layer.route.stack,
}));
const invoke = async (method: string, path: string, req: any) => {
     const route = routeList.find((item: any) => item.method === method && item.path === path)!;
     const res: any = { locals: {} };
     res.status = vi.fn().mockReturnValue(res);
     res.send = vi.fn().mockReturnValue(res);
     res.json = vi.fn().mockReturnValue(res);
     await route.stack[0].handle({ params: {}, query: {}, body: {}, ...req }, res);
     return res;
};

describe('tenant subscription plan routes', () => {
     beforeEach(() => vi.clearAllMocks());

     it('uses existing tenant auth and exposes the requested route set', () => {
          expect(stack.some((layer: any) => layer.handle === mocks.checkTokenExists)).toBe(true);
          expect(routeList.map((route: any) => `${route.method} ${route.path}`)).toEqual([
               'get /api/v1/subscription/plan',
               'get /api/v1/subscription/upgrade-requests',
               'post /api/v1/subscription/upgrade-requests',
          ]);
     });

     it('requires the authenticated tenant query to match and permits only admin/super-admin roles', () => {
          const next = vi.fn();
          const response: any = { locals: {}, status: vi.fn().mockReturnThis(), send: vi.fn() };
          authorizeTenant({ query: { tenantId: '222222' }, authUser: { tenantId: 222222, role: 'admin' } } as any, response, next);
          expect(next).toHaveBeenCalledOnce();

          next.mockClear();
          authorizeTenant({ query: { tenantId: '333333' }, authUser: { tenantId: 222222, role: 'admin' } } as any, response, next);
          expect(response.status).toHaveBeenLastCalledWith(403);
          expect(next).not.toHaveBeenCalled();

          authorizeTenant({ query: { tenantId: '222222' }, authUser: { tenantId: 222222, role: 'scientist' } } as any, response, next);
          expect(response.status).toHaveBeenLastCalledWith(403);
          authorizeTenant({ query: { tenantId: '222222x' }, authUser: { tenantId: 222222, role: 'admin' } } as any, response, next);
          expect(response.status).toHaveBeenLastCalledWith(400);
     });

     it('returns the tenant plan view and forwards only authenticated tenant identity on requests', async () => {
          const view = { current: { planCode: null }, plans: [], pendingRequest: null };
          mocks.tenantPlanView.mockResolvedValue(view);
          const getPlan = await invoke('get', '/api/v1/subscription/plan', {
               query: { tenantId: '222222' }, authUser: { tenantId: 222222, role: 'admin' },
          });
          expect(mocks.tenantPlanView).toHaveBeenCalledWith(222222);
          expect(getPlan.json).toHaveBeenCalledWith({ status: 'success', result: view });

          const request = { id: 7, tenantId: 222222, toPlanCode: 'professional', status: 'pending' };
          mocks.createUpgradeRequest.mockResolvedValue(request);
          const post = await invoke('post', '/api/v1/subscription/upgrade-requests', {
               query: { tenantId: '222222' }, authUser: {
                    tenantId: 222222, employeeid: 9, role: 'admin', email: 'admin@example.test',
               },
               body: { planCode: 'professional', tenantId: 999999 },
          });
          expect(mocks.createUpgradeRequest).toHaveBeenCalledWith(222222, 'professional', 'admin@example.test',
               { tenantId: 222222, employeeId: 9 });
          expect(post.json).toHaveBeenCalledWith({ status: 'success', result: request });
     });
});
