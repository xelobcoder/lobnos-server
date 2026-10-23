import { commissionBalanceColumns } from './CommissionBalanceQuery';
import KnexConnection from "../../database/KnexConnections";

/**
 * Read-only view of a single clinician's commission records for the clinician portal.
 *
 * It does not calculate commission: amounts come from `commission_tracking` rows written by the
 * existing CommissionEngineService, and payment state comes from the facility's batch payments
 * (`commission_batch_payment_services`). Scope mirrors the facility "detailed list" so the two views reconcile.
 */
export type CommissionSeriesPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ClinicianCommissionScope {
     clinicianId: number;
     from: string;
     to: string;
}

const PERIOD_FORMATS: Record<CommissionSeriesPeriod, string> = {
     daily: '%Y-%m-%d',
     weekly: '%x-W%v',
     monthly: '%Y-%m',
     yearly: '%Y',
};

export const COMMISSION_SERVICE_CATEGORIES = ['CLINICIAN_SPECIAL_BILLING', 'ORGANIZATION'];

/** Picks a readable chart granularity for the selected range. */
export function resolveSeriesPeriod(from: string, to: string, requested?: string): CommissionSeriesPeriod {
     if (requested && requested in PERIOD_FORMATS) return requested as CommissionSeriesPeriod;
     const days = (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000;
     if (days <= 45) return 'daily';
     if (days <= 120) return 'weekly';
     if (days <= 1100) return 'monthly';
     return 'yearly';
}

/** Base query: this clinician's tracked commissions on services rendered within the range. */
export function clinicianCommissionBaseQuery(conn: any, scope: ClinicianCommissionScope) {
     return conn('commission_tracking as ct')
          .join('dboservices as ds', 'ds.serviceid', 'ct.service_id')
          // Adjustment rows share the service id; only the original row carries the batch allocation.
          .leftJoin('commission_batch_payment_services as cbps', function (this: any) {
               this.on('cbps.serviceid', '=', 'ct.service_id').andOn(conn.raw('ct.status <> ?', ['adjusted']));
          })
          .where('ct.recipient_type', 'clinician')
          .andWhere('ct.recipient_id', scope.clinicianId)
          .whereIn('ds.serviceCategory', COMMISSION_SERVICE_CATEGORIES)
          .whereRaw('DATE(ds.serviceAddedOn) BETWEEN ? AND ?', [scope.from, scope.to]);
}

const toAmounts = (row: any) => ({
     earned: Number(row?.earned || 0),
     paid: Number(row?.paid || 0),
     waived: Number(row?.waived || 0),
     pending: Number(row?.pending || 0),
     approved: Number(row?.approved || 0),
     outstanding: Number(row?.outstanding || 0),
});

export class ClinicianCommissionPortalRepository {
     private connection: Promise<any>;

     constructor(tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getTotals(scope: ClinicianCommissionScope) {
          const conn = await this.connection;
          const row = await clinicianCommissionBaseQuery(conn, scope)
               .select(conn.raw('COUNT(ct.id) AS transactions'), ...commissionBalanceColumns(conn))
               .first();
          return { transactions: Number(row?.transactions || 0), ...toAmounts(row) };
     }

     async getSeries(scope: ClinicianCommissionScope, period: CommissionSeriesPeriod) {
          const conn = await this.connection;
          const rows = await clinicianCommissionBaseQuery(conn, scope)
               .select(
                    conn.raw('DATE_FORMAT(ds.serviceAddedOn, ?) AS bucket', [PERIOD_FORMATS[period]]),
                    conn.raw('MIN(DATE(ds.serviceAddedOn)) AS bucket_start'),
                    conn.raw('COUNT(ct.id) AS transactions'),
                    ...commissionBalanceColumns(conn)
               )
               .groupByRaw('bucket')
               .orderBy('bucket_start', 'asc');
          return (rows as any[]).map((row) => ({
               period: row.bucket,
               periodStart: row.bucket_start,
               transactions: Number(row.transactions || 0),
               ...toAmounts(row),
          }));
     }

     async getTransactions(scope: ClinicianCommissionScope, page: number, count: number) {
          const conn = await this.connection;
          const rows = await clinicianCommissionBaseQuery(conn, scope)
               .leftJoin('test_panels as tp', 'tp.id', 'ds.trackId')
               .leftJoin('commission_batch_payments as cbp', 'cbp.id', 'cbps.batch_payment_id')
               .select(
                    'ct.id',
                    'ct.service_id',
                    'ct.commission_type',
                    'ct.percentage_rate_applied',
                    'ct.fixed_amount_applied',
                    'ct.service_amount',
                    'ct.commission_due',
                    'ct.final_commission',
                    'ct.status',
                    'ct.calculated_at',
                    'ds.billingid',
                    'ds.serviceAddedOn',
                    'ds.paidamount',
                    'tp.name as test_name',
                    'cbps.status as payment_status',
                    'cbps.amount_allocated',
                    'cbps.waived_amount',
                    'cbp.batch_reference',
                    'cbp.payment_date'
               )
               .orderBy('ds.serviceAddedOn', 'desc')
               .orderBy('ct.id', 'desc')
               .limit(count)
               .offset((page - 1) * count);
          return rows as any[];
     }
}
