import KnexConnection from '../../database/KnexConnections';
import type { AuthUser } from '../../middleware/authority';
import { crmManager } from '../../middleware/crmAuthority';
import { crmDate, crmFail } from './CrmService';

const day = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
function shiftMonth(value: string, months: number) {
     const date = new Date(`${value}T00:00:00Z`), original = date.getUTCDate();
     date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
     const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
     date.setUTCDate(Math.min(original, last)); return iso(date);
}
export function performancePeriods(input: any) {
     const start = crmDate.parse(input.start), end = crmDate.parse(input.end);
     const a = Date.parse(start), b = Date.parse(end);
     if (a > b || (b - a) / day > 730) crmFail('Choose a date range of up to 731 days');
     const mode = String(input.comparison || 'previous_period');
     let previousStart: string, previousEnd: string;
     if (mode === 'custom') { previousStart = crmDate.parse(input.previous_start); previousEnd = crmDate.parse(input.previous_end); }
     else if (mode === 'previous_month' || mode === 'previous_year') { const months = mode === 'previous_year' ? -12 : -1; previousStart = shiftMonth(start, months); previousEnd = shiftMonth(end, months); }
     else if (mode === 'previous_week') { previousStart = iso(new Date(a - 7 * day)); previousEnd = iso(new Date(b - 7 * day)); }
     else if (mode === 'previous_period') { const span = b - a + day; previousStart = iso(new Date(a - span)); previousEnd = iso(new Date(a - day)); }
     else crmFail('Invalid comparison mode');
     if (previousStart > previousEnd || (Date.parse(previousEnd) - Date.parse(previousStart)) / day > 730) crmFail('Invalid comparison date range');
     return { start, end, previousStart, previousEnd, comparison: mode };
}
export function referralChange(current: number, previous: number) { return { absolute: current - previous, percent: previous ? Math.round((current - previous) / previous * 1000) / 10 : null, new_activity: previous === 0 && current > 0 }; }

export class ReferralPerformance {
     constructor(private tenantId: number) {}
     async report(actor: AuthUser, input: any) {
          const periods = performancePeriods(input), db = await KnexConnection(this.tenantId);
          const type = input.type === 'organization' ? 'organization' : 'clinician';
          const table = type === 'clinician' ? 'clinicianbasicinfo' : 'organization';
          const column = type === 'clinician' ? 'clinicianId' : 'organizationId';
          let entities = db(`${table} as entity`).leftJoin('crm_referrer_portfolios as portfolio', function () {
               this.on('portfolio.entity_id', '=', 'entity.id').andOnVal('portfolio.entity_type', '=', type);
          }).leftJoin('roles as owner', 'owner.employeeid', 'portfolio.marketer_id').select('entity.id', 'entity.name', 'portfolio.marketer_id', 'owner.username as owner_name');
          if (!crmManager(actor)) entities = entities.where('portfolio.marketer_id', actor.employeeid);
          if (actor.branch != null) entities = entities.where((q: any) => q.where('portfolio.branchid', actor.branch).orWhereNull('portfolio.branchid'));
          if (input.owner && crmManager(actor)) entities = entities.where('portfolio.marketer_id', Number(input.owner));
          if (input.search) entities = entities.where('entity.name', 'like', `%${String(input.search).slice(0, 100)}%`);
          // Reports include zero-referral entities, so inactive relationships remain visible.
          const refs = await entities.orderBy('entity.name');
          const ids = refs.map(row => Number(row.id));
          if (!ids.length) return { periods, type, rows: [], totals: { current: this.empty(), previous: this.empty(), change: referralChange(0, 0) }, definitions: this.definitions() };
          const base = () => {
               let query = db('dboservices as service').join('billing as bill', 'bill.billingid', 'service.billingid')
                    .whereIn(`service.${column}`, ids).where('service.status', 'active').whereRaw('COALESCE(service.isRefunded, 0) = 0');
               if (actor.branch != null) query = query.where('service.branchid', actor.branch);
               return query;
          };
          const aggregate = async (start: string, end: string, grouped: boolean) => {
               const query = base().where('service.serviceAddedOn', '>=', `${start} 00:00:00`).where('service.serviceAddedOn', '<', `${iso(new Date(Date.parse(end) + day))} 00:00:00`);
               query.select(db.raw('COUNT(DISTINCT service.billingid) as cases'), db.raw('COUNT(DISTINCT bill.patientid) as patients'),
                    db.raw('SUM(service.totalpayable) as billed'), db.raw('SUM(service.paidamount) as collected'),
                    db.raw('SUM((SELECT COUNT(*) FROM test_ascension ordered_test WHERE ordered_test.serviceid = service.serviceid)) as tests'),
                    db.raw('SUM((SELECT COALESCE(SUM(tracking.commission_due), 0) FROM commission_tracking tracking WHERE tracking.service_id = service.serviceid AND tracking.recipient_type = ? AND tracking.recipient_id = service.??)) as commission', [type, column]));
               if (grouped) query.select(`service.${column} as entity_id`).groupBy(`service.${column}`);
               return query;
          };
          const [current, previous, currentTotals, previousTotals, lifetime] = await Promise.all([
               aggregate(periods.start, periods.end, true), aggregate(periods.previousStart, periods.previousEnd, true),
               aggregate(periods.start, periods.end, false), aggregate(periods.previousStart, periods.previousEnd, false),
               base().select(`service.${column} as entity_id`).min('service.serviceAddedOn as first_referral').max('service.serviceAddedOn as last_referral').groupBy(`service.${column}`),
          ]);
          const toMap = (rows: any[]) => new Map(rows.map(row => [Number(row.entity_id), row]));
          const now = toMap(current), then = toMap(previous), life = toMap(lifetime);
          const rows = refs.map(ref => { const c = this.metrics(now.get(Number(ref.id))), p = this.metrics(then.get(Number(ref.id))); return { ...ref, current: c, previous: p, change: referralChange(c.cases, p.cases),
               first_referral: life.get(Number(ref.id))?.first_referral || null, last_referral: life.get(Number(ref.id))?.last_referral || null,
               attention: !c.cases && p.cases ? 'inactive' : c.cases < p.cases ? 'declining' : !c.cases ? 'not_activated' : c.cases > p.cases ? 'growing' : 'steady' }; });
          const c = this.metrics(currentTotals[0]), p = this.metrics(previousTotals[0]);
          rows.sort((a, b) => b.current.cases - a.current.cases || a.name.localeCompare(b.name));
          return { periods, type, rows, totals: { current: c, previous: p, change: referralChange(c.cases, p.cases) }, definitions: this.definitions() };
     }
     private empty() { return { cases: 0, patients: 0, tests: 0, billed: 0, collected: 0, commission: 0 }; }
     private metrics(row: any) { const result = this.empty(); for (const key of Object.keys(result)) result[key] = Number(row?.[key] || 0); return result; }
     private definitions() { return { cases: 'Distinct billing orders with active, non-refunded services in the period.', patients: 'Distinct referred patients; no patient identities are returned.', tests: 'Ordered tests attached to included services.',
          collected: 'Current collections against services billed during the selected period, not cash received during that period.', portfolio: 'Both periods use the current assigned portfolio; this is relationship performance, not historical marketer credit.',
          attribution: 'Clinician and organization dimensions may overlap. Do not add their totals together.', commissions: 'Accrued commission includes paid and unpaid tracking; paying commission does not remove referrals.' }; }
}
