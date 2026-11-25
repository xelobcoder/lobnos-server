import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
     customError: vi.fn(),
     responseError: vi.fn(),
     loggerError: vi.fn(),
}));

vi.mock('../../hooks/helper', () => ({ customError: mocks.customError, responseError: mocks.responseError }));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.loggerError } }));

import { TestCatalogController } from './TestCatalogController';
import { TestCatalogManagement } from '../../testpanel/application/TestCatalogManagement';

function response() {
     return { send: vi.fn().mockReturnThis() } as unknown as Response;
}

function request(body: Record<string, unknown>, tenantId = '8'): Request {
     return { body, query: { tenantId } } as unknown as Request;
}

function controller() {
     const repository = {
          updateQcRequirement: vi.fn().mockResolvedValue({ found: true, updated: 1 }),
          updateBulkPricing: vi.fn().mockResolvedValue(undefined),
          findTestName: vi.fn(),
          testNameExists: vi.fn(),
          renameTest: vi.fn(),
     };
     const cache = { invalidate: vi.fn().mockResolvedValue(undefined) };
     const management = new TestCatalogManagement(repository, cache);
     return { controller: new TestCatalogController(management), repository, cache };
}

beforeEach(() => vi.clearAllMocks());

describe('TestCatalogController', () => {
     it('preserves the QC endpoint response and validates its request', async () => {
          const { controller: handler, repository, cache } = controller();
          const res = response();
          await handler.updateQcRequirement(request({ testid: 5, requiresQc: true }), res);
          expect(repository.updateQcRequirement).toHaveBeenCalledWith(8, 5, true);
          expect(cache.invalidate).toHaveBeenCalledWith(8);
          expect(res.send).toHaveBeenCalledWith({ status: 'success', testid: 5, requiresQc: true });

          await handler.updateQcRequirement(request({ testid: 0, requiresQc: true }), res);
          expect(mocks.customError).toHaveBeenCalledWith('testid and boolean requiresQc are required', 400, res);
     });

     it('preserves bulk-pricing response and error mappings', async () => {
          const { controller: handler, repository } = controller();
          const res = response();
          await handler.updateBulkPricing(request({ tests: [{ testid: 5, price: 20, cost: 8 }] }), res);
          expect(repository.updateBulkPricing).toHaveBeenCalledWith(8, [{ testid: 5, price: 20, cost: 8 }]);
          expect(res.send).toHaveBeenCalledWith({
               message: 'Test pricing updated successfully', statusCode: 200, status: 'success',
          });

          await handler.updateBulkPricing(request({ tests: [] }), res);
          expect(mocks.customError).toHaveBeenCalledWith('Tests array is required and must not be empty', 400, res);
     });

     it('preserves the test rename endpoint response', async () => {
          const { controller: handler, repository } = controller();
          vi.mocked(repository.findTestName).mockResolvedValue('Old name');
          vi.mocked(repository.testNameExists).mockResolvedValue(false);
          vi.mocked(repository.renameTest).mockResolvedValue(true);
          const res = response();
          await handler.renameTest(request({ testid: 5, name: 'New name' }), res);
          expect(repository.renameTest).toHaveBeenCalledWith(8, 5, 'New name');
          expect(res.send).toHaveBeenCalledWith({ status: 'success' });
     });
});
