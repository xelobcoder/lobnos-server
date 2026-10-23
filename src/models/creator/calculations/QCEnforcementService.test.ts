import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ connection: vi.fn(), reviews: [] as any[], readings: [{ status: 'normal' }] as any[] }));
vi.mock('../../../database/KnexConnections', () => ({ default: state.connection }));
import { requireDailyQcAcceptance } from './QCEnforcementService';
function database() {
     const db: any = (table: string) => {
          const clauses: Record<string, any> = {};
          const query: any = {
               select: () => query, innerJoin: () => query, whereRaw: () => query, orderBy: () => query,
               where: (key: any, value: any) => { if (typeof key === 'object') Object.assign(clauses, key); else clauses[key.split('.').pop()] = value; return query; },
               whereNull: (key: string) => { clauses[key.split('.').pop()!] = null; return query; },
               first: async () => table === 'test_panels' ? { requires_qc: 1 } : [...state.reviews].filter(row => Object.entries(clauses).every(([key, value]) => row[key] === value)).sort((a,b) => b.id-a.id)[0],
               then: (resolve: any) => resolve(state.readings),
          }; return query;
     }; db.raw = (value: any) => value; return db;
}
const review = (overrides: any = {}) => ({ id: 1, testid: 20, branchid: 4, device_id: 'analyzer-a', current_device_id: 'analyzer-a', session_id: 'session-1', decision: 'accepted', material_status: 'active', material_unexpired: 1, session_is_today: 1, ...overrides });
const scope = { branchid: 4, deviceId: 'analyzer-a' };
beforeEach(() => { state.connection.mockResolvedValue(database()); state.reviews = []; state.readings = [{ status: 'normal' }]; });
describe('scoped current QC clearance', () => {
     it('blocks a QC-required test without a branch or current review', async () => {
          await expect(requireDailyQcAcceptance(1,20)).rejects.toThrow('branch');
          await expect(requireDailyQcAcceptance(1,20,scope)).rejects.toThrow('No current QC');
     });
     it('accepts a current same-branch same-analyzer review', async () => {
          state.reviews = [review()]; await expect(requireDailyQcAcceptance(1,20,scope)).resolves.toBeUndefined();
     });
     it('does not reuse another branch or analyzer clearance', async () => {
          state.reviews = [review()];
          await expect(requireDailyQcAcceptance(1,20,{ ...scope, branchid: 5 })).rejects.toThrow('No current QC');
          await expect(requireDailyQcAcceptance(1,20,{ ...scope, deviceId: 'analyzer-b' })).rejects.toThrow('No current QC');
     });
     it('uses a later rejection instead of an earlier acceptance', async () => {
          state.reviews = [review(), review({ id: 2, decision: 'rejected' })];
          await expect(requireDailyQcAcceptance(1,20,scope)).rejects.toThrow('revoked');
     });
     it('blocks changed readings and expired material despite earlier acceptance', async () => {
          state.reviews = [review()]; state.readings = [{ status: 'critical' }];
          await expect(requireDailyQcAcceptance(1,20,scope)).rejects.toThrow('normal');
          state.reviews = [review({ material_unexpired: 0 })];
          await expect(requireDailyQcAcceptance(1,20,scope)).rejects.toThrow('no longer valid');
     });
});
