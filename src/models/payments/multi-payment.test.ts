import { beforeEach, describe, expect, it, vi } from 'vitest';

const { knexMock, enqueueBillingPaymentMock } = vi.hoisted(() => ({
     knexMock: vi.fn(),
     enqueueBillingPaymentMock: vi.fn(),
}));

vi.mock('../../database/KnexConnections', () => ({ default: knexMock }));
vi.mock('../../accountingModule/integrations/BillingAccounting', () => ({ enqueueBillingPayment: enqueueBillingPaymentMock }));
vi.mock('../Expenses/AutomatedExpenseLifecycle', () => ({ default: class { async process() { return undefined; } } }));

import MultiPayment from './multi-payment';

function queryBuilder(result: any) {
     const query: any = {
          forUpdate: () => query,
          orderBy: () => query,
          select: () => query,
          where: () => query,
          whereIn: () => query,
          join: () => query,
          leftJoin: () => query,
          first: async () => Array.isArray(result) ? result[0] : result,
          update: async () => 1,
          insert: async () => [501],
          then: (resolve: (value: any) => any, reject: (reason: any) => any) => Promise.resolve(result).then(resolve, reject),
     };
     return query;
}

describe('MultiPayment accounting integration', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          enqueueBillingPaymentMock.mockResolvedValue(undefined);

          let serviceQueryCount = 0;
          const trx: any = (table: string) => {
               if (table === 'dboservices') {
                    serviceQueryCount++;
                    return serviceQueryCount === 1
                         ? queryBuilder({ serviceid: 10, billingid: 42, patientid: 21, branchid: 4, paidamount: 0, outstanding: 40, totalpayable: 40, paymentstatus: 'pending', status: 'active' })
                         : queryBuilder([{ serviceid: 10, billingid: 42, paidamount: 25, outstanding: 15, totalpayable: 40, amountRefunded: 0 }]);
               }
               if (table === 'billing') return queryBuilder({ billingid: 42, branchid: 4, billedon: '2026-10-01', writeoff: 0 });
               if (table === 'billinghx') return queryBuilder([501]);
               return queryBuilder([]);
          };
          trx.commit = vi.fn().mockResolvedValue(undefined);
          trx.rollback = vi.fn().mockResolvedValue(undefined);

          const connection: any = (table: string) => {
               if (table === 'dboservices') return queryBuilder([{ serviceid: 10, outstanding: 40 }]);
               return queryBuilder([]);
          };
          connection.transaction = vi.fn().mockResolvedValue(trx);
          knexMock.mockResolvedValue(connection);
     });

     it('enqueues each cash collection against its billing history ID in the same transaction', async () => {
          const result = await new MultiPayment(3).processPayment({
               service_payments: [{ service_id: 10, billing_id: 42, amount: 25, discount: 0, waive_off: 0, payment_mode_id: 8 }],
               total_amount: 25,
               total_discount: 0,
               total_waive_off: 0,
               description: 'Cash collection',
               employeeid: 9,
               tenantId: 3,
          });

          expect(result.success).toBe(true);
          expect(enqueueBillingPaymentMock).toHaveBeenCalledWith(3, 501, 42, 25, 9, expect.any(Function));
     });
});
