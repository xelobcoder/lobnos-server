import KnexConnection from '../../database/KnexConnections';
import { parsePaging, parseSort } from '../utils/pagination';

export interface ReceivableFilters {
     from?: string;
     to?: string;
     search?: string;
     page?: number;
     count?: number;
     sortby?: string;
}

function dateBoundary(value: string, nextDay = false): string {
     const date = new Date(`${value}T00:00:00Z`);
     if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
          throw new Error('Dates must be valid YYYY-MM-DD values');
     }
     if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
     return `${date.toISOString().slice(0, 10)} 00:00:00`;
}

export class OutstandingReceivablesService {
     constructor(private tenantId: number) { }

     async list(filters: ReceivableFilters = {}) {
          const from = filters.from ? dateBoundary(filters.from) : undefined;
          const to = filters.to ? dateBoundary(filters.to, true) : undefined;
          if (filters.from && filters.to && filters.from > filters.to) throw new Error('From date must not exceed to date');
          const db = await KnexConnection(this.tenantId);
          const paging = parsePaging({ page: Math.trunc(Number(filters.page)), count: Math.trunc(Number(filters.count)) }, 25);
          const sort = parseSort(filters, ['documentDate'], { column: 'documentDate', direction: 'desc' });
          const base = db('billing as bill')
               .leftJoin('new_patients as patient', 'patient.patientid', 'bill.patientid')
               .where('bill.outstanding', '>', 0)
               .where((query) => {
                    query.whereNull('bill.status').orWhereNotIn('bill.status', ['voided', 'corrected', 'written-off']);
               });

          if (from) base.andWhere('bill.billedon', '>=', from);
          if (to) base.andWhere('bill.billedon', '<', to);
          const search = String(filters.search || '').trim();
          if (search) {
               const text = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
               base.andWhere((query) => {
                    query.whereRaw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) LIKE ?", [text])
                         .orWhere('patient.fullpatientid', 'like', text);
                    const id = Number(search.replace(/^BILL-/i, ''));
                    if (Number.isSafeInteger(id) && id > 0) {
                         query.orWhere('bill.billingid', id).orWhere('bill.patientid', id);
                    }
               });
          }

          const [summary, bills] = await Promise.all([
               base.clone().select(db.raw('COUNT(*) AS documents'), db.raw('COALESCE(SUM(bill.outstanding), 0) AS outstanding')).first<{ documents: number | string; outstanding: number | string }>(),
               base.clone().select(
                    'bill.billingid', 'bill.patientid', 'bill.billedon', 'bill.outstanding', 'patient.fullpatientid',
                    db.raw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) AS patient_name")
               ).orderBy('bill.billedon', sort.direction).orderBy('bill.billingid', sort.direction).limit(paging.count).offset(paging.offset),
          ]);

          return {
               rows: bills.map((bill: any) => ({
                    billingId: Number(bill.billingid),
                    partyType: 'patient',
                    partyId: Number(bill.patientid) || null,
                    partyName: bill.patient_name || null,
                    patientIdentifier: bill.fullpatientid || null,
                    reference: `BILL-${bill.billingid}`,
                    documentDate: bill.billedon instanceof Date ? bill.billedon.toISOString().slice(0, 10) : String(bill.billedon).slice(0, 10),
                    total: Number(bill.outstanding),
               })),
               total: Number(summary?.documents || 0),
               page: paging.page,
               count: paging.count,
               totals: { total: Number(summary?.outstanding || 0) },
          };
     }
}