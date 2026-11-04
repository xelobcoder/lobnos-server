import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enqueuePostingMock, recordSubledgerEntryMock } = vi.hoisted(() => ({
     enqueuePostingMock: vi.fn(),
     recordSubledgerEntryMock: vi.fn(),
}));

vi.mock('../services/AccountingOutboxService', () => ({ enqueuePosting: enqueuePostingMock }));
vi.mock('../services/SubledgerService', () => ({ recordSubledgerEntry: recordSubledgerEntryMock }));
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../hooks/logger', () => ({ default: { warn: vi.fn() } }));

import { enqueueBillingPayment, enqueueBillingReceivable, enqueueBillingRefund, enqueueStaffFocBenefit, enqueueStaffFocBenefitReversal } from './BillingAccounting';

function makeDatabase(options: { receivable?: boolean; paymentMode?: string; focStatus?: string } = {}) {
     const database = ((table: string) => {
          const query: any = {
               select: () => query,
               where: () => query,
               whereIn: () => query,
               first: async () => {
                    if (table === 'billing') return { branchid: 4, billedon: new Date('2026-10-01T00:00:00Z'), patientid: 21, payable: 100, amountIncurredDueTax: 0 };
                    if (table === 'billinghx') return { Date: new Date('2026-10-04T00:00:00Z'), paymentmode: 8 };
                    if (table === 'paymentmodes') return { PaymentMode: options.paymentMode || 'Bank Transfer' };
                    if (table === 'staff_foc_transaction') return {
                         id: 14,
                         billingid: 42,
                         patientid: 21,
                         employeeid: 9,
                         foc_amount: 80,
                         status: options.focStatus || 'approved',
                         approved_by: 5,
                         approved_on: new Date('2026-10-04T12:00:00Z'),
                         reversed_by: 7,
                         reversed_at: new Date('2026-10-05T12:00:00Z'),
                    };
                    if (table === 'roles') return { username: 'Staff Member' };
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
          expect(recordSubledgerEntryMock.mock.calls[0][2].documentDate).toEqual(new Date('2026-10-04T00:00:00Z'));
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

     it('posts approved Staff FOC as a staff benefit and reduces patient receivables', async () => {
          const trx = makeDatabase();

          await enqueueStaffFocBenefit(3, 14, trx);

          const [, posting, usedTrx] = enqueuePostingMock.mock.calls[0];
          expect(usedTrx).toBe(trx);
          expect(posting.sourceTable).toBe('staff_foc_transaction');
          expect(posting.sourcePk).toBe(14);
          expect(posting.description).toContain('Staff Member');
          expect(posting.lines).toEqual(expect.arrayContaining([
               expect.objectContaining({ accountCode: 'acc-5010', direction: 'debit', amount: 80 }),
               expect.objectContaining({ accountCode: 'acc-1002', direction: 'credit', amount: 80 }),
          ]));
          expect(recordSubledgerEntryMock).toHaveBeenCalledWith(3, trx, expect.objectContaining({
               documentType: 'staff_foc',
               sourceRef: '14',
               amount: -80,
          }));
     });
     it('reverses net revenue and proportional VAT explicitly, keeping the refund journal balanced', async () => {
          await enqueueBillingRefund(3, 42, 20, 20, 9, makeDatabase({ receivable: true }), 92, 8, 1.82);
          const posting = enqueuePostingMock.mock.calls[0][1];
          expect(posting.lines).toEqual(expect.arrayContaining([
               expect.objectContaining({ accountCode: 'acc-4000', direction: 'debit', amount: 18.18 }),
               expect.objectContaining({ accountCode: 'acc-2002', direction: 'debit', amount: 1.82 }),
          ]));
          expect(Math.round(posting.lines.reduce((n: number, l: any) => n + (l.direction === 'debit' ? l.amount : -l.amount), 0) * 100)).toBe(0);
     });
     it('identifies cashless remaining-credit notes by positive refund event IDs', async () => {
          await enqueueBillingRefund(3, 42, 90, 0, 9, makeDatabase({ receivable: true }), undefined, 8, 8.18, 123);
          expect(enqueuePostingMock.mock.calls[0][1]).toMatchObject({ sourceTable: 'billing_refund_events', sourcePk: 123, sourceRef: '123' });
     });

     it('reverses Staff FOC by restoring receivables and reversing the benefit expense', async () => {
          const trx = makeDatabase({ focStatus: 'reversed' });

          await enqueueStaffFocBenefitReversal(3, 14, 'Correction', trx);

          const [, posting, usedTrx] = enqueuePostingMock.mock.calls[0];
          expect(usedTrx).toBe(trx);
          expect(posting.transactionType).toBe('reversal');
          expect(posting.sourceRef).toBe('reversal:14');
          expect(posting.lines).toEqual(expect.arrayContaining([
               expect.objectContaining({ accountCode: 'acc-1002', direction: 'debit', amount: 80 }),
               expect.objectContaining({ accountCode: 'acc-5010', direction: 'credit', amount: 80 }),
          ]));
          expect(recordSubledgerEntryMock).toHaveBeenCalledWith(3, trx, expect.objectContaining({
               documentType: 'staff_foc_reversal',
               sourceRef: 'reversal:14',
               amount: 80,
          }));
     });

     it('propagates refund posting failures when called inside a billing transaction', async () => {
          const trx = makeDatabase({ receivable: true });
          enqueuePostingMock.mockRejectedValueOnce(new Error('refund outbox unavailable'));

          await expect(enqueueBillingRefund(3, 42, 15, 15, 9, trx, 91, 8)).rejects.toThrow('refund outbox unavailable');
     });
});
