import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enqueuePostingMock, recordSubledgerEntryMock } = vi.hoisted(() => ({
     enqueuePostingMock: vi.fn(),
     recordSubledgerEntryMock: vi.fn(),
}));

vi.mock('../services/AccountingOutboxService', () => ({ enqueuePosting: enqueuePostingMock }));
vi.mock('../services/SubledgerService', () => ({ recordSubledgerEntry: recordSubledgerEntryMock }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../hooks/logger', () => ({ default: { warn: vi.fn() } }));

import { enqueueBillingPayment, enqueueBillingReceivable, enqueueBillingRefund } from './BillingAccounting';

function makeDatabase(options: { receivable?: boolean; paymentMode?: string } = {}) {
     const database = ((table: string) => {
          const query: any = {
               select: () => query,
               where: () => query,
               whereIn: () => query,
               first: async () => {
                    if (table === 'billing') return { branchid: 4, billedon: new Date('2026-10-01T00:00:00Z'), patientid: 21, payable: 100, amountIncurredDueTax: 0 };
                    if (table === 'billinghx') return { Date: new Date('2026-10-04T00:00:00Z'), paymentmode: 8 };
                    if (table === 'paymentmodes') return { PaymentMode: options.paymentMode || 'Bank Transfer' };
                    if (table === 'acc_posting_outbox') return options.receivable ? { id: 1 } : undefined;
                    if (table === 'acc_journal_entries') return undefined;
                    return undefined;
               },
          };
          return query;
     }) as any;
     return database;
}

describe('billing accounting collection and refund postings', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          enqueuePostingMock.mockResolvedValue(undefined);
          recordSubledgerEntryMock.mockResolvedValue(undefined);
     });

     it('posts outstanding collections to bank and uses the collection date', async () => {
          const trx = makeDatabase({ receivable: true, paymentMode: 'Bank Transfer' });

          await enqueueBillingPayment(3, 77, 42, 25, 9, trx);

          const [tenantId, posting, usedTrx] = enqueuePostingMock.mock.calls[0];
          expect(tenantId).toBe(3);
          expect(usedTrx).toBe(trx);
          expect(posting.sourceTable).toBe('billinghx');
          expect(posting.sourcePk).toBe(77);
          expect(posting.occurredAt).toEqual(new Date('2026-10-04T00:00:00Z'));
          expect(posting.lines).toEqual(expect.arrayContaining([
               expect.objectContaining({ accountCode: 'acc-1001', direction: 'debit', amount: 25 }),
               expect.objectContaining({ accountCode: 'acc-1002', direction: 'credit', amount: 25 }),
          ]));
          expect(recordSubledgerEntryMock).toHaveBeenCalledWith(3, trx, expect.objectContaining({
               documentType: 'payment',
               sourceRef: '77',
               amount: -25,
          }));
     });

     it('propagates collection posting failures when called inside a billing transaction', async () => {
          const trx = makeDatabase({ receivable: true });
          enqueuePostingMock.mockRejectedValueOnce(new Error('outbox unavailable'));

          await expect(enqueueBillingPayment(3, 77, 42, 25, 9, trx)).rejects.toThrow('outbox unavailable');
     });

     it('propagates invoice accrual posting failures inside the billing transaction', async () => {
          const trx = makeDatabase();
          enqueuePostingMock.mockRejectedValueOnce(new Error('accrual outbox unavailable'));

          await expect(enqueueBillingReceivable(3, 42, 0, 0, trx)).rejects.toThrow('accrual outbox unavailable');
     });

     it('posts service refunds once by refund history id using the selected bank account', async () => {
          const trx = makeDatabase({ receivable: true, paymentMode: 'Mobile Money' });

          await enqueueBillingRefund(3, 42, 15, 15, 9, trx, 91, 8);

          const [, posting, usedTrx] = enqueuePostingMock.mock.calls[0];
          expect(usedTrx).toBe(trx);
          expect(posting.sourceTable).toBe('billinghx');
          expect(posting.sourcePk).toBe(91);
          expect(posting.sourceRef).toBe('91');
          expect(posting.lines).toEqual(expect.arrayContaining([
               expect.objectContaining({ accountCode: 'acc-1001', direction: 'credit', amount: 15 }),
               expect.objectContaining({ accountCode: 'acc-1002', direction: 'debit', amount: 15 }),
          ]));
          expect(recordSubledgerEntryMock).toHaveBeenCalledWith(3, trx, expect.objectContaining({
               documentType: 'refund',
               documentRef: 'REFUND-91',
               sourceTable: 'billinghx',
               sourceRef: '91',
               amount: 15,
          }));
     });

     it('propagates refund posting failures when called inside a billing transaction', async () => {
          const trx = makeDatabase({ receivable: true });
          enqueuePostingMock.mockRejectedValueOnce(new Error('refund outbox unavailable'));

          await expect(enqueueBillingRefund(3, 42, 15, 15, 9, trx, 91, 8)).rejects.toThrow('refund outbox unavailable');
     });
});
