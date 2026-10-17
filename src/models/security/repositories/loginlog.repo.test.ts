import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     insert: vi.fn(), where: vi.fn(), andWhere: vi.fn(), whereNot: vi.fn(), update: vi.fn(),
}));
vi.mock('../../../database/KnexConnections', () => ({
     default: async () => {
          const query = {
               insert: state.insert, where: state.where, andWhere: state.andWhere,
               whereNot: state.whereNot, update: state.update,
               returning: async () => [1],
          };
          for (const method of Object.values(state)) method.mockReturnValue(query);
          return Object.assign(() => query, { schema: { hasColumn: async () => true } });
     },
}));
import { ApplicationLoginLog } from './loginlog.repo';

describe('session storage classification', () => {
     beforeEach(() => vi.clearAllMocks());

     it('stores a server-generated manager prefix independently of caller browser information', async () => {
          const repo = new ApplicationLoginLog(1, 3);
          await repo.createHistoryLog(1, '{}', undefined, 'fingerprint', 'device-manager');
          expect(state.insert.mock.calls[0][0]).toMatchObject({
               employeeid: 1, deviceFingerprint: 'fingerprint',
               loginSessionId: expect.stringMatching(/^device-manager:[a-f0-9-]{36}$/),
          });
          await repo.createHistoryLog(1, '{"clientType":"device-manager"}');
          expect(state.insert.mock.calls[1][0].loginSessionId).not.toMatch(/^device-manager:/);
     });

     it('preserves manager sessions only when requested by browser login, not administrative revocation', async () => {
          const repo = new ApplicationLoginLog(1, 3);
          await repo.destroyUserSessions(1, undefined, true);
          expect(state.whereNot).toHaveBeenCalledWith('loginSessionId', 'like', 'device-manager:%');
          expect(state.where).toHaveBeenCalledWith('employeeid', 1);
          state.whereNot.mockClear();
          await repo.destroyUserSessions(1);
          expect(state.whereNot).not.toHaveBeenCalled();
     });
});
