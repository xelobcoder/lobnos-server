import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({ overview: vi.fn(), transaction: vi.fn(), error: vi.fn(), responseError: vi.fn() }));
vi.mock('../../models/operations/operations', () => ({
     default: class { static getAscensionOverViewModel = mocks.overview; static getAscensionOverViewModelTransaction = mocks.transaction; },
}));
vi.mock('../../hooks/helper', () => ({
     customError: mocks.error, responseError: mocks.responseError, handleOverLoad: (handler: unknown) => handler,
}));
vi.mock('../../models/application/notifications/services/NotificationDispatcher', () => ({ NotificationDispatcher: {} }));
import { getAscensionOverViewModelHandler, getAscensionOverViewModelTransactionHandler } from './operationsHandlers';

const invoke = async (handler: typeof getAscensionOverViewModelHandler, query: Record<string, unknown>) => {
     const send = vi.fn();
     await handler({ query } as Request, { send } as unknown as Response);
     return send;
};

describe('laboratory folder tenant propagation', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          mocks.overview.mockResolvedValue([]);
          mocks.transaction.mockResolvedValue([]);
     });
     it.each([990556, 344423])('passes canonical tenantId %s to the folder model', async tenantId => {
          const send = await invoke(getAscensionOverViewModelHandler, {
               tenantId: String(tenantId), _dateFrom: '2026-10-09', _dateEnd: '2026-10-09', status: 'pending',
          });
          expect(mocks.overview).toHaveBeenCalledWith(tenantId, expect.objectContaining({
               _dateFrom: '2026-10-09', _dateEnd: '2026-10-09',
          }));
          expect(send).toHaveBeenCalledWith({ statusCode: 200, message: 'success', result: [] });
     });
     it('uses canonical tenantId rather than a conflicting lowercase identifier', async () => {
          await invoke(getAscensionOverViewModelTransactionHandler, { tenantId: '344423', tenantid: '990556', billingid: '42' });
          expect(mocks.transaction).toHaveBeenCalledWith(344423, 42);
     });
     it.each([undefined, '', 'NaN', '990556oops', '0', '-1', ['990556'], '9007199254740992'])(
          'rejects invalid tenantId %j before querying', async tenantId => {
               for (const handler of [getAscensionOverViewModelHandler, getAscensionOverViewModelTransactionHandler]) {
                    await invoke(handler, { tenantId, billingid: '42' });
               }
               expect(mocks.error).toHaveBeenCalledWith('Invalid tenantId', 400, expect.anything());
               expect(mocks.overview).not.toHaveBeenCalled();
               expect(mocks.transaction).not.toHaveBeenCalled();
          },
     );
});
