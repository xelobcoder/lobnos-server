export type BillingPayerClassification = 'nhis' | 'patient' | 'mixed';
export interface BillingPayer {
     partyType: 'nhis' | 'patient';
     partyId: number | null;
     partyName?: string | null;
     classification: BillingPayerClassification;
}
export type ResolvedBillingPayer = BillingPayer;
export type BillingPayerBill = { billingId: number; patientId?: number | null } | { billingid: number; patientid?: number | null };

export const NHIS_PARTY_ID = 1;
export const NHIS_PARTY_NAME = 'National Health Insurance Scheme (NHIS)';

export interface BillingPayerService {
     billingid?: number;
     isNHIS?: number | string | boolean | null;
     serviceCategory?: string | null;
     categoryTrackId?: number | string | null;
     registrationType?: string | null;
     isDeleted?: number | string | boolean | null;
     isRefunded?: number | string | boolean | null;
     status?: string | null;
}

/** Written-off services remain valid bill identity; deleted/voided/refunded services do not. */
export function isLiveBillingService(service: BillingPayerService): boolean {
     return Number(service.isDeleted || 0) === 0 && Number(service.isRefunded || 0) === 0
          && !['cancelled', 'voided', 'refunded'].includes(String(service.status || '').toLowerCase());
}

export function isNhisService(service: BillingPayerService): boolean {
     return Number(service.isNHIS) === 1 || Number(service.categoryTrackId) === 4
          || String(service.serviceCategory || '').toLowerCase() === 'nhis'
          || String(service.registrationType || '').toLowerCase() === 'nhis';
}

/** Empty/no-live bills are not evidence of NHIS. Never split a mixed bill's balance. */
export function classifyBillingServices(services: readonly BillingPayerService[]): BillingPayerClassification {
     const live = services.filter(isLiveBillingService);
     const nhis = live.filter(isNhisService).length;
     return nhis === 0 ? 'patient' : nhis === live.length ? 'nhis' : 'mixed';
}

export function billingPayer(classification: BillingPayerClassification, patientId?: number | null): BillingPayer {
     return classification === 'nhis'
          ? { partyType: 'nhis', partyId: NHIS_PARTY_ID, partyName: NHIS_PARTY_NAME, classification }
          : { partyType: 'patient', partyId: Number(patientId) > 0 ? Number(patientId) : null, classification };
}

/** Uses the caller's tenant connection/transaction. At most two reads per batch, never per bill. */
export async function resolveBillingPayers(
     db: any, input: readonly BillingPayerBill[]
): Promise<Map<number, ResolvedBillingPayer>> {
     const bills = input.map((bill) => 'billingId' in bill ? bill : { billingId: bill.billingid, patientId: bill.patientid });
     const ids = [...new Set(bills.map((bill) => Number(bill.billingId)).filter((id) => Number.isSafeInteger(id) && id > 0))];
     if (!ids.length) return new Map();
     const services: BillingPayerService[] = await db('dboservices')
          .select('billingid', 'isNHIS', 'serviceCategory', 'categoryTrackId', 'registrationType', 'isDeleted', 'isRefunded', 'status')
          .whereIn('billingid', ids);
     const missing = bills.filter((bill) => bill.patientId === undefined).map((bill) => bill.billingId);
     const patients: any[] = missing.length
          ? await db('billing').select('billingid', 'patientid').whereIn('billingid', missing) : [];
     const patientByBill = new Map(patients.map((bill) => [Number(bill.billingid), Number(bill.patientid)]));
     const byBill = new Map<number, BillingPayerService[]>();
     for (const service of services) {
          const id = Number(service.billingid);
          if (!byBill.has(id)) byBill.set(id, []);
          byBill.get(id)!.push(service);
     }
     return new Map(bills.map((bill) => [Number(bill.billingId),
          billingPayer(classifyBillingServices(byBill.get(Number(bill.billingId)) || []),
               bill.patientId === undefined ? patientByBill.get(Number(bill.billingId)) : bill.patientId)]));
}

export async function resolveBillingPayer(db: any, billingId: number, patientId?: number | null): Promise<BillingPayer> {
     if (!Number.isSafeInteger(billingId) || billingId <= 0) throw new Error('A valid billingId is required');
     return (await resolveBillingPayers(db, [{ billingId, patientId }])).get(billingId)!;
}

/** SQL equivalent of the pure classifier for filtering and whole-report totals before pagination.
 * The identifier is a trusted server-side alias, never client input.
 */
export function billingPayerClassificationSql(billingIdColumn = 'bill.billingid'): string {
     if (!/^[a-zA-Z_]\w*\.[a-zA-Z_]\w*$/.test(billingIdColumn)) throw new Error('Invalid billing column');
     const live = `s.billingid = ${billingIdColumn} AND COALESCE(s.isDeleted, 0) = 0 AND COALESCE(s.isRefunded, 0) = 0
          AND COALESCE(LOWER(s.status), '') NOT IN ('cancelled', 'voided', 'refunded')`;
     const nhis = `(COALESCE(s.isNHIS, 0) = 1 OR COALESCE(s.categoryTrackId, 0) = 4
          OR COALESCE(LOWER(s.serviceCategory), '') = 'nhis' OR COALESCE(LOWER(s.registrationType), '') = 'nhis')`;
     return `(CASE WHEN EXISTS (SELECT 1 FROM dboservices s WHERE ${live} AND ${nhis})
          THEN CASE WHEN EXISTS (SELECT 1 FROM dboservices s WHERE ${live} AND NOT ${nhis})
               THEN 'mixed' ELSE 'nhis' END ELSE 'patient' END)`;
}
