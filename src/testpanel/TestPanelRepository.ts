import KnexConnection from '../database/KnexConnections';
import type { TestCatalogRepository, TestPriceChange } from './application/TestCatalogManagement';

export class TestPanelRepository implements TestCatalogRepository {
     async updateQcRequirement(tenantId: number, testId: number, requiresQc: boolean): Promise<{ found: boolean; updated: number }> {
          const connection = await KnexConnection(tenantId);
          const existingTest = await connection('test_panels').select('id').where({ id: testId }).first();
          if (!existingTest) return { found: false, updated: 0 };
          const updated = await connection('test_panels')
               .where({ id: testId })
               .update({ requires_qc: requiresQc ? 1 : 0 });
          return { found: true, updated };
     }

     async updateBulkPricing(tenantId: number, tests: TestPriceChange[]): Promise<void> {
          const connection = await KnexConnection(tenantId);
          const transaction = await connection.transaction();
          try {
               for (const { testid, price, cost } of tests) {
                    await transaction('test_panels').where({ id: testid }).update({ price });
                    await transaction('testdetails').where({ testid }).update({
                         testprice: price,
                         testcost: cost,
                         updatedon: transaction.fn.now(),
                    });
               }
               await transaction.commit();
          } catch (error) {
               await transaction.rollback();
               throw error;
          }
     }

     async findTestName(tenantId: number, testId: number): Promise<string | null> {
          const connection = await KnexConnection(tenantId);
          const panel = await connection('test_panels').select('name').where({ id: testId }).first();
          return panel?.name ?? null;
     }

     async testNameExists(tenantId: number, name: string): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const result = await connection('test_panels').where('name', name.trim()).count('* as count').first();
          return Number(result?.count || 0) > 0;
     }

     async renameTest(tenantId: number, testId: number, name: string): Promise<boolean> {
          const connection = await KnexConnection(tenantId);
          const updated = await connection('test_panels').where({ id: testId }).update({ name });
          return updated > 0;
     }
}
