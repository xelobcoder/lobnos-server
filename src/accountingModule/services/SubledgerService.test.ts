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

describe('SubledgerService aging', () => {
     beforeEach(() => {
          vi.clearAllMocks();
          const db: any = (table: string) => resultQuery(table === 'new_patients' ? patients : entries);
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
