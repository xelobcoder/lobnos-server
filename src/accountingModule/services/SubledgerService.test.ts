import { beforeEach, describe, expect, it, vi } from 'vitest';

const { connectionMock } = vi.hoisted(() => ({ connectionMock: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: connectionMock }));

import { SubledgerService } from './SubledgerService';

function resultQuery<T>(result: T) {
     let filteredResult: any = result;
     const query: any = {
          where: () => query,
          andWhere: (column: string, operator: string, value: string) => {
               if (column === 'document_date' && operator === '<=' && Array.isArray(result)) {
                    filteredResult = result.filter((row: any) => row.document_date <= value);
               }
               return query;
          },
          orderBy: () => query,
          groupBy: () => query,
          select: () => query,
          whereIn: () => query,
          then: (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(filteredResult).then(resolve, reject),
     };
     return query;
}

const entries = [
     { id: 1, ledger: 'AR', party_type: 'patient', party_id: 11, document_type: 'invoice', document_ref: 'BILL-1', document_date: '2026-10-01', amount: 40 },
     { id: 2, ledger: 'AR', party_type: 'patient', party_id: 12, document_type: 'invoice', document_ref: 'BILL-2', document_date: '2026-10-04', amount: 60 },
     { id: 3, ledger: 'AR', party_type: 'patient', party_id: 11, document_type: 'invoice', document_ref: 'BILL-3', document_date: '2026-09-01', amount: 80 },
     { id: 4, ledger: 'AR', party_type: 'patient', party_id: 12, document_type: 'invoice', document_ref: 'BILL-4', document_date: '2026-10-06', amount: 70 },
];

const patients = [
     { patientid: 11, fullpatientid: 'PT-11', firstname: 'Ina', middlename: '', lastname: 'Older' },
     { patientid: 12, fullpatientid: 'PT-12', firstname: 'Arlo', middlename: 'M', lastname: 'Newer' },
];

const paymentHistory = [{ KeyID: 500, Billingid: 12 }];

describe('SubledgerService aging', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          const db: any = (table: string) => resultQuery(
               table === 'new_patients' ? patients : table === 'billinghx' ? paymentHistory : entries
          );
          db.raw = () => ({});
          connectionMock.mockResolvedValue(db);
     });

     it('filters by patient identity, sorts newest first, and keeps filtered totals independent of page size', async () => {
          const result = await new SubledgerService(3).aging('AR', '2026-10-05', {
               page: 1,
               count: 1,
               search: 'PT-12',
          });

          expect(result).toMatchObject({
               total: 1,
               page: 1,
               count: 1,
               totals: { total: 60 },
          });
          expect(result.rows).toHaveLength(1);
          expect(result.rows[0]).toMatchObject({
               partyId: 12,
               partyName: 'Arlo M Newer',
               patientIdentifier: 'PT-12',
               reference: 'BILL-2',
               documentDate: '2026-10-04',
          });
     });

     it('returns the newest open document first by default', async () => {
          const result = await new SubledgerService(3).aging('AR', '2026-10-05', { page: 1, count: 1 });

          expect(result.total).toBe(3);
          expect(result.rows[0].reference).toBe('BILL-2');
          expect(result.rows.some((row: any) => row.reference === 'BILL-4')).toBe(false);
     });

     it('applies Cash Collection credits to the billing transaction that was paid', async () => {
          const linkedPaymentEntries = [
               { id: 10, ledger: 'AR', party_type: 'patient', party_id: 12, document_type: 'invoice', document_ref: 'BILL-11', document_date: '2026-10-01', amount: 50 },
               { id: 11, ledger: 'AR', party_type: 'patient', party_id: 12, document_type: 'invoice', document_ref: 'BILL-12', document_date: '2026-10-04', amount: 50 },
               { id: 12, ledger: 'AR', party_type: 'patient', party_id: 12, document_type: 'payment', document_ref: 'PAY-500', document_date: '2026-10-04', source_module: 'billing', source_table: 'billinghx', source_ref: '500', amount: -50 },
          ];
          const db: any = (table: string) => resultQuery(
               table === 'new_patients' ? patients : table === 'billinghx' ? paymentHistory : linkedPaymentEntries
          );
          db.raw = () => ({});
          connectionMock.mockResolvedValue(db);

          const result = await new SubledgerService(3).aging('AR', '2026-10-05', {
               page: 1,
               count: 25,
               from: '2026-10-01',
               to: '2026-10-05',
          });

          expect(result.rows.map((row: any) => row.reference)).toEqual(['BILL-11']);
          expect(result.rows[0].total).toBe(50);
          expect(result.totals.total).toBe(50);
     });

     it('applies the selected age band to both invoice rows and summary totals', async () => {
          const result = await new SubledgerService(3).aging('AR', '2026-10-05', {
               page: 1,
               count: 25,
               ageBucket: 'days60',
          });

          expect(result.rows.map((row: any) => row.reference)).toEqual(['BILL-3']);
          expect(result.totals).toMatchObject({ current: 0, days30: 0, days60: 80, days90: 0, over90: 0, total: 80 });
     });

     it('limits invoice rows and summary totals to the selected document-date range', async () => {
          const result = await new SubledgerService(3).aging('AR', '2026-10-05', {
               page: 1,
               count: 25,
               from: '2026-10-04',
               to: '2026-10-04',
          });

          expect(result.rows.map((row: any) => row.reference)).toEqual(['BILL-2']);
          expect(result.total).toBe(1);
          expect(result.totals.total).toBe(60);
     });

     it.each(['AR', 'AP'] as const)('includes a new GHS 500 outstanding document in the selected day for %s', async (ledger) => {
          const datedEntries = [
               { id: 20, ledger, party_type: 'supplier', party_id: 20, party_name: 'Test party', document_ref: 'DOC-OLDER', document_date: '2026-10-04', amount: 100 },
               { id: 21, ledger, party_type: 'supplier', party_id: 20, party_name: 'Test party', document_ref: 'DOC-NEW', document_date: '2026-10-05', amount: 500 },
          ];
          connectionMock.mockResolvedValue(() => resultQuery(datedEntries));

          const result = await new SubledgerService(3).aging(ledger, '2026-10-05', {
               from: '2026-10-05',
               to: '2026-10-05',
               page: 1,
               count: 25,
               sortby: 'documentDate:desc',
          });

          expect(result.rows.map((row: any) => row.reference)).toEqual(['DOC-NEW']);
          expect(result.total).toBe(1);
          expect(result.totals.total).toBe(500);

          const oldestFirst = await new SubledgerService(3).aging(ledger, '2026-10-05', {
               from: '2026-10-04',
               to: '2026-10-05',
               sortby: 'documentDate:asc',
          });
          expect(oldestFirst.rows.map((row: any) => row.reference)).toEqual(['DOC-OLDER', 'DOC-NEW']);
     });

     it('sorts same-day outstanding documents by their entry IDs across parties', async () => {
          const sameDayEntries = [
               { id: 20, party_type: 'supplier', party_id: 1, document_ref: 'DOC-20', document_date: '2026-10-05', amount: 100 },
               { id: 21, party_type: 'supplier', party_id: 2, document_ref: 'DOC-21', document_date: '2026-10-05', amount: 500 },
               { id: 22, party_type: 'supplier', party_id: 1, document_ref: 'DOC-22', document_date: '2026-10-05', amount: 200 },
          ];
          connectionMock.mockResolvedValue(() => resultQuery(sameDayEntries));

          const newestFirst = await new SubledgerService(3).aging('AP', '2026-10-05', { sortby: 'documentDate:desc' });
          const oldestFirst = await new SubledgerService(3).aging('AP', '2026-10-05', { sortby: 'documentDate:asc' });

          expect(newestFirst.rows.map((row: any) => row.reference)).toEqual(['DOC-22', 'DOC-21', 'DOC-20']);
          expect(oldestFirst.rows.map((row: any) => row.reference)).toEqual(['DOC-20', 'DOC-21', 'DOC-22']);
     });

     it('adds patient names and identifiers to grouped balance rows', async () => {
          const balanceRows = [{
               party_type: 'patient',
               party_id: 12,
               party_name: null,
               documents: 1,
               charged: 60,
               settled: 0,
               balance: 60,
               oldest_document_date: '2026-10-04',
          }];
          const db: any = (table: string) => resultQuery(table === 'new_patients' ? patients : balanceRows);
          db.raw = () => ({});
          connectionMock.mockResolvedValue(db);

          const result = await new SubledgerService(3).balances('AR', undefined, { page: 1, count: 25 });

          expect(result.data[0]).toMatchObject({
               partyId: 12,
               partyName: 'Arlo M Newer',
               patientIdentifier: 'PT-12',
               balance: 60,
          });
     });
});
