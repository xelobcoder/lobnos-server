import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
     sessions: [] as Array<{ keyid: number; employeeid: number; loginSessionId: string; loggedout: boolean }>,
     lock: vi.fn(),
     destroy: vi.fn(),
}));
vi.mock('../../../database/KnexConnections', () => ({
     default: async () => ({
          transaction: async (run: (trx: unknown) => Promise<number>) => {
               const query = { where: () => query, forUpdate: () => query, first: state.lock };
               return run(() => query);
          },
     }),
}));
vi.mock('../repositories/loginlog.repo', () => ({
     ApplicationLoginLog: class {
          async destroyUserSessions(employeeid: number, _trx: unknown, preserveManager: boolean) {
               state.destroy(employeeid, preserveManager);
               for (const session of state.sessions) {
                    if (session.employeeid === employeeid && !(preserveManager && session.loginSessionId.startsWith('device-manager:'))) {
                         session.loggedout = true;
                    }
               }
          }
          async createHistoryLog(employeeid: number, _browser: unknown, _trx: unknown, _fingerprint: unknown, type: string) {
               const keyid = state.sessions.length + 1;
               state.sessions.push({ keyid, employeeid, loginSessionId: `${type === 'device-manager' ? 'device-manager:' : ''}${keyid}`, loggedout: false });
               return keyid;
          }
          async findHistoryLogById(id: number) { return state.sessions.find(session => session.keyid === id); }
     },
}));
import { ApplicationLoginLoggingService } from './ApplicationLoginLoggging.services';

describe('staff session isolation', () => {
     beforeEach(() => { state.sessions.length = 0; vi.clearAllMocks(); });

     it('browser A -> Device Manager -> browser B keeps the manager but replaces browser A', async () => {
          const service = new ApplicationLoginLoggingService(1, 3);
          await service.initUserLoginSession({}, 'browser-a');
          await service.initUserLoginSession({}, 'manager', 'device-manager');
          expect(state.sessions.map(session => session.loggedout)).toEqual([false, false]);
          await service.initUserLoginSession({}, 'browser-b');
          expect(state.sessions.map(session => session.loggedout)).toEqual([true, false, false]);
          await service.initUserLoginSession({}, 'another-manager', 'device-manager');
          expect(state.sessions.map(session => session.loggedout)).toEqual([true, false, false, false]);
          expect(state.destroy.mock.calls).toEqual([[1, true], [1, true]]);
          expect(state.lock).toHaveBeenCalledTimes(4);
     });

     it('keeps existing browser replacement behavior and does not close another employee session', async () => {
          const first = new ApplicationLoginLoggingService(1, 3);
          await first.initUserLoginSession({});
          await new ApplicationLoginLoggingService(2, 3).initUserLoginSession({});
          await first.initUserLoginSession({});
          expect(state.sessions.map(session => session.loggedout)).toEqual([true, false, false]);
     });
});
