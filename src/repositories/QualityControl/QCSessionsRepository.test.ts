import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     connectionMock: vi.fn(),
     readings: [] as any[],
     insertedReview: null as any,
}));

vi.mock('../../database/KnexConnections', () => ({ default: state.connectionMock }));

import { QCSessionsRepository } from './QCSessionsRepository';

function makeDatabase() {
     const database: any = (table: string) => {
          const records = table === 'qc_readings' ? state.readings : [];
          const query: any = {
               select: () => query,
               innerJoin: () => query,
               where: () => query,
               whereRaw: () => query,
               raw: (value: string) => value,
               first: async () => table === 'qc_sessions as qs' ? { id: 'session-1', testId: 10 } : undefined,
               insert: async (review: any) => { state.insertedReview = review; return [1]; },
               then: (resolve: any, reject: any) => Promise.resolve(records).then(resolve, reject),
          };
          return query;
     };
     database.raw = (value: string) => value;
     database.transaction = async (callback: (trx: any) => Promise<any>) => callback(database);
     return database;
}

describe('QC session review for result entry', () => {
     beforeEach(() => {
          state.readings = [{ status: 'normal' }];
          state.insertedReview = null;
          state.connectionMock.mockResolvedValue(makeDatabase());
     });

     it('records an accepted review only when readings are normal', async () => {
          await new QCSessionsRepository(1).recordResultEntryReview('session-1', 7, 'accepted');

          expect(state.insertedReview).toMatchObject({
               session_id: 'session-1',
               testid: 10,
               decision: 'accepted',
               employeeid: 7,
          });
     });

     it('rejects QC acceptance when any reading is not normal', async () => {
          state.readings = [{ status: 'normal' }, { status: 'critical' }];

          await expect(new QCSessionsRepository(1).recordResultEntryReview('session-1', 7, 'accepted'))
               .rejects.toThrow('all are normal');
          expect(state.insertedReview).toBeNull();
     });

     it('requires a reason for an exceptional bypass', async () => {
          await expect(new QCSessionsRepository(1).recordResultEntryReview('session-1', 7, 'bypassed', '  '))
               .rejects.toThrow('reason is required');
          expect(state.insertedReview).toBeNull();
     });
});