import { describe, expect, it, vi } from 'vitest';
import { attributeBillingEntries } from './NhisAttributionService';
import { NHIS_PARTY_NAME } from './BillingPayer';

describe('historical NHIS attribution', () => {
     it('reassigns all explicitly bill-linked patient entries in memory, without financial writes', async () => {
          const tables: Record<string, any[]> = {
               billing: [{ billingid: 42, patientid: 8 }, { billingid: 43, patientid: 8 }],
               dboservices: [{ billingid: 42, isNHIS: 1 }, { billingid: 43, isNHIS: 1 }, { billingid: 43, isNHIS: 0 }],
               billinghx: [{ KeyID: 77, Billingid: 42 }, { KeyID: 78, Billingid: 42 }],
               staff_foc_transaction: [{ id: 9, billingid: 42 }],
               billing_refund_events: [{ id: 12, billingid: 42 }],
          };
          const db: any = vi.fn((table: string) => {
               const query: any = { select: () => query,
                    whereIn: (key: string, ids: number[]) => Promise.resolve(tables[table].filter((row) => ids.includes(row[key]))) };
               return query;
          });
          const entry = (source_table: string, source_ref: string, document_ref = 'LEGACY', amount = -10) =>
               ({ ledger: 'AR', party_type: 'patient', party_id: 8, source_module: 'billing', source_table, source_ref, document_ref, amount });
          const entries = [
               entry('billing', '42:initial', 'BILL-42', 100),
               entry('billinghx', '77', 'PAY-77'),
               entry('billinghx', '78', 'REFUND-78', 10),
               entry('billing_writeoff', '42:request-1', 'WO-42'),
               entry('billing_void', '42', 'CN-42'),
               entry('staff_foc_transaction', '9', 'FOC-9'),
               entry('staff_foc_transaction', 'reversal:9', 'FOC-REVERSAL-9', 10),
               entry('billing_refund_events', '12', 'CN-42'),
               entry('billing', '43:initial', 'BILL-43', 80),
               entry('billinghx', '999', 'REFUND-999'),
               { ...entry('manual', '42', 'BILL-42'), ledger: 'AP' },
               { ...entry('manual', '42', 'BILL-42'), party_type: 'supplier' },
          ];
          const snapshot = JSON.stringify(entries);
          const result = await attributeBillingEntries(db, entries);
          for (const row of result.slice(0, 8)) expect(row).toMatchObject({
               party_type: 'nhis', party_id: 1, party_name: NHIS_PARTY_NAME, classification: 'nhis', billingId: 42,
          });
          expect(result[8]).toMatchObject({ party_type: 'patient', party_id: 8, classification: 'mixed' });
          expect(result[9]).toEqual(entries[9]); // unresolved history must not be interpreted as a bill ID
          expect(result[10]).toEqual(entries[10]);
          expect(result[11]).toEqual(entries[11]);
          expect(JSON.stringify(entries)).toBe(snapshot);
          expect(result.map((row) => row.amount)).toEqual(entries.map((row) => row.amount));
          expect(db.mock.calls.map(([table]: any) => table).sort()).toEqual(
               ['billing', 'dboservices', 'billinghx', 'staff_foc_transaction', 'billing_refund_events'].sort());
     });

     it('accepts parent allocation BILL links without treating allocation IDs as billing IDs', async () => {
          const db: any = (table: string) => {
               const query: any = { select: () => query, whereIn: () => Promise.resolve(
                    table === 'billing' ? [{ billingid: 42, patientid: 8 }] : [{ billingid: 42, serviceCategory: 'NHIS' }]) };
               return query;
          };
          const [result] = await attributeBillingEntries(db, [{
               ledger: 'AR', party_type: 'nhis', party_id: 1, source_module: 'billing',
               source_table: 'acc_nhis_allocations', source_ref: '999', document_ref: 'BILL-42', amount: -25,
          }]);
          expect(result.billingId).toBe(42);
          expect(result.party_type).toBe('nhis');
     });
});
