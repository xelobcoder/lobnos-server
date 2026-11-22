import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), info: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../../hooks/logger', () => ({ default: { info: mocks.info } }));

import { bootstrapDefaultBranch } from './BranchBootstrapper';

function harness(initialBranches: Array<Record<string, unknown>> = [], profile?: Record<string, unknown>) {
     const branches = [...initialBranches];
     const hasTable = vi.fn(async (table: string) => table === 'branch' || Boolean(profile && table === 'companyprofile'));
     const transaction = async (work: (trx: any) => Promise<unknown>) => {
          const trx: any = (table: string) => {
               const query: any = {
                    orderBy: () => query,
                    forUpdate: () => query,
                    first: async () => table === 'branch' ? branches[0] : profile,
                    insert: async (row: Record<string, unknown>) => {
                         branches.push(row);
                         return [row.branchid];
                    },
               };
               return query;
          };
          trx.schema = { hasTable };
          return work(trx);
     };
     const connection = {
          schema: { hasTable },
          transaction,
     };
     return { branches, connection };
}

describe('default branch bootstrap', () => {
     beforeEach(() => vi.clearAllMocks());
     afterEach(() => vi.restoreAllMocks());

     it('creates branch 1 as the active default using available facility details', async () => {
          const { branches, connection } = harness([], {
               NAME: 'Example Laboratory',
               ADDRESS: 'Main Road',
               EMAIL: 'lab@example.test',
               PHONENUMBER: '0241234567',
          });
          mocks.connection.mockResolvedValue(connection);

          await bootstrapDefaultBranch(42);

          expect(branches).toEqual([{
               branchid: 1,
               name: 'Example Laboratory',
               address: 'Main Road',
               email: 'lab@example.test',
               contact: 241234567,
               managerid: '1',
               activation: 1,
          }]);
          expect(mocks.info).toHaveBeenCalledWith('[Bootstrap] Created default active branch for tenant 42');
     });

     it('uses safe defaults when the facility profile is empty', async () => {
          const { branches, connection } = harness();
          mocks.connection.mockResolvedValue(connection);

          await bootstrapDefaultBranch();

          expect(branches[0]).toMatchObject({
               branchid: 1,
               name: 'Main Branch',
               contact: 0,
               managerid: '1',
               activation: 1,
          });
     });

     it('does not add or reactivate a branch when a branch row already exists', async () => {
          const existing = { branchid: 3, name: 'Closed branch', activation: 0 };
          const { branches, connection } = harness([existing]);
          mocks.connection.mockResolvedValue(connection);

          await bootstrapDefaultBranch(42);

          expect(branches).toEqual([existing]);
          expect(mocks.info).not.toHaveBeenCalled();
     });

     it('fails explicitly when the facility schema has no branch table', async () => {
          const connection = {
               schema: { hasTable: vi.fn(async () => false) },
               transaction: vi.fn(),
          };
          mocks.connection.mockResolvedValue(connection);

          await expect(bootstrapDefaultBranch(42)).rejects.toThrow('branch table is missing');
          expect(connection.transaction).not.toHaveBeenCalled();
     });
});
