import { afterEach, describe, expect, it, vi } from 'vitest';
import { accountingSqlDatabase } from '../testSupport/accountingSqlDatabase';
import type { TestPriceChange } from './application/TestCatalogManagement';

vi.mock('../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../database/KnexConnections';
import { TestPanelRepository } from './TestPanelRepository';

const databases: ReturnType<typeof accountingSqlDatabase>['db'][] = [];

async function createTenantDatabase() {
     const { db } = accountingSqlDatabase();
     databases.push(db);
     await db.schema.createTable('test_panels', table => {
          table.integer('id').primary();
          table.string('name');
          table.boolean('requires_qc');
          table.decimal('price');
     });
     await db.schema.createTable('testdetails', table => {
          table.integer('testid').primary();
          table.decimal('testprice');
          table.decimal('testcost');
          table.dateTime('updatedon');
     });
     return db;
}

afterEach(async () => {
     vi.resetAllMocks();
     while (databases.length) await databases.pop()!.destroy();
});

describe('test-panel QC persistence', () => {
     it('updates only the selected tenant and reports a missing panel', async () => {
          const first = await createTenantDatabase();
          const second = await createTenantDatabase();
          await first('test_panels').insert({ id: 1, requires_qc: 0 });
          await second('test_panels').insert({ id: 1, requires_qc: 0 });
          vi.mocked(KnexConnection).mockImplementation(async tenantId => {
               if (tenantId === 1) return first;
               if (tenantId === 2) return second;
               throw new Error('Unexpected tenant');
          });
          const repository = new TestPanelRepository();

          expect(await repository.updateQcRequirement(2, 1, true)).toEqual({ found: true, updated: 1 });
          expect(await first('test_panels').first()).toMatchObject({ requires_qc: 0 });
          expect(await second('test_panels').first()).toMatchObject({ requires_qc: 1 });
          expect(await repository.updateQcRequirement(2, 2, true)).toEqual({ found: false, updated: 0 });
     });
});

describe('test-panel catalog persistence', () => {
     it('updates both pricing records for the selected tenant in one transaction', async () => {
          const first = await createTenantDatabase();
          const second = await createTenantDatabase();
          await first('test_panels').insert({ id: 1, name: 'CBC', requires_qc: 0, price: 10 });
          await second('test_panels').insert({ id: 1, name: 'CBC', requires_qc: 0, price: 10 });
          await first('testdetails').insert({ testid: 1, testprice: 10, testcost: 2 });
          await second('testdetails').insert({ testid: 1, testprice: 10, testcost: 2 });
          vi.mocked(KnexConnection).mockImplementation(async tenantId => tenantId === 1 ? first : second);
          const changes: TestPriceChange[] = [{ testid: 1, price: 25, cost: 8 }];

          await new TestPanelRepository().updateBulkPricing(2, changes);

          expect(await first('test_panels').first()).toMatchObject({ price: 10 });
          expect(await first('testdetails').first()).toMatchObject({ testprice: 10, testcost: 2 });
          expect(await second('test_panels').first()).toMatchObject({ price: 25 });
          expect(await second('testdetails').first()).toMatchObject({ testprice: 25, testcost: 8 });
     });

     it('rolls back panel and detail updates together when a later row fails', async () => {
          const db = await createTenantDatabase();
          await db('test_panels').insert([{ id: 1, name: 'CBC', price: 10 }, { id: 2, name: 'ESR', price: 20 }]);
          await db('testdetails').insert([{ testid: 1, testprice: 10, testcost: 2 }, { testid: 2, testprice: 20, testcost: 4 }]);
          await db.raw("CREATE TRIGGER reject_second_price BEFORE UPDATE ON testdetails WHEN NEW.testid = 2 BEGIN SELECT RAISE(ABORT, 'Price update failed'); END");
          vi.mocked(KnexConnection).mockResolvedValue(db);

          await expect(new TestPanelRepository().updateBulkPricing(1, [
               { testid: 1, price: 25, cost: 8 },
               { testid: 2, price: 30, cost: 10 },
          ])).rejects.toThrow('Price update failed');
          expect(await db('test_panels').orderBy('id')).toMatchObject([{ price: 10 }, { price: 20 }]);
          expect(await db('testdetails').orderBy('testid')).toMatchObject([
               { testprice: 10, testcost: 2 }, { testprice: 20, testcost: 4 },
          ]);
     });

     it('checks, renames, and looks up catalog names in the selected tenant', async () => {
          const first = await createTenantDatabase();
          const second = await createTenantDatabase();
          await first('test_panels').insert({ id: 1, name: 'CBC' });
          await second('test_panels').insert({ id: 1, name: 'ESR' });
          vi.mocked(KnexConnection).mockImplementation(async tenantId => tenantId === 1 ? first : second);
          const repository = new TestPanelRepository();

          expect(await repository.findTestName(2, 1)).toBe('ESR');
          expect(await repository.testNameExists(2, ' ESR ')).toBe(true);
          expect(await repository.testNameExists(1, 'ESR')).toBe(false);
          expect(await repository.renameTest(2, 1, 'New ESR')).toBe(true);
          expect(await first('test_panels').first()).toMatchObject({ name: 'CBC' });
          expect(await second('test_panels').first()).toMatchObject({ name: 'New ESR' });
     });
});
