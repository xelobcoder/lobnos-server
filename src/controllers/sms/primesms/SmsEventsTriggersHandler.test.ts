import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ actor: vi.fn(), connection: vi.fn(), readiness: vi.fn(), critical: vi.fn(), send: vi.fn() }));
vi.mock('../../../middleware/authority', () => ({ getAuthUser: mocks.actor }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../../../models/operations/testApprovalClass', () => ({ TestApprovalClass: { getTransactionAscensionsApprovalStatus: mocks.readiness } }));
vi.mock('../../../models/operations/CriticalActionService', () => ({ assertCriticalRelease: mocks.critical }));
vi.mock('../../../models/application/sms/events/PrimeEventsDataSource', () => ({
     PrimeEventsSMSDataSource: class { testAscensionEventDataAllDone = mocks.send; },
}));
import { sendResultReadyEvent } from './SmsEventsTriggersHandler';

const ready = { ascensionid: 7, isapproved: 1, requires_revalidation: 0, resultEntryEnd: '2026-11-04' };
async function send(billingid = '2') {
     const response: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } };
     await sendResultReadyEvent({ query: { tenantId: '1', billingid, message: '' } } as any, response);
     return response;
}
beforeEach(() => {
     vi.clearAllMocks();
     mocks.actor.mockReturnValue({ employeeid: 9, tenantId: 1, branch: 4 });
     mocks.connection.mockResolvedValue(() => ({ where: () => ({ first: async () => ({ branchid: 4 }) }) }));
     mocks.readiness.mockResolvedValue([ready]);
     mocks.critical.mockResolvedValue(undefined);
     mocks.send.mockResolvedValue({ status: 'success' });
});
describe('imaging and laboratory result-ready SMS', () => {
     it('queues finalized imaging without requiring sample collection or processing', async () => {
          const response = await send();
          expect(response.body.success).toBe(true);
          expect(mocks.critical).toHaveBeenCalledWith(expect.any(Function), 7, 'release');
          expect(mocks.send).toHaveBeenCalledWith(1, 2, 9, true, '');
     });
     it.each([
          [], [{ ...ready, iscustom: 1, isapproved: null }], [{ ...ready, isapproved: 0 }],
          [{ ...ready, requires_revalidation: 1 }], [{ ...ready, resultEntryEnd: null }],
          [ready, { ...ready, ascensionid: 8, isapproved: null }],
     ].map(results => ({ results })))('never queues an incomplete bill %#', async ({ results }) => {
          mocks.readiness.mockResolvedValue(results);
          expect((await send()).statusCode).toBe(409);
          expect(mocks.send).not.toHaveBeenCalled();
     });
     it('preserves critical release holds', async () => {
          mocks.critical.mockRejectedValue(Object.assign(new Error('Critical release hold'), { statusCode: 409 }));
          const response = await send();
          expect(response.statusCode).toBe(409);
          expect(response.body.error).toBe('Critical release hold');
          expect(mocks.send).not.toHaveBeenCalled();
     });
     it.each([undefined, { status: false }])('does not report success when SMS is inactive or enqueue fails', async result => {
          mocks.send.mockResolvedValue(result);
          const response = await send();
          expect(response.statusCode).toBe(409);
          expect(response.body.success).toBe(false);
     });
     it('rejects unauthenticated requests and bills outside the branch', async () => {
          mocks.actor.mockReturnValue(null);
          expect((await send()).statusCode).toBe(401);
          mocks.actor.mockReturnValue({ employeeid: 9, branch: 5 });
          expect((await send()).statusCode).toBe(403);
          expect(mocks.send).not.toHaveBeenCalled();
     });
     it.each(['invalid', '2abc', '0', '-1'])('rejects invalid bill identity %s', async id => {
          expect((await send(id)).statusCode).toBe(400);
          expect(mocks.send).not.toHaveBeenCalled();
     });
});
