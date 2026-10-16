import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = vi.hoisted(() => ({ session: undefined as any, updated: 1, update: vi.fn() }));

vi.mock('../../database/KnexConnections', () => {
     const db: any = (table: string) => {
          const chain: any = {
               where: () => chain, whereRaw: () => chain,
               first: async () => state.session,
               update: async (values: any) => { state.update(table, values); return state.updated; },
          };
          return chain;
     };
     db.schema = { hasTable: async () => true, hasColumn: async () => true };
     return { default: async () => db };
});

import { SessionRevocation, SessionRevocationError } from './SessionRevocation';

describe('SessionRevocation.forceLogout', () => {
     beforeEach(() => {
          state.session = { keyid: 5, employeeid: 9, loggedout: 0, logoutTime: new Date(Date.now() + 3600_000) };
          state.updated = 1;
          state.update.mockClear();
     });

     it('closes an active session and records who forced it', async () => {
          const result = await new SessionRevocation(1).forceLogout(5, 2, '  left terminal open ');
          expect(result.employeeid).toBe(9);
          expect(state.update).toHaveBeenCalledWith('loginlogs', expect.objectContaining({
               loggedout: 1, forcedLogoutBy: 2, forcedLogoutReason: 'left terminal open',
          }));
     });

     it('rejects unknown, invalid and already closed sessions', async () => {
          state.session = undefined;
          await expect(new SessionRevocation(1).forceLogout(5, 2)).rejects.toMatchObject({ statusCode: 404 });
          await expect(new SessionRevocation(1).forceLogout(-1, 2)).rejects.toBeInstanceOf(SessionRevocationError);
          state.session = { keyid: 5, employeeid: 9, loggedout: 1, logoutTime: new Date(Date.now() + 3600_000) };
          await expect(new SessionRevocation(1).forceLogout(5, 2)).rejects.toMatchObject({ statusCode: 409 });
          expect(state.update).not.toHaveBeenCalled();
     });
});
