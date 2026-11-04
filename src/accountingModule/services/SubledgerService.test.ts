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
               table === 'new_patients' ? patients : table === 'billinghx' ? paymentHistory
                    : table === 'dboservices' ? [] : table === 'billing' ? [{ billingid: 1, patientid: 11 }, { billingid: 2, patientid: 12 }, { billingid: 3, patientid: 11 }, { billingid: 4, patientid: 12 }] : entries
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
               table === 'new_patients' ? patients : table === 'billinghx' ? paymentHistory
                    : table === 'dboservices' ? [] : table === 'billing' ? [{ billingid: 11, patientid: 12 }, { billingid: 12, patientid: 12 }] : linkedPaymentEntries
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
               ledger: 'AR',
               amount: 60,
               document_date: '2026-10-04',
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

     function nhisDatabase(ledgerEntries: any[]) {
          const tables: Record<string, any[]> = {
               acc_subledger_entries: ledgerEntries,
               billing: [{ billingid: 101, patientid: 12 }, { billingid: 102, patientid: 12 }, { billingid: 103, patientid: 12 }],
               dboservices: [{ billingid: 101, isNHIS: 1 }, { billingid: 102, categoryTrackId: 4 },
                    { billingid: 103, registrationType: 'nhis' }, { billingid: 103, registrationType: 'self' }],
               billinghx: [{ KeyID: 500, Billingid: 102 }, { KeyID: 501, Billingid: 102 }],
               staff_foc_transaction: [{ id: 9, billingid: 102 }],
               billing_refund_events: [{ id: 9, billingid: 102 }],
               new_patients: [...patients, { patientid: 1, firstname: 'Not', lastname: 'NHIS', fullpatientid: 'PT-1' }],
          };
          const db: any = (table: string) => resultQuery(tables[table] || []);
          db.raw = () => ({});
          connectionMock.mockResolvedValue(db);
     }

     const legacy = (id: number, document_ref: string, amount: number, source_table = 'billing', source_ref = '101:initial', document_date = '2026-09-01') => ({
          id, ledger: 'AR', party_type: 'patient', party_id: 12, document_type: amount > 0 ? 'invoice' : 'payment',
          document_ref, amount, source_module: 'billing', source_table, source_ref, document_date,
     });

     it('projects historical NHIS attribution consistently in balances, aging and paginated statements', async () => {
          nhisDatabase([
               legacy(1, 'BILL-101', 100),
               legacy(2, 'BILL-102', 100, 'billing', '102:initial', '2026-10-01'),
               legacy(3, 'PAY-500', -25, 'billinghx', '500', '2026-10-02'),
               legacy(4, 'WO-102', -10, 'billing_writeoff', '102:req', '2026-10-03'),
               legacy(5, 'REFUND-501', 5, 'billinghx', '501', '2026-10-04'),
               legacy(6, 'BILL-103', 50, 'billing', '103:initial', '2026-10-04'),
          ]);
          const service = new SubledgerService(3);
          const balances = await service.balances('AR', '2026-10-05');
          expect(balances.data).toEqual(expect.arrayContaining([
               expect.objectContaining({ partyType: 'nhis', partyId: 1, balance: 170, charged: 205, settled: 35, patientIdentifier: null }),
               expect.objectContaining({ partyType: 'patient', partyId: 12, classification: 'mixed', balance: 50 }),
          ]));
          const aging = await service.aging('AR', '2026-10-05');
          expect(aging.rows).toEqual(expect.arrayContaining([
               expect.objectContaining({ partyType: 'nhis', reference: 'BILL-101', total: 100 }),
               expect.objectContaining({ partyType: 'nhis', reference: 'BILL-102', total: 70, documentDate: '2026-10-01' }),
               expect.objectContaining({ classification: 'mixed', reference: 'BILL-103', total: 50 }),
          ]));
          expect(aging.totals.total).toBe(220);
          const statement = await service.statement('AR', 'nhis', 1, '2026-10-01', '2026-10-05', { page: 2, count: 2 });
          expect(statement).toMatchObject({ openingBalance: 100, closingBalance: 170, total: 4 });
          expect(statement.entries.map((row: any) => row.runningBalance)).toEqual([165, 170]);
          const patientStatement = await service.statement('AR', 'patient', 12);
          expect(patientStatement.entries.map((row: any) => row.document_ref)).toEqual(['BILL-103']);
          expect(patientStatement.closingBalance).toBe(50);
     });

     it('never spills excess NHIS payments or writeoffs into another claim', async () => {
          nhisDatabase([
               legacy(1, 'BILL-101', 100),
               legacy(2, 'BILL-102', 100, 'billing', '102:initial'),
               legacy(3, 'PAY-500', -120, 'billinghx', '500', '2026-10-01'),
               legacy(4, 'WO-102', -5, 'billing_writeoff', '102:request', '2026-10-02'),
          ]);
          const result = await new SubledgerService(3).aging('AR', '2026-10-05');
          expect(result.rows.map((row: any) => [row.reference, row.total])).toEqual([['BILL-101', 100]]);
          expect(result.unappliedNhisCredits).toBe(25);
     });

     it('matches parent settlements, credit notes and reversals to their original bill and original age', async () => {
          const allocation = (id: number, amount: number) => ({
               ...legacy(id, 'BILL-102', amount, 'acc_nhis_allocations', String(id), '2026-10-04'),
               party_type: 'nhis', party_id: 1, document_type: amount > 0 ? 'adjustment' : 'credit_note',
          });
          nhisDatabase([
               legacy(1, 'BILL-101', 100),
               legacy(2, 'BILL-102', 100, 'billing', '102:initial'),
               allocation(3, -80), allocation(4, -20), allocation(5, 80),
          ]);
          const service = new SubledgerService(3);
          const result = await service.aging('AR', '2026-10-05');
          expect(result.rows).toHaveLength(2);
          expect(result.rows).toEqual(expect.arrayContaining([
               expect.objectContaining({ reference: 'BILL-102', total: 80, documentDate: '2026-09-01', days60: 80 }),
               expect.objectContaining({ reference: 'BILL-101', total: 100 }),
          ]));
          expect(result.totals.total).toBe(180);
          expect(result.unappliedNhisCredits).toBe(0);
          expect((await service.balances('AR', '2026-10-05')).data[0].balance).toBe(180);
          expect((await service.statement('AR', 'nhis', 1)).closingBalance).toBe(180);
     });

     it('keeps ordinary unlinked patient credits in FIFO but separates ambiguous mixed bills', async () => {
          const ordinary = legacy(1, 'BILL-OTHER', 50, 'manual', 'initial');
          const credit = legacy(2, 'MANUAL-CREDIT', -20, 'manual', 'credit');
          nhisDatabase([ordinary, credit, legacy(3, 'BILL-103', 50, 'billing', '103:initial')]);
          const result = await new SubledgerService(3).aging('AR', '2026-10-05');
          expect(result.rows).toEqual(expect.arrayContaining([
               expect.objectContaining({ reference: 'BILL-OTHER', total: 30 }),
               expect.objectContaining({ reference: 'BILL-103', classification: 'mixed', total: 50 }),
          ]));
     });
});
