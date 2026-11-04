import { describe, expect, it, vi } from 'vitest';
import { billingPayerClassificationSql, classifyBillingServices, resolveBillingPayer, resolveBillingPayers, NHIS_PARTY_NAME } from './BillingPayer';

describe('BillingPayer', () => {
     it.each([
          [{ isNHIS: 1 }], [{ isNHIS: '1' }], [{ serviceCategory: 'NHIS' }],
          [{ categoryTrackId: 4 }], [{ registrationType: 'nhis' }],
     ])('accepts each independent persisted NHIS marker: %j', (service) => {
          expect(classifyBillingServices([service])).toBe('nhis');
     });

     it('requires a nonempty all-live NHIS cohort and never allocates mixed services', () => {
          expect(classifyBillingServices([])).toBe('patient');
          expect(classifyBillingServices([{ isNHIS: 0 }, { categoryTrackId: 5 }])).toBe('patient');
          expect(classifyBillingServices([{ isNHIS: 1 }, { registrationType: 'self' }])).toBe('mixed');
          expect(classifyBillingServices([{ isNHIS: 1, isDeleted: 1 }])).toBe('patient');
          expect(classifyBillingServices([{ isNHIS: 1 }, { isDeleted: '1' }, { status: 'voided' },
               { status: 'cancelled' }, { status: 'refunded' }, { isRefunded: '1' }])).toBe('nhis');
          expect(classifyBillingServices([{ isNHIS: 1, status: 'written-off' }])).toBe('nhis');
     });

     function database() {
          const calls: string[] = [];
          const tables: Record<string, any[]> = {
               dboservices: [{ billingid: 42, isNHIS: 1 }, { billingid: 43, registrationType: 'nhis' },
                    { billingid: 43, registrationType: 'self' }],
               billing: [{ billingid: 42, patientid: 8 }, { billingid: 43, patientid: 9 }, { billingid: 44, patientid: 10 }],
          };
          const db: any = vi.fn((table: string) => {
               calls.push(table);
               const query: any = {
                    select: () => query,
                    whereIn: (_: string, ids: number[]) => Promise.resolve(tables[table].filter((row) => ids.includes(row.billingid))),
               };
               return query;
          });
          return { db, calls };
     }

     it('resolves patient identity from the header without assuming a header NHIS flag', async () => {
          const { db } = database();
          expect(await resolveBillingPayer(db, 42)).toEqual({
               partyType: 'nhis', partyId: 1, partyName: NHIS_PARTY_NAME, classification: 'nhis',
          });
          expect(await resolveBillingPayer(db, 43)).toEqual({ partyType: 'patient', partyId: 9, classification: 'mixed' });
          expect(await resolveBillingPayer(db, 44)).toEqual({ partyType: 'patient', partyId: 10, classification: 'patient' });
     });

     it('batches reads, uses the provided transaction and skips header lookup for known patients', async () => {
          const { db, calls } = database();
          const result = await resolveBillingPayers(db, [{ billingId: 42, patientId: 8 }, { billingId: 43, patientId: 9 }]);
          expect(calls).toEqual(['dboservices']);
          expect(result.get(43)?.classification).toBe('mixed');
          expect(await resolveBillingPayers(db, [])).toEqual(new Map());
          expect(calls).toHaveLength(1);
          expect((await resolveBillingPayers(db, [{ billingid: 42, patientid: 8 }])).get(42)?.partyType).toBe('nhis');
          await expect(resolveBillingPayer(db, -1)).rejects.toThrow('valid billingId');
     });

     it('provides null-safe SQL classification for reports and rejects untrusted identifiers', () => {
          const sql = billingPayerClassificationSql();
          expect(sql).toContain('s.billingid = bill.billingid');
          expect(sql).toContain('COALESCE(s.isDeleted, 0) = 0');
          expect(sql).toContain('COALESCE(s.isRefunded, 0) = 0');
          expect(sql).toContain("THEN 'mixed' ELSE 'nhis'");
          expect(sql).toContain("ELSE 'patient'");
          expect(() => billingPayerClassificationSql('bill.billingid; DROP TABLE billing')).toThrow();
     });
});
