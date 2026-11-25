import express, { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
     connection: vi.fn(),
     invalidate: vi.fn(async (_tenantId: number) => undefined),
     customError: vi.fn(),
     responseError: vi.fn(),
     getPanelEditSingle: vi.fn(async () => [{ id: 1 }]),
     masterPanel: { id: 5, name: 'Imported', departmentName: 'Chemistry', price: 10 },
}));

vi.mock('../../services/cache/testPanelCache', () => ({ testPanelCache: { invalidate: mocks.invalidate } }));
vi.mock('../../database/KnexConnections', () => ({ default: (tenantId: number) => mocks.connection(tenantId) }));
vi.mock('../../hooks/helper', () => ({
     customError: mocks.customError, responseError: mocks.responseError, promisifyQuery: vi.fn(), rowAffected: vi.fn(),
}));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
vi.mock('../../models/creator/creator', () => ({ default: class {} }));
vi.mock('../../testpanel/categories', () => ({ getCategory: vi.fn(), postCategory: vi.fn() }));
vi.mock('../../testpanel/literature', () => ({ default: class {} }));
vi.mock('../../testpanel/testpanelList', () => ({ testpanel: { getPanelEditSingle: mocks.getPanelEditSingle } }));
vi.mock('../../models/TestCreation/TestCreationRulesRepository', () => ({ default: class {} }));
vi.mock('../../database/appLevelTriggers', () => ({ applyTestPanelsAfterInsert: vi.fn() }));
vi.mock('../../testpanel/testPanelId', () => ({ generateNextTestPanelId: vi.fn(async () => 99) }));
vi.mock('../../models/system-admin/MasterTestPanelRepository', () => ({
     default: class {
          async getMasterPanelByTestId() { return mocks.masterPanel; }
          async getMasterTestDetailsByTestId() { return null; }
          async getMasterSetupLiteratureByTestId() { return null; }
          async getMasterTestDetailCategoriesByTestId() { return []; }
          async getTestCreationRulesByTestId() { return []; }
     },
}));

import {
     getTestPanelEdit, importMasterTestPanelToClientList, putBulkTestPricingUpdate, putTestPanelQcRequirement,
} from './testpanelHandlers';

function request<TBody, TQuery>(body: TBody, query: TQuery): Request<{}, {}, TBody, TQuery> {
     return Object.assign(Object.create(express.request), { body, query });
}

function response() {
     const res: Response = Object.create(express.response);
     res.send = vi.fn<Response['send']>().mockReturnValue(res);
     res.status = vi.fn<Response['status']>().mockReturnValue(res);
     return res;
}

function builder() {
     return {
          where: vi.fn().mockReturnThis(),
          whereRaw: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          first: vi.fn(),
          insert: vi.fn(async () => [1]),
          update: vi.fn(async () => 1),
     };
}

beforeEach(() => {
     vi.clearAllMocks();
     mocks.invalidate.mockImplementation(async () => undefined);
});

describe('test-panel controller cache invalidation', () => {
     it('opts the catalogue edit endpoint into caching without changing its response', async () => {
          const res = response();
          await getTestPanelEdit(request({}, { tenantId: 12, id: 1, withoutdepartment: 'true' }), res);
          expect(mocks.getPanelEditSingle).toHaveBeenCalledWith(12, 1, false, true);
          expect(res.send).toHaveBeenCalledWith({ id: 1 });
     });

     it('invalidates QC requirement changes after the database update', async () => {
          const query = builder();
          query.first.mockResolvedValue({ id: 1 });
          mocks.connection.mockResolvedValue(vi.fn(() => query));
          const order: string[] = [];
          query.update.mockImplementation(async () => { order.push('update'); return 1; });
          mocks.invalidate.mockImplementation(async () => { order.push('invalidate'); });
          const res = response();
          vi.mocked(res.send).mockImplementation(() => { order.push('response'); return res; });
          await putTestPanelQcRequirement(request({ testid: 1, requiresQc: true }, { tenantId: '12' }), res);
          expect(order).toEqual(['update', 'invalidate', 'response']);
          expect(mocks.invalidate).toHaveBeenCalledWith(12);
          expect(mocks.connection).toHaveBeenCalledWith(12);
          expect(query.where).toHaveBeenCalledWith({ id: 1 });
          expect(query.update).toHaveBeenCalledWith({ requires_qc: 1 });
     });

     it('leaves the cache unchanged when a QC test does not exist', async () => {
          const query = builder();
          query.first.mockResolvedValue(undefined);
          mocks.connection.mockResolvedValue(vi.fn(() => query));
          const res = response();
          await putTestPanelQcRequirement(request({ testid: 42, requiresQc: false }, { tenantId: '12' }), res);
          expect(mocks.customError).toHaveBeenCalledWith('Test panel not found', 404, res);
          expect(query.update).not.toHaveBeenCalled();
          expect(mocks.invalidate).not.toHaveBeenCalled();
     });

     it('preserves no-op updates and accepts a disabled QC requirement', async () => {
          const query = builder();
          query.first.mockResolvedValue({ id: 1 });
          query.update.mockResolvedValue(0);
          mocks.connection.mockResolvedValue(vi.fn(() => query));
          const res = response();
          await putTestPanelQcRequirement(request({ testid: 1, requiresQc: false }, { tenantId: '12' }), res);
          expect(query.update).toHaveBeenCalledWith({ requires_qc: 0 });
          expect(mocks.invalidate).not.toHaveBeenCalled();
          expect(res.send).toHaveBeenCalledWith({ status: 'success', testid: 1, requiresQc: false });
     });

     it('reports QC persistence errors without invalidating the cache', async () => {
          const failure = new Error('Database unavailable');
          mocks.connection.mockRejectedValueOnce(failure);
          const res = response();
          await putTestPanelQcRequirement(request({ testid: 1, requiresQc: false }, { tenantId: '12' }), res);
          expect(mocks.responseError).toHaveBeenCalledWith(res, failure);
          expect(mocks.invalidate).not.toHaveBeenCalled();
     });

     it('invalidates bulk pricing only after commit and leaves a rolled-back batch alone', async () => {
          const query = builder();
          const order: string[] = [];
          const trx = Object.assign(vi.fn(() => query), {
               commit: vi.fn(async () => { order.push('commit'); }),
               rollback: vi.fn(async () => undefined),
               fn: { now: vi.fn() },
          });
          mocks.connection.mockResolvedValue({ transaction: async () => trx });
          mocks.invalidate.mockImplementation(async () => { order.push('invalidate'); });
          const req = request({ tests: [{ testid: 1, price: 20, cost: 5 }] }, { tenantId: 12 });
          await putBulkTestPricingUpdate(req, response());
          expect(order).toEqual(['commit', 'invalidate']);
          query.update.mockRejectedValueOnce(new Error('Pricing write failed'));
          await putBulkTestPricingUpdate(req, response());
          expect(trx.rollback).toHaveBeenCalledOnce();
          expect(mocks.invalidate).toHaveBeenCalledOnce();
          expect(mocks.customError).toHaveBeenCalledWith('Failed to update test pricing', 500, expect.anything());
     });

     it('invalidates a master import after commit but not a skipped existing panel', async () => {
          const panels = builder();
          panels.first.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ id: 99 });
          const roles = builder();
          roles.first.mockResolvedValue({ employeeid: 1 });
          const departments = builder();
          departments.first.mockResolvedValue({ id: 7 });
          const order: string[] = [];
          const trx = Object.assign(vi.fn((table: string) => {
               if (table === 'roles') return roles;
               if (table === 'departments') return departments;
               return panels;
          }), {
               commit: vi.fn(async () => { order.push('commit'); }),
               rollback: vi.fn(async () => undefined),
          });
          mocks.connection.mockResolvedValue({ transaction: async () => trx });
          mocks.invalidate.mockImplementation(async () => { order.push('invalidate'); });
          const req = request({}, { tenantId: '12', testid: '5' });
          const res = response();
          await importMasterTestPanelToClientList(req, res);
          expect(order).toEqual(['commit', 'invalidate']);
          expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
               message: '1 imported, 0 skipped, 0 failed',
          }));
          panels.first.mockResolvedValueOnce({ id: 99 });
          await importMasterTestPanelToClientList(req, response());
          expect(trx.rollback).toHaveBeenCalledOnce();
          expect(mocks.invalidate).toHaveBeenCalledOnce();
     });
});
