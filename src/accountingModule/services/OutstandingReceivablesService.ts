import KnexConnection from '../../database/KnexConnections';
import { parsePaging, parseSort } from '../utils/pagination';
import { billingPayer, billingPayerClassificationSql, BillingPayerClassification } from './BillingPayer';
import Decimal from 'decimal.js';

export interface ReceivableFilters {
     from?: string;
     to?: string;
     search?: string;
     page?: number;
     count?: number;
     sortby?: string;
     payerType?: string;
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
          if (filters.payerType && !['nhis', 'patient', 'mixed'].includes(filters.payerType)) {
               throw new Error('payerType must be nhis, patient or mixed');
          }
          const db = await KnexConnection(this.tenantId);
          const paging = parsePaging({ page: Math.trunc(Number(filters.page)), count: Math.trunc(Number(filters.count)) }, 25);
          const sort = parseSort(filters, ['documentDate'], { column: 'documentDate', direction: 'desc' });
          const classification = billingPayerClassificationSql();
          const settled = `(CASE WHEN ${classification} = 'nhis' THEN COALESCE(nhis.settled, 0) ELSE 0 END)`;
          const outstanding = `(bill.outstanding - ${settled})`;
          const allocations = db('acc_nhis_allocations as allocation')
               .join('acc_nhis_events as event', 'event.id', 'allocation.event_id')
               .select('allocation.billingid')
               .sum('allocation.amount as settled')
               .select(db.raw("SUM(CASE WHEN event.kind = 'receipt' OR (event.kind = 'reversal' AND event.reverses_kind = 'receipt') THEN allocation.amount ELSE 0 END) AS received"))
               .groupBy('allocation.billingid').as('nhis');
          const base = db('billing as bill')
               .leftJoin('new_patients as patient', 'patient.patientid', 'bill.patientid')
               .leftJoin(allocations, 'nhis.billingid', 'bill.billingid')
               .where('bill.outstanding', '>', 0)
               .whereRaw(`${outstanding} > 0`)
               .where((query) => {
                    query.whereNull('bill.status').orWhereNotIn('bill.status', ['voided', 'corrected', 'written-off']);
               });

          if (from) base.andWhere('bill.billedon', '>=', from);
          if (to) base.andWhere('bill.billedon', '<', to);
          if (filters.payerType) base.andWhereRaw(`${classification} = ?`, [filters.payerType]);
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
               base.clone().select(db.raw('COUNT(*) AS documents'), db.raw(`COALESCE(SUM(${outstanding}), 0) AS outstanding`),
                    ...(['nhis', 'patient', 'mixed'] as const).map((payer) =>
                         db.raw(`COALESCE(SUM(CASE WHEN ${classification} = ? THEN ${outstanding} ELSE 0 END), 0) AS ??`, [payer, payer]))
               ).first<any>(),
               base.clone().select(
                    'bill.billingid', 'bill.patientid', 'bill.billedon', 'bill.outstanding', 'bill.paid', 'patient.fullpatientid',
                    db.raw(`${classification} AS classification`), db.raw(`${settled} AS nhis_settled`),
                    db.raw(`CASE WHEN ${classification} = 'nhis' THEN COALESCE(nhis.received, 0) ELSE 0 END AS nhis_received`),
                    db.raw(`${outstanding} AS payer_outstanding`),
                    db.raw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) AS patient_name")
               ).orderBy('bill.billedon', sort.direction).orderBy('bill.billingid', sort.direction).limit(paging.count).offset(paging.offset),
          ]);

          return {
               rows: bills.map((bill: any) => ({
                    billingId: Number(bill.billingid),
                    ...billingPayer((bill.classification || 'patient') as BillingPayerClassification, Number(bill.patientid)),
                    partyName: bill.classification === 'nhis' ? billingPayer('nhis').partyName : bill.patient_name || null,
                    patientName: bill.patient_name || null,
                    patientIdentifier: bill.fullpatientid || null,
                    reference: `BILL-${bill.billingid}`,
                    documentDate: bill.billedon instanceof Date ? bill.billedon.toISOString().slice(0, 10) : String(bill.billedon).slice(0, 10),
                    headerOutstanding: Number(bill.outstanding),
                    nhisSettledAmount: Number(bill.nhis_settled || 0),
                    nhisReceivedAmount: Number(bill.nhis_received || 0),
                    payerPaid: new Decimal(bill.paid || 0).plus(bill.nhis_received || 0).toDecimalPlaces(2).toNumber(),
                    payerOutstanding: Number(bill.payer_outstanding ?? bill.outstanding),
                    total: Number(bill.payer_outstanding ?? bill.outstanding),
               })),
               total: Number(summary?.documents || 0),
               page: paging.page,
               count: paging.count,
               totals: { total: Number(summary?.outstanding || 0), byPayer: {
                    nhis: Number(summary?.nhis || 0), patient: Number(summary?.patient || 0), mixed: Number(summary?.mixed || 0),
               } },
          };
     }
}