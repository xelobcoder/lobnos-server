import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectionMock, postTransactionMock } = vi.hoisted(() => ({
     connectionMock: vi.fn(),
     postTransactionMock: vi.fn(),
}));

vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));
vi.mock('../index', () => ({ createAccountingService: vi.fn(() => ({ postTransaction: postTransactionMock })) }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

import { enqueuePosting, processPendingOutbox } from './AccountingOutboxService';

describe('AccountingOutboxService', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          const rows = Array.from({ length: 5 }, (_, index) => ({
               id: index + 1,
               payload: JSON.stringify({ sourcePk: index + 1 }),
               status: 'pending',
               attempts: 0,
          }));

          const db: any = (table: string) => {
               if (table !== 'acc_posting_outbox') throw new Error(`Unexpected table ${table}`);

               let statuses: string[] = [];
               let rowId: number | null = null;
               let limit = rows.length;
               const query: any = {
                    whereIn: (_column: string, values: string[]) => { statuses = values; return query; },
                    andWhere: () => query,
                    orderBy: () => query,
                    limit: (value: number) => { limit = value; return query; },
                    where: (condition: { id: number }) => { rowId = condition.id; return query; },
                    update: async (updates: any) => {
                         const row = rows.find((item) => item.id === rowId);
                         if (!row) return 0;
                         Object.assign(row, updates);
                         return 1;
                    },
                    then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) => {
                         const selected = rows.filter((row) => statuses.includes(row.status) && row.attempts < 5).slice(0, limit);
                         return Promise.resolve(selected).then(resolve, reject);
                    },
               };
               return query;
          };

          connectionMock.mockResolvedValue(db);
          postTransactionMock.mockResolvedValue(undefined);
     });

     it('drains multiple batches in one sweep instead of waiting for later timer ticks', async () => {
          await processPendingOutbox(7, 2);

          expect(postTransactionMock).toHaveBeenCalledTimes(5);
     });

     it('starts processing after the producer transaction commits', async () => {
          const outboxQuery: any = {
               insert: () => outboxQuery,
               onConflict: () => outboxQuery,
               ignore: async () => undefined,
               whereIn: () => outboxQuery,
               andWhere: () => outboxQuery,
               orderBy: () => outboxQuery,
               limit: () => outboxQuery,
               where: () => outboxQuery,
               update: async () => 1,
               then: (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve([{
                    id: 10,
                    payload: JSON.stringify({ sourcePk: 10 }),
                    status: 'pending',
                    attempts: 0,
               }]).then(resolve, reject),
          };
          const trx: any = () => outboxQuery;
          trx.executionPromise = Promise.resolve();
          const db: any = () => outboxQuery;
          connectionMock.mockResolvedValue(db);

          await enqueuePosting(7, {
               tenantId: 7,
               transactionType: 'payment',
               sourceModule: 'billing',
               sourceTable: 'billinghx',
               sourcePk: 10,
               lines: [],
          } as any, trx);

          await vi.waitFor(() => expect(postTransactionMock).toHaveBeenCalledTimes(1));
     });
});
