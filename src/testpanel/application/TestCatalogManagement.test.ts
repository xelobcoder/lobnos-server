import { describe, expect, it, vi } from 'vitest';
import { TestCatalogManagement } from './TestCatalogManagement';

describe('TestCatalogManagement', () => {
     it('validates bulk prices before persistence and invalidates after a successful write', async () => {
          const repository = {
               updateQcRequirement: vi.fn(),
               updateBulkPricing: vi.fn().mockResolvedValue(undefined),
               findTestName: vi.fn(),
               testNameExists: vi.fn(),
               renameTest: vi.fn(),
          };
          const cache = { invalidate: vi.fn().mockResolvedValue(undefined) };
          const management = new TestCatalogManagement(repository, cache);
          const changes = [{ testid: 1, price: 0, cost: 0 }];

          expect(await management.updateBulkPricing(8, [])).toBe('empty');
          expect(await management.updateBulkPricing(8, [{ ...changes[0], testid: 0 }])).toBe('invalid');
          expect(repository.updateBulkPricing).not.toHaveBeenCalled();
          expect(await management.updateBulkPricing(8, changes)).toBe('updated');
          expect(repository.updateBulkPricing).toHaveBeenCalledWith(8, changes);
          expect(cache.invalidate).toHaveBeenCalledWith(8);
     });

     it('does not invalidate cache when persistence fails and reports the failure phase', async () => {
          const failure = new Error('transaction failed');
          const repository = {
               updateQcRequirement: vi.fn(),
               updateBulkPricing: vi.fn().mockRejectedValue(failure),
               findTestName: vi.fn(),
               testNameExists: vi.fn(),
               renameTest: vi.fn(),
          };
          const cache = { invalidate: vi.fn() };
          await expect(new TestCatalogManagement(repository, cache).updateBulkPricing(8, [{ testid: 1, price: 5, cost: 2 }]))
               .rejects.toMatchObject({ name: 'TestCatalogOperationError', phase: 'write', originalError: failure });
          expect(cache.invalidate).not.toHaveBeenCalled();
     });

     it('invalidates the tenant cache only when QC state changed', async () => {
          const repository = {
               updateQcRequirement: vi.fn()
                    .mockResolvedValueOnce({ found: false, updated: 0 })
                    .mockResolvedValueOnce({ found: true, updated: 0 })
                    .mockResolvedValueOnce({ found: true, updated: 1 }),
               updateBulkPricing: vi.fn(),
               findTestName: vi.fn(),
               testNameExists: vi.fn(),
               renameTest: vi.fn(),
          };
          const cache = { invalidate: vi.fn().mockResolvedValue(undefined) };
          const management = new TestCatalogManagement(repository, cache);

          expect(await management.updateQcRequirement(8, 1, true)).toBe('not-found');
          expect(await management.updateQcRequirement(8, 2, false)).toBe('updated');
          expect(await management.updateQcRequirement(8, 3, true)).toBe('updated');
          expect(cache.invalidate).toHaveBeenCalledOnce();
          expect(cache.invalidate).toHaveBeenCalledWith(8);
     });

     it('preserves catalog rename outcomes and invalidates only after a successful rename', async () => {
          const repository = {
               updateQcRequirement: vi.fn(),
               updateBulkPricing: vi.fn(),
               findTestName: vi.fn()
                    .mockResolvedValueOnce(null)
                    .mockResolvedValueOnce('Current')
                    .mockResolvedValueOnce('Current')
                    .mockResolvedValueOnce('Current'),
               testNameExists: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
               renameTest: vi.fn().mockResolvedValue(true),
          };
          const cache = { invalidate: vi.fn().mockResolvedValue(undefined) };
          const management = new TestCatalogManagement(repository, cache);

          expect(await management.renameTest(8, 1, 'X')).toBe('invalid-name');
          expect(await management.renameTest(8, 1, 'Renamed')).toBe('not-found');
          expect(await management.renameTest(8, 2, 'Current')).toBe('unchanged');
          expect(await management.renameTest(8, 2, 'Renamed')).toBe('duplicate');
          expect(await management.renameTest(8, 2, 'New name')).toBe('updated');
          expect(repository.renameTest).toHaveBeenCalledWith(8, 2, 'New name');
          expect(cache.invalidate).toHaveBeenCalledOnce();
     });
});
