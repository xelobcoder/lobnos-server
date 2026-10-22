import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connect }));
vi.mock('../../hooks/logger', () => ({ default: { error: vi.fn() } }));
import { resetStaffPasswordHandler } from './authHandlers';

describe('administrative password reset session revocation', () => {
     beforeEach(() => vi.clearAllMocks());
     function setup(failRevoke = false) {
          const state = { password: 'old-password', refresh_token: 'old-refresh', loggedout: false };
          const filters: Array<Record<string, unknown>> = [];
          const trx = (table: string) => {
               const query = {
                    where: (filter: Record<string, unknown>) => { filters.push(filter); return query; },
                    forUpdate: () => query,
                    first: async () => ({ employeeid: 42 }),
                    update: async (changes: any) => {
                         if (table === 'loginlogs' && failRevoke) throw new Error('Revocation failed');
                         Object.assign(state, changes);
                         return 1;
                    },
               };
               return query;
          };
          const transaction = vi.fn(async (run: any) => {
               const snapshot = { ...state };
               try { return await run(trx); }
               catch (error) { Object.assign(state, snapshot); throw error; }
          });
          mocks.connect.mockResolvedValue({ transaction });
          const req: any = { query: { tenantId: '3' }, body: { employeeid: '42' },
               authUser: { employeeid: 1, tenantId: 3, role: 'admin' } };
          const res: any = { status: vi.fn().mockReturnThis(), send: vi.fn(), json: vi.fn() };
          return { state, filters, transaction, req, res };
     }

     it('changes credentials and closes sessions in the same transaction', async () => {
          const { state, filters, transaction, req, res } = setup();
          await resetStaffPasswordHandler(req, res);
          expect(transaction).toHaveBeenCalledOnce();
          expect(state.password).toMatch(/^\$2/);
          expect(state.refresh_token).toBeNull();
          expect(state.loggedout).toBe(true);
          expect(filters.every(filter => filter.employeeid === 42)).toBe(true);
          expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', temporaryPassword: expect.any(String) }));
     });

     it('returns an error and rolls back credentials if revocation fails', async () => {
          const { state, req, res } = setup(true);
          await resetStaffPasswordHandler(req, res);
          expect(state.password).toBe('old-password');
          expect(state.refresh_token).toBe('old-refresh');
          expect(state.loggedout).toBe(false);
          expect(res.status).toHaveBeenCalledWith(500);
          expect(res.send).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
     });

     it('does not change credentials for an unauthorized actor', async () => {
          const { req, res, transaction } = setup();
          req.authUser.role = 'scientist';
          await resetStaffPasswordHandler(req, res);
          expect(transaction).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
     });
});
