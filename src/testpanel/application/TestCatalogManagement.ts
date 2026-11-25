export interface TestPriceChange {
     testid: number;
     price: number;
     cost: number;
}

export interface TestCatalogRepository {
     updateQcRequirement(tenantId: number, testId: number, requiresQc: boolean): Promise<{ found: boolean; updated: number }>;
     updateBulkPricing(tenantId: number, tests: TestPriceChange[]): Promise<void>;
     findTestName(tenantId: number, testId: number): Promise<string | null>;
     testNameExists(tenantId: number, name: string): Promise<boolean>;
     renameTest(tenantId: number, testId: number, name: string): Promise<boolean>;
}

export interface TestCatalogCache {
     invalidate(tenantId: number): Promise<void>;
}

export class TestCatalogOperationError extends Error {
     constructor(readonly phase: 'write' | 'cache', readonly originalError: unknown) {
          super('Test catalog update failed');
          this.name = 'TestCatalogOperationError';
     }
}

export class TestCatalogManagement {
     constructor(private repository: TestCatalogRepository, private cache: TestCatalogCache) {}

     async updateQcRequirement(tenantId: number, testId: number, requiresQc: boolean): Promise<'not-found' | 'updated'> {
          const result = await this.repository.updateQcRequirement(tenantId, testId, requiresQc);
          if (!result.found) return 'not-found';
          if (result.updated > 0) await this.cache.invalidate(tenantId);
          return 'updated';
     }

     async updateBulkPricing(tenantId: number, tests: TestPriceChange[]): Promise<'empty' | 'invalid' | 'updated'> {
          if (!Array.isArray(tests) || tests.length === 0) return 'empty';
          if (tests.some(test => !test.testid || test.price === undefined || test.cost === undefined)) return 'invalid';

          try {
               await this.repository.updateBulkPricing(tenantId, tests);
          } catch (error) {
               throw new TestCatalogOperationError('write', error);
          }

          try {
               await this.cache.invalidate(tenantId);
          } catch (error) {
               throw new TestCatalogOperationError('cache', error);
          }
          return 'updated';
     }

     async renameTest(tenantId: number, testId: number, name: string): Promise<'invalid-name' | 'not-found' | 'unchanged' | 'duplicate' | 'updated'> {
          if (typeof name !== 'string' || name.length < 2) return 'invalid-name';

          const existingName = await this.repository.findTestName(tenantId, testId);
          if (!existingName) return 'not-found';
          if (existingName === name) return 'unchanged';
          if (await this.repository.testNameExists(tenantId, name)) return 'duplicate';

          if (!await this.repository.renameTest(tenantId, testId, name)) return 'not-found';
          await this.cache.invalidate(tenantId);
          return 'updated';
     }
}
