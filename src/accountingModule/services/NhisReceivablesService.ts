import { createHash } from 'crypto';
import type { Knex } from 'knex';
import { z } from 'zod';
import KnexConnection from '../../database/KnexConnections';
import type { AuthUser } from '../../middleware/authority';
import { AccountingError } from '../errors/AccountingErrors';
import { NormalBalance } from '../enums/normal-balance.enum';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import type { PostTransactionLineDto } from '../dto/PostTransactionLineDto';
import { billingReceivableIds, hasBillingReceivable } from '../integrations/BillingAccounting';
import { allocateMinor, minorUnits, sumMinor } from '../utils/money';
import { parsePaging } from '../utils/pagination';
import { enqueuePosting } from './AccountingOutboxService';
import { AccountingPeriodService } from './AccountingPeriodService';
import { AuthorityService } from './AuthorityService';
import { classifyBillingServices, resolveBillingPayer, resolveBillingPayers } from './BillingPayer';
import { FinancialFinalizationGuard } from './FinancialFinalizationGuard';
import { SubledgerService } from './SubledgerService';

const eventSchema = z.object({
     requestKey: z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/),
     reference: z.string().trim().min(1).max(120),
     reason: z.string().trim().min(1).max(1000),
     date: z.string(),
     amount: z.union([z.number(), z.string()]),
     paymentAccountCode: z.enum(['acc-1000', 'acc-1001']).optional(),
     allocations: z.array(z.object({
          billingId: z.number().int().positive(),
          amount: z.union([z.number(), z.string()]),
     }).strict()).min(1).max(1000),
}).strict();
const reversalSchema = eventSchema.omit({ amount: true, paymentAccountCode: true, allocations: true });
const periodPreviewSchema = z.object({
     from: z.string(), to: z.string(), amount: z.union([z.number(), z.string()]), date: z.string(),
     remainingDisposition: z.enum(['pending', 'appeal', 'disputed', 'final']),
     adjustmentKind: z.enum(['revenue_adjustment', 'write_off']).optional(),
}).strict();
const periodSettlementSchema = periodPreviewSchema.extend({
     requestKey: eventSchema.shape.requestKey, reference: eventSchema.shape.reference, reason: eventSchema.shape.reason,
     paymentAccountCode: z.enum(['acc-1000', 'acc-1001']).optional(),
     remainingReason: z.string().trim().min(1).max(1000).optional(),
     adjustmentReference: eventSchema.shape.reference.optional(), adjustmentReason: eventSchema.shape.reason.optional(),
     snapshotToken: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type NhisPeriodPreviewInput = z.infer<typeof periodPreviewSchema>;
export type NhisPeriodSettlementInput = z.infer<typeof periodSettlementSchema>;
interface PeriodBill { billingId: number; reference: string; outstandingMinor: number; payableMinor: number; taxMinor: number; serviceDate: string }
export interface NhisPeriodPreview {
     from: string; to: string; billCount: number; eligibleOutstanding: number; received: number; remaining: number;
     adjusted: number; outstandingAfter: number; allocationMethod: 'proportional'; snapshotToken: string;
     excludedMixedBillCount: number; excludedMissingAccrualBillCount: number;
     allocationSample: Array<{ billingId: number; reference: string; outstanding: number; received: number; remaining: number }>;
}
export interface NhisPeriodSettlementMetadata extends NhisPeriodPreview {
     id: number; date: string; remainingDisposition: NhisPeriodPreviewInput['remainingDisposition'];
     remainingReason: string | null; adjustmentKind: NhisPeriodPreviewInput['adjustmentKind'] | null;
     adjustmentReference: string | null; adjustmentReason: string | null; reference: string; reason: string;
     paymentAccountCode: 'acc-1000' | 'acc-1001' | null; createdBy: number;
     state: 'applied' | 'partially_reversed' | 'reversed'; reversalEventIds: number[];
     totalsBasis: 'at_posting_not_current_balance';
}
export interface NhisPeriodSettlementResult {
     receiptEvent: NhisPeriodEvent | null; adjustmentEvent?: NhisPeriodEvent;
     settlement: NhisPeriodSettlementMetadata; alreadyApplied?: boolean;
}
export interface NhisPeriodEvent extends NhisEvent { allocationCount: number; allocations: [] }

export type NhisEventKind = 'receipt' | 'revenue_adjustment' | 'write_off';
interface Allocation { billingId: number; amount: number; taxAmount: number }
export interface NhisEvent {
     id: number; kind: NhisEventKind | 'reversal'; reverses_kind: NhisEventKind | null;
     reversal_of_event_id: number | null; reference: string; reason: string; event_date: string;
     branchid: number; amount: number; payment_account_code: string | null; created_by: number;
}
export interface NhisReportFilters { from?: string; to?: string; page?: number; count?: number }

export function nhisDate(value: string): string {
     const parsed = new Date(`${value}T00:00:00Z`);
     if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
          throw new AccountingError('Dates must be valid YYYY-MM-DD values', 'INVALID_NHIS_DATE', 400);
     }
     return value;
}

function validatePeriod(filters: NhisReportFilters) {
     if (filters.from) nhisDate(filters.from);
     if (filters.to) nhisDate(filters.to);
     if (filters.from && filters.to && filters.from > filters.to) throw new AccountingError('From date must not exceed to date', 'INVALID_NHIS_DATE', 400);
}

export function nhisPostingLines(kind: NhisEventKind, allocations: Allocation[], branchid: number, employeeid: number, paymentAccount = 'acc-1001', reverse = false): PostTransactionLineDto[] {
     const direction = (debit: boolean) => debit !== reverse ? NormalBalance.DEBIT : NormalBalance.CREDIT;
     return allocations.flatMap(allocation => {
          const gross = Math.abs(minorUnits(allocation.amount)) / 100;
          const tax = kind === 'revenue_adjustment' ? Math.abs(minorUnits(allocation.taxAmount)) / 100 : 0;
          const shared = { branchid, employeeid, billingid: allocation.billingId, partyType: 'nhis', partyRef: '1', partyName: 'National Health Insurance Scheme (NHIS)', documentRef: `BILL-${allocation.billingId}` };
          const contra = kind === 'receipt' ? paymentAccount : kind === 'write_off' ? 'acc-5007' : 'acc-4000';
          return [
               ...(gross > tax ? [{ accountCode: contra, direction: direction(true), amount: (minorUnits(gross) - minorUnits(tax)) / 100, ...shared }] : []),
               ...(tax ? [{ accountCode: 'acc-2002', direction: direction(true), amount: tax, ...shared }] : []),
               { accountCode: 'acc-1002', direction: direction(false), amount: gross, ...shared },
          ];
     });
}

export class NhisReceivablesService {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: Knex) { }

     private async connection() { return this.connectionOverride || await KnexConnection(this.tenantId); }

     private periodIsolation(db: Knex): Knex.TransactionConfig {
          // InnoDB next-key locks (including newly eligible bill/service inserts) require
          // REPEATABLE READ; do not rely on the deployment's session default.
          return String(db.client.config.client).includes('mysql') ? { isolationLevel: 'repeatable read' } : {};
     }

     private assertActor(actor: AuthUser) {
          if (actor.tenantId !== this.tenantId || !Number.isSafeInteger(actor.employeeid) || actor.employeeid <= 0 ||
               !Number.isSafeInteger(actor.branch) || Number(actor.branch) <= 0) {
               throw new AccountingError('A valid authenticated tenant and active branch are required', 'NHIS_CONTEXT_REQUIRED', 403);
          }
     }

     private async authorize(actor: AuthUser, kind: NhisEventKind | 'reversal', amount: number) {
          this.assertActor(actor);
          const permission = kind === 'receipt' ? 'accounting.journal.post' : kind === 'reversal' ? 'accounting.financial_correction.execute' : 'accounting.journal.approve';
          const authority = await new AuthorityService(this.tenantId).can(actor.employeeid, permission, amount, actor.branch);
          if (!authority.allowed) throw new AccountingError(authority.reason, 'NHIS_AUTHORITY_DENIED', 403);
     }

     private async lockDate(trx: Knex.Transaction, actor: AuthUser, date: string) {
          if (date > new Date().toISOString().slice(0, 10)) throw new AccountingError('NHIS posting dates cannot be in the future', 'INVALID_NHIS_DATE', 400);
          await new AccountingPeriodService(this.tenantId).assertPostingAllowed(date, trx);
          await trx('financial_day_closures').insert({
               branchid: actor.branch, financial_date: date, timezone: 'UTC', status: 'draft',
               workflow_version: 0, created_by: actor.employeeid, created_at: new Date(), updated_at: new Date(),
          }).onConflict(['branchid', 'financial_date']).ignore();
          await trx('financial_day_closures').where({ branchid: actor.branch, financial_date: date }).forUpdate().first();
          await new FinancialFinalizationGuard(this.tenantId, trx).assertDateOpen(Number(actor.branch), date);
     }

     private validatePeriodIntent(data: NhisPeriodPreviewInput) {
          validatePeriod(data);
          nhisDate(data.date);
          if (data.date !== new Date().toISOString().slice(0, 10)) throw new AccountingError('Period settlements must post on the current UTC date', 'INVALID_NHIS_DATE', 400);
          if (data.to > data.date) throw new AccountingError('Service period cannot extend beyond the posting date', 'INVALID_NHIS_DATE', 400);
          if (minorUnits(data.amount) < 0 || (minorUnits(data.amount) === 0 && data.remainingDisposition !== 'final')) throw new AccountingError('Zero received amount is only allowed for an explicit final adjustment', 'INVALID_AMOUNT', 400);
          if ((data.remainingDisposition === 'final') !== !!data.adjustmentKind) throw new AccountingError('Final disposition requires an explicit adjustment kind; other dispositions cannot adjust AR', 'INVALID_NHIS_DISPOSITION', 400);
     }

     /** All branch bills in the date range, independent of reporting pagination.
      * Lock the whole candidate range (including currently excluded bills), then services
      * and allocations in deterministic batches. InnoDB range/row locks protect membership
      * as well as balances until commit. Billing writers also lock their bill header.
      */
     private async periodCohort(trx: Knex.Transaction, actor: AuthUser, data: NhisPeriodPreviewInput, lock: boolean, reviewedToken?: string) {
          let query = trx('billing').where({ branchid: actor.branch })
               .where('billedon', '>=', data.from).where('billedon', '<', nextDate(data.to)).orderBy('billingid');
          if (lock) query = query.forUpdate();
          const candidates = await query;
          const covered = await billingReceivableIds(this.tenantId, candidates.map(b => Number(b.billingid)), trx);
          const bills: PeriodBill[] = [], snapshot: unknown[] = [];
          let excludedMixedBillCount = 0, excludedMissingAccrualBillCount = 0;
          for (let offset = 0; offset < candidates.length; offset += 400) {
               const batch = candidates.slice(offset, offset + 400), ids = batch.map(b => Number(b.billingid));
               let servicesQuery = trx('dboservices').whereIn('billingid', ids).orderBy('billingid').orderBy('serviceid');
               let allocationQuery = trx('acc_nhis_allocations').whereIn('billingid', ids).orderBy('billingid').orderBy('id');
               if (lock) { servicesQuery = servicesQuery.forUpdate(); allocationQuery = allocationQuery.forUpdate(); }
               const services = groupByBill(await servicesQuery), allocations = groupByBill(await allocationQuery);
               for (const bill of batch) {
                    const id = Number(bill.billingid), classification = classifyBillingServices(services.get(id) || []);
                    if (classification === 'mixed') excludedMixedBillCount++;
                    if (classification !== 'nhis' || ['voided', 'corrected', 'written-off'].includes(bill.status)) continue;
                    const outstanding = minorUnits(bill.outstanding) - sumMinor((allocations.get(id) || []).map(a => a.amount));
                    if (outstanding < 0) throw new AccountingError('Negative NHIS balance requires reconciliation', 'NHIS_OVERALLOCATION', 409);
                    if (!outstanding) continue;
                    const payable = minorUnits(bill.payable), tax = minorUnits(bill.amountIncurredDueTax || 0);
                    snapshot.push([id, outstanding, payable, tax, dateOnly(bill.billedon), covered.has(id)]);
                    if (!covered.has(id)) { excludedMissingAccrualBillCount++; continue; }
                    if (data.adjustmentKind === 'revenue_adjustment' && (payable <= 0 || tax < 0 || tax > payable)) throw new AccountingError('Bill tax amounts must be reconciled before adjustment', 'NHIS_INVALID_TAX', 409);
                    bills.push({ billingId: id, reference: `BILL-${id}`, outstandingMinor: outstanding, payableMinor: payable, taxMinor: tax, serviceDate: dateOnly(bill.billedon) });
               }
          }
          const amount = minorUnits(data.amount);
          const snapshotToken = hash({ tenantId: this.tenantId, branchid: actor.branch, ...data, amount, snapshot, excludedMixedBillCount });
          if (reviewedToken && reviewedToken !== snapshotToken) throw new AccountingError('Period membership, accrual coverage or balances changed; review a new preview', 'NHIS_SNAPSHOT_STALE', 409);
          const total = sumMinor(bills.map(b => b.outstandingMinor / 100));
          if (!total || amount > total) throw new AccountingError('Received amount exceeds the eligible accrued NHIS balance', 'NHIS_OVERALLOCATION', 409);
          const shares = allocateMinor(amount, bills.map(b => b.outstandingMinor));
          const remaining = total - amount, adjusted = data.remainingDisposition === 'final' ? remaining : 0;
          const preview: NhisPeriodPreview = {
               from: data.from, to: data.to, billCount: bills.length, eligibleOutstanding: total / 100,
               received: amount / 100, remaining: remaining / 100, adjusted: adjusted / 100, outstandingAfter: (remaining - adjusted) / 100,
               allocationMethod: 'proportional', snapshotToken, excludedMixedBillCount, excludedMissingAccrualBillCount,
               allocationSample: bills.slice(0, 20).map((bill, index) => ({ billingId: bill.billingId, reference: bill.reference,
                    outstanding: bill.outstandingMinor / 100, received: shares[index] / 100, remaining: (bill.outstandingMinor - shares[index]) / 100 })),
          };
          return { bills, shares, preview };
     }

     async previewPeriod(actor: AuthUser, input: unknown): Promise<NhisPeriodPreview> {
          this.assertActor(actor);
          const parsed = periodPreviewSchema.safeParse(input);
          if (!parsed.success) throw new AccountingError('Invalid period preview request', 'INVALID_NHIS_SETTLEMENT', 400);
          this.validatePeriodIntent(parsed.data);
          const db = await this.connection();
          return db.transaction(async trx => {
               // Use current reads even if the deployment uses READ COMMITTED. Preview holds
               // no locks beyond this short transaction; posting always rechecks its hash.
               const { preview } = await this.periodCohort(trx, actor, parsed.data, true);
               if (preview.received > 0) await this.authorize(actor, 'receipt', preview.received);
               if (parsed.data.adjustmentKind) await this.authorize(actor, parsed.data.adjustmentKind, preview.adjusted);
               return preview;
          }, this.periodIsolation(db));
     }

     async settlePeriod(actor: AuthUser, input: unknown): Promise<NhisPeriodSettlementResult> {
          this.assertActor(actor);
          const parsed = periodSettlementSchema.safeParse(input);
          if (!parsed.success) throw new AccountingError('Invalid period settlement request', 'INVALID_NHIS_SETTLEMENT', 400);
          const data = parsed.data;
          // Date shape is checked before replay, but a successful intent can be retried on
          // a later/closed date without re-applying it or requiring today's cohort.
          nhisDate(data.date); validatePeriod(data); minorUnits(data.amount);
          if (minorUnits(data.amount) > 0 && !data.paymentAccountCode) throw new AccountingError('Select the receiving cash or bank account', 'NHIS_PAYMENT_ACCOUNT_REQUIRED', 400);
          if (minorUnits(data.amount) === 0 && data.paymentAccountCode) throw new AccountingError('Adjustment-only settlements cannot include a payment account', 'INVALID_NHIS_SETTLEMENT', 400);
          if (['appeal', 'disputed'].includes(data.remainingDisposition) && !data.remainingReason) throw new AccountingError('An auditable remaining-balance reason is required', 'INVALID_NHIS_DISPOSITION', 400);
          if (data.remainingDisposition === 'final' && (!data.adjustmentKind || !data.adjustmentReference || !data.adjustmentReason)) throw new AccountingError('Final adjustment kind, reason and approval reference are required', 'INVALID_NHIS_DISPOSITION', 400);
          if (data.remainingDisposition !== 'final' && (data.adjustmentKind || data.adjustmentReference || data.adjustmentReason)) throw new AccountingError('Nonfinal balances must remain in AR', 'INVALID_NHIS_DISPOSITION', 400);
          const fingerprint = hash({ ...data, amount: minorUnits(data.amount), employeeid: actor.employeeid, branchid: actor.branch });
          const db = await this.connection();
          const replay = async (trx: Knex, existing: any) => {
               if (existing.fingerprint !== fingerprint || Number(existing.branchid) !== Number(actor.branch)) throw new AccountingError('Request key belongs to another settlement intent', 'NHIS_REQUEST_CONFLICT', 409);
               const result = await this.periodDetail(trx, existing);
               if (result.settlement.received > 0) await this.authorize(actor, 'receipt', result.settlement.received);
               if (data.adjustmentKind) await this.authorize(actor, data.adjustmentKind, result.settlement.adjusted);
               return { ...result, alreadyApplied: true };
          };
          try {
               return await db.transaction(async trx => {
                    let existing = await trx('acc_nhis_period_settlements').where({ request_key: data.requestKey }).first();
                    if (existing) return replay(trx, existing);
                    this.validatePeriodIntent(data);
                    await this.lockDate(trx, actor, data.date);
                    // Current read after the shared posting-day lock handles concurrent retry.
                    existing = await trx('acc_nhis_period_settlements').where({ request_key: data.requestKey }).forUpdate().first();
                    if (existing) return replay(trx, existing);
                    const intent = periodPreviewSchema.parse({ from: data.from, to: data.to, amount: data.amount, date: data.date,
                         remainingDisposition: data.remainingDisposition, ...(data.adjustmentKind ? { adjustmentKind: data.adjustmentKind } : {}) });
                    const { bills, shares, preview } = await this.periodCohort(trx, actor, intent, true, data.snapshotToken);
                    if (preview.received > 0) await this.authorize(actor, 'receipt', preview.received);
                    if (data.adjustmentKind) await this.authorize(actor, data.adjustmentKind, preview.adjusted);
                    const insertEvent = async (kind: NhisEventKind, amount: number, reference: string, reason: string, key: string) => {
                         const [id] = await trx('acc_nhis_events').insert({ request_key: key, fingerprint, kind, reference, reason,
                              event_date: data.date, branchid: actor.branch, amount, payment_account_code: kind === 'receipt' ? data.paymentAccountCode : null,
                              created_by: actor.employeeid, created_at: new Date() });
                         return Number(id);
                    };
                    let receiptId: number | null = null;
                    if (preview.received > 0) {
                         receiptId = await insertEvent('receipt', preview.received, data.reference, data.reason, data.requestKey);
                         await this.post(trx, actor, receiptId, 'receipt', bills.map((b, i) => ({ billingId: b.billingId, amount: shares[i] / 100, taxAmount: 0 })).filter(a => a.amount > 0),
                              data.date, data.reference, data.paymentAccountCode);
                    }
                    let adjustmentId: number | null = null;
                    if (data.adjustmentKind && preview.adjusted > 0) {
                         adjustmentId = await insertEvent(data.adjustmentKind, preview.adjusted, data.adjustmentReference!, data.adjustmentReason!,
                              receiptId ? `period-adjust-${hash(data.requestKey).slice(0, 64)}` : data.requestKey);
                         const allocations = bills.map((b, i) => {
                              const remaining = b.outstandingMinor - shares[i];
                              return { billingId: b.billingId, amount: remaining / 100, taxAmount: data.adjustmentKind === 'revenue_adjustment'
                                   ? allocateMinor(remaining, [b.payableMinor - b.taxMinor, b.taxMinor])[1] / 100 : 0 };
                         }).filter(a => a.amount > 0);
                         await this.post(trx, actor, adjustmentId, data.adjustmentKind, allocations, data.date, data.adjustmentReference!);
                    }
                    const metadata = { ...preview, date: data.date, remainingDisposition: data.remainingDisposition, remainingReason: data.remainingReason || null,
                         adjustmentKind: data.adjustmentKind || null, adjustmentReference: data.adjustmentReference || null, adjustmentReason: data.adjustmentReason || null,
                         reference: data.reference, reason: data.reason, paymentAccountCode: data.paymentAccountCode || null, createdBy: actor.employeeid };
                    const [id] = await trx('acc_nhis_period_settlements').insert({ request_key: data.requestKey, fingerprint, snapshot_token: data.snapshotToken,
                         branchid: actor.branch, service_from: data.from, service_to: data.to, posting_date: data.date, remaining_disposition: data.remainingDisposition,
                         receipt_event_id: receiptId, adjustment_event_id: adjustmentId, metadata: JSON.stringify(metadata), created_by: actor.employeeid, created_at: new Date() });
                    return this.periodDetail(trx, { id, receipt_event_id: receiptId, adjustment_event_id: adjustmentId, metadata: JSON.stringify(metadata) });
               }, this.periodIsolation(db));
          } catch (error) {
               if (!isDuplicate(error)) throw error;
               const existing = await db('acc_nhis_period_settlements').where({ request_key: data.requestKey }).first();
               if (existing) return replay(db, existing);
               throw new AccountingError('This NHIS request key or external reference has already been recorded', 'NHIS_REFERENCE_CONFLICT', 409);
          }
     }

     private async periodDetail(db: Knex, row: any) {
          const summarize = async (id: number) => {
               const event = await db('acc_nhis_events').where({ id }).first();
               const { fingerprint, ...summary } = event;
               const count = await db('acc_nhis_allocations').where({ event_id: id }).count({ count: '*' }).first();
               return { ...summary, amount: minorUnits(summary.amount) / 100, event_date: dateOnly(summary.event_date),
                    allocationCount: Number(count?.count || 0), allocations: [] as [] };
          };
          const ids = [row.receipt_event_id, row.adjustment_event_id].filter(Boolean).map(Number);
          const reversed = await db('acc_nhis_events').whereIn('reversal_of_event_id', ids).select('id', 'reversal_of_event_id');
          return { receiptEvent: row.receipt_event_id ? await summarize(Number(row.receipt_event_id)) : null,
               ...(row.adjustment_event_id ? { adjustmentEvent: await summarize(Number(row.adjustment_event_id)) } : {}),
               settlement: { id: Number(row.id), ...JSON.parse(row.metadata), state: reversed.length === ids.length ? 'reversed' : reversed.length ? 'partially_reversed' : 'applied',
                    reversalEventIds: reversed.map(r => Number(r.id)), totalsBasis: 'at_posting_not_current_balance' } as NhisPeriodSettlementMetadata };
     }

     async record(actor: AuthUser, kind: NhisEventKind, input: unknown) {
          const parsed = eventSchema.safeParse(input);
          if (!parsed.success) throw new AccountingError(parsed.error.issues.map(issue => issue.message).join('; '), 'INVALID_NHIS_EVENT', 400);
          const data = parsed.data;
          nhisDate(data.date);
          const amount = minorUnits(data.amount);
          if (amount <= 0 || data.allocations.some(a => minorUnits(a.amount) <= 0)) throw new AccountingError('NHIS amounts must be positive', 'INVALID_AMOUNT', 400);
          if (sumMinor(data.allocations.map(a => a.amount)) !== amount) throw new AccountingError('Allocations must exactly equal the event amount', 'NHIS_ALLOCATION_MISMATCH', 400);
          if (new Set(data.allocations.map(a => a.billingId)).size !== data.allocations.length) throw new AccountingError('A bill cannot appear twice', 'NHIS_DUPLICATE_BILL', 400);
          if (kind === 'receipt' && !data.paymentAccountCode) throw new AccountingError('Select the cash or bank account that received the money', 'NHIS_PAYMENT_ACCOUNT_REQUIRED', 400);
          if (kind !== 'receipt' && data.paymentAccountCode) throw new AccountingError('Adjustments cannot include a cash payment account', 'INVALID_NHIS_EVENT', 400);
          await this.authorize(actor, kind, amount / 100);
          const allocations = [...data.allocations].sort((a, b) => a.billingId - b.billingId);
          const fingerprint = createHash('sha256').update(JSON.stringify({ kind, ...data, amount, allocations: allocations.map(a => [a.billingId, minorUnits(a.amount)]), employeeid: actor.employeeid, branchid: actor.branch })).digest('hex');
          const db = await this.connection();
          return db.transaction(async trx => {
               const existing = await trx('acc_nhis_events').where({ request_key: data.requestKey }).first();
               if (existing) return this.replay(existing, fingerprint, trx);
               await this.lockDate(trx, actor, data.date);
               const checked: Allocation[] = [];
               for (const allocation of allocations) {
                    const bill = await trx('billing').where({ billingid: allocation.billingId, branchid: actor.branch }).forUpdate().first();
                    if (!bill) throw new AccountingError('NHIS bill not found in your active branch', 'NHIS_BILL_NOT_FOUND', 404);
                    if (['voided', 'corrected', 'written-off'].includes(bill.status)) throw new AccountingError('This bill is not available for NHIS settlement', 'NHIS_BILL_UNAVAILABLE', 409);
                    const payer = await resolveBillingPayer(trx, allocation.billingId, Number(bill.patientid));
                    if (payer.classification !== 'nhis') throw new AccountingError('Only clearly identified NHIS bills can be allocated; separate mixed or patient charges first', 'NHIS_PAYER_MISMATCH', 409);
                    if (!await hasBillingReceivable(this.tenantId, allocation.billingId, trx)) throw new AccountingError('This bill has no accounting accrual. Reconcile accounting coverage/opening balances before settlement.', 'NHIS_ACCRUAL_REQUIRED', 409);
                    const settled = await trx('acc_nhis_allocations').where({ billingid: allocation.billingId }).forUpdate();
                    const available = minorUnits(bill.outstanding) - sumMinor(settled.map(row => row.amount));
                    if (data.date < dateOnly(bill.billedon)) throw new AccountingError('A settlement cannot predate the billed service', 'INVALID_NHIS_DATE', 400);
                    if (minorUnits(allocation.amount) > available) throw new AccountingError('Allocation exceeds the remaining NHIS receivable; reload the bill', 'NHIS_OVERALLOCATION', 409);
                    let taxAmount = 0;
                    if (kind === 'revenue_adjustment') {
                         const gross = minorUnits(bill.payable), tax = minorUnits(bill.amountIncurredDueTax || 0);
                         if (gross <= 0 || tax < 0 || tax > gross) throw new AccountingError('Bill tax amounts must be reconciled before adjustment', 'NHIS_INVALID_TAX', 409);
                         taxAmount = allocateMinor(minorUnits(allocation.amount), [gross - tax, tax])[1] / 100;
                    }
                    checked.push({ billingId: allocation.billingId, amount: minorUnits(allocation.amount) / 100, taxAmount });
               }
               let eventId: number;
               try {
                    const [id] = await trx('acc_nhis_events').insert({
                         request_key: data.requestKey, fingerprint, kind, reference: data.reference, reason: data.reason,
                         event_date: data.date, branchid: actor.branch, amount: amount / 100,
                         payment_account_code: data.paymentAccountCode || null, created_by: actor.employeeid, created_at: new Date(),
                    });
                    eventId = Number(id);
               } catch (error) {
                    if (!isDuplicate(error)) throw error;
                    const raced = await trx('acc_nhis_events').where({ request_key: data.requestKey }).forUpdate().first();
                    if (!raced) throw new AccountingError('This NHIS reference has already been recorded in your branch', 'NHIS_REFERENCE_CONFLICT', 409);
                    return this.replay(raced, fingerprint, trx);
               }
               await this.post(trx, actor, eventId, kind, checked, data.date, data.reference, data.paymentAccountCode);
               return this.detailIn(trx, eventId, Number(actor.branch));
          });
     }

     async reverse(actor: AuthUser, eventId: number, input: unknown) {
          this.assertActor(actor);
          const db = await this.connection();
          const settlement = await db('acc_nhis_period_settlements').where({ branchid: actor.branch })
               .where(builder => builder.where('receipt_event_id', eventId).orWhere('adjustment_event_id', eventId)).first();
          if (settlement?.receipt_event_id && settlement.adjustment_event_id) throw new AccountingError('Reverse both linked events through the period settlement reversal endpoint', 'NHIS_SETTLEMENT_REVERSAL_REQUIRED', 409);
          return this.reverseEvent(actor, eventId, input);
     }

     /** Savepoints reuse existing exact-event reversal, authority, locks and outbox path.
      * Outer transaction makes a paired reversal all-or-nothing, including retries.
      */
     async reversePeriod(actor: AuthUser, settlementId: number, input: unknown) {
          this.assertActor(actor);
          const parsed = reversalSchema.safeParse(input);
          if (!parsed.success || !Number.isSafeInteger(settlementId) || settlementId <= 0 || parsed.data.reference.length > 100) throw new AccountingError('Valid reversal data is required; reference must be at most 100 characters', 'INVALID_NHIS_REVERSAL', 400);
          const db = await this.connection(), data = parsed.data;
          nhisDate(data.date);
          return db.transaction(async trx => {
               const settlement = await trx('acc_nhis_period_settlements').where({ id: settlementId, branchid: actor.branch }).first();
               if (!settlement) throw new AccountingError('Period settlement not found in your branch', 'NHIS_EVENT_NOT_FOUND', 404);
               const ids = [settlement.receipt_event_id, settlement.adjustment_event_id].filter(Boolean).map(Number);
               const totals = (await this.periodDetail(trx, settlement)).settlement;
               await this.authorize(actor, 'reversal', (minorUnits(totals.received) + minorUnits(totals.adjusted)) / 100);
               const derived = (id: number) => ({ ...data, requestKey: `period-reverse-${hash({ key: data.requestKey, settlementId, id })}`,
                    reference: `${data.reference} [${id}]` });
               // Successful retries must work even after today's date/period has changed.
               const prior = await trx('acc_nhis_events').whereIn('reversal_of_event_id', ids);
               if (prior.length !== ids.length) {
                    if (data.date !== new Date().toISOString().slice(0, 10)) throw new AccountingError('Period reversal must post today', 'INVALID_NHIS_DATE', 400);
                    await this.lockDate(trx, actor, data.date);
               }
               const reversalEvents = [];
               for (const id of ids) reversalEvents.push(await this.reverseEvent(actor, id, derived(id), trx));
               const result = await this.periodDetail(trx, settlement);
               return { ...result, reversalEvents: reversalEvents.map(({ allocations, ...event }) => ({ ...event, allocationCount: allocations.length, allocations: [] })),
                    ...(reversalEvents.every(event => event.alreadyApplied) ? { alreadyApplied: true } : {}) };
          });
     }

     private async reverseEvent(actor: AuthUser, eventId: number, input: unknown, transaction?: Knex) {
          const parsed = reversalSchema.safeParse(input);
          if (!parsed.success || !Number.isSafeInteger(eventId) || eventId <= 0) throw new AccountingError('A valid reversal reference, reason, date and request key are required', 'INVALID_NHIS_REVERSAL', 400);
          this.assertActor(actor);
          const data = parsed.data;
          nhisDate(data.date);
          const db = transaction || await this.connection();
          const source = await db<NhisEvent>('acc_nhis_events').where({ id: eventId, branchid: actor.branch }).first();
          if (!source || source.kind === 'reversal') throw new AccountingError('Original NHIS event not found', 'NHIS_EVENT_NOT_FOUND', 404);
          await this.authorize(actor, 'reversal', Number(source.amount));
          const fingerprint = createHash('sha256').update(JSON.stringify({ ...data, eventId, employeeid: actor.employeeid, branchid: actor.branch })).digest('hex');
          return db.transaction(async trx => {
               const existing = await trx('acc_nhis_events').where({ request_key: data.requestKey }).first();
               if (existing) return this.replay(existing, fingerprint, trx);
               await this.lockDate(trx, actor, data.date);
               if (data.date < dateOnly(source.event_date)) throw new AccountingError('A reversal cannot predate its original event', 'INVALID_NHIS_DATE', 400);
               const original = await trx<NhisEvent>('acc_nhis_events').where({ id: eventId, branchid: actor.branch }).forUpdate().first();
               if (!original || original.kind === 'reversal') throw new AccountingError('Original NHIS event not found', 'NHIS_EVENT_NOT_FOUND', 404);
               if (!transaction) {
                    const linked = await trx('acc_nhis_period_settlements').where({ branchid: actor.branch })
                         .where(builder => builder.where('receipt_event_id', eventId).orWhere('adjustment_event_id', eventId)).forUpdate().first();
                    if (linked?.receipt_event_id && linked.adjustment_event_id) throw new AccountingError('Use atomic period settlement reversal for these paired events', 'NHIS_SETTLEMENT_REVERSAL_REQUIRED', 409);
               }
               const reversed = await trx('acc_nhis_events').where({ reversal_of_event_id: eventId }).forUpdate().first();
               if (reversed) {
                    if (reversed.request_key === data.requestKey) return this.replay(reversed, fingerprint, trx);
                    throw new AccountingError('This NHIS event has already been reversed', 'NHIS_ALREADY_REVERSED', 409);
               }
               const originalAllocations = await trx('acc_nhis_allocations').where({ event_id: eventId }).orderBy('billingid');
               for (const allocation of originalAllocations) await trx('billing').where({ billingid: allocation.billingid }).forUpdate().first();
               let id: number;
               try {
                    [id] = await trx('acc_nhis_events').insert({
                    request_key: data.requestKey, fingerprint, kind: 'reversal', reverses_kind: original.kind,
                    reversal_of_event_id: eventId, reference: data.reference, reason: data.reason,
                    event_date: data.date, branchid: actor.branch, amount: original.amount,
                    payment_account_code: original.payment_account_code, created_by: actor.employeeid, created_at: new Date(),
                    });
               } catch (error) {
                    if (!isDuplicate(error)) throw error;
                    const raced = await trx('acc_nhis_events').where({ request_key: data.requestKey }).forUpdate().first();
                    if (!raced) throw new AccountingError('This NHIS reversal or reference has already been recorded', 'NHIS_ALREADY_REVERSED', 409);
                    return this.replay(raced, fingerprint, trx);
               }
               const allocations = originalAllocations.map(a => ({ billingId: Number(a.billingid), amount: -Number(a.amount), taxAmount: -Number(a.tax_amount) }));
               await this.post(trx, actor, Number(id), original.kind, allocations, data.date, data.reference, original.payment_account_code || undefined, true);
               return this.detailIn(trx, Number(id), Number(actor.branch));
          });
     }

     private async post(trx: Knex.Transaction, actor: AuthUser, id: number, kind: NhisEventKind, allocations: Allocation[], date: string, reference: string, paymentAccount?: string, reverse = false) {
          for (let offset = 0; offset < allocations.length; offset += 100) {
               const batch = allocations.slice(offset, offset + 100);
               await trx('acc_nhis_allocations').insert(batch.map(a => ({ event_id: id, billingid: a.billingId, amount: a.amount, tax_amount: a.taxAmount })));
          }
          const persisted = await trx('acc_nhis_allocations').where({ event_id: id }).orderBy('billingid');
          await new SubledgerService(this.tenantId).recordMany(persisted.map(allocation => ({
                    ledger: 'AR', partyType: 'nhis', partyId: 1, partyName: 'National Health Insurance Scheme (NHIS)',
                    documentType: reverse ? 'adjustment' : kind === 'receipt' ? 'payment' : kind === 'write_off' ? 'write_off' : 'credit_note',
                    documentRef: `BILL-${allocation.billingid}`, documentDate: date, amount: -Number(allocation.amount),
                    taxAmount: -Number(allocation.tax_amount), sourceModule: SourceModule.BILLING,
                    sourceTable: 'acc_nhis_allocations', sourceRef: String(allocation.id), branchid: actor.branch,
               })), trx);
          // Outbox payload is MySQL TEXT (64KB), not LONGTEXT. Bound journal work as
          // well as SQL inserts; each chunk balances independently and has a stable
          // source discriminator. All queue rows still commit with the one event.
          for (let offset = 0; offset < allocations.length; offset += 40) {
               await enqueuePosting(this.tenantId, {
                    tenantId: this.tenantId, transactionType: reverse ? TransactionType.REVERSAL : kind === 'receipt' ? TransactionType.PAYMENT : TransactionType.ADJUSTMENT,
                    sourceModule: SourceModule.BILLING, sourceTable: 'acc_nhis_events', sourcePk: id,
                    sourceRef: allocations.length <= 40 ? String(id) : `${id}:batch:${offset / 40}`,
                    description: `NHIS ${reverse ? 'reversal' : kind}: ${reference}`, occurredAt: date, createdBy: actor.employeeid,
                    lines: nhisPostingLines(kind, allocations.slice(offset, offset + 40), Number(actor.branch), actor.employeeid, paymentAccount, reverse),
               }, trx);
          }
     }

     private async replay(existing: { id: number; fingerprint: string; branchid: number } | undefined, fingerprint: string, trx: Knex.Transaction) {
          if (!existing || existing.fingerprint !== fingerprint) throw new AccountingError('This request key was used for a different NHIS event', 'NHIS_REQUEST_CONFLICT', 409);
          return { ...await this.detailIn(trx, Number(existing.id), Number(existing.branchid)), alreadyApplied: true };
     }

     private async detailIn(db: Knex, id: number, branchid: number) {
          const event = await db('acc_nhis_events').where({ id, branchid }).first();
          if (!event) throw new AccountingError('NHIS event not found', 'NHIS_EVENT_NOT_FOUND', 404);
          const allocations = await db('acc_nhis_allocations').where({ event_id: id }).orderBy('billingid');
          const { fingerprint, ...detail } = event;
          return { ...detail, allocations, periodSettlement: await this.periodActivity(db, event, branchid) };
     }

     private async periodActivity(db: Knex, event: any, branchid: number) {
          const sourceId = Number(event.reversal_of_event_id || event.id);
          const row = await db('acc_nhis_period_settlements').where({ branchid })
               .where(builder => builder.where('receipt_event_id', sourceId).orWhere('adjustment_event_id', sourceId)).first();
          return row ? (await this.periodDetail(db, row)).settlement : null;
     }

     async eventAllocations(actor: AuthUser, eventId: number, input: { page?: number; count?: number } = {}) {
          this.assertActor(actor);
          if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new AccountingError('A valid event ID is required', 'NHIS_EVENT_NOT_FOUND', 404);
          const parsed = z.object({ page: z.number().int().min(1).max(1000000).default(1), count: z.number().int().min(1).max(100).default(25) }).safeParse(input);
          if (!parsed.success) throw new AccountingError('Page must be a positive integer; count must be between 1 and 100', 'INVALID_NHIS_FILTER', 400);
          const db = await this.connection(), { page, count } = parsed.data;
          if (!await db('acc_nhis_events').where({ id: eventId, branchid: actor.branch }).first()) throw new AccountingError('NHIS event not found in your branch', 'NHIS_EVENT_NOT_FOUND', 404);
          const query = db('acc_nhis_allocations').where({ event_id: eventId });
          const total = await query.clone().count({ count: '*' }).first();
          const rows = await query.orderBy('billingid').limit(count).offset((page - 1) * count);
          return { eventId, allocationCount: Number(total?.count || 0), total: Number(total?.count || 0), page, count,
               rows: rows.map(row => ({ ...row, amount: minorUnits(row.amount) / 100, tax_amount: minorUnits(row.tax_amount) / 100 })) };
     }

     async events(actor: AuthUser, filters: NhisReportFilters = {}) {
          this.assertActor(actor);
          validatePeriod(filters);
          const db = await this.connection(), paging = parsePaging(filters, 25);
          const query = db('acc_nhis_events').where({ branchid: actor.branch });
          if (filters.from) query.where('event_date', '>=', filters.from);
          if (filters.to) query.where('event_date', '<=', filters.to);
          const [total, rows] = await Promise.all([
               query.clone().count({ count: '*' }).first(),
               query.clone().select('id', 'kind', 'reverses_kind', 'reversal_of_event_id', 'reference', 'reason', 'event_date', 'amount', 'created_by').orderBy('event_date', 'desc').orderBy('id', 'desc').limit(paging.count).offset(paging.offset),
          ]);
          const counts = rows.length ? await db('acc_nhis_allocations').whereIn('event_id', rows.map(row => row.id)).groupBy('event_id').select('event_id').count({ count: '*' }) : [];
          const countByEvent = new Map(counts.map(row => [Number(row.event_id), Number(row.count)]));
          return { rows: await Promise.all(rows.map(async row => {
               const periodSettlement = await this.periodActivity(db, row, Number(actor.branch));
               const allocationCount = countByEvent.get(Number(row.id)) || 0;
               const allocations = periodSettlement ? [] : await db('acc_nhis_allocations').where({ event_id: row.id }).orderBy('billingid').limit(20);
               return { ...row, allocationCount, allocations, allocationsTruncated: allocationCount > allocations.length, periodSettlement };
          })), total: Number(total?.count || 0), page: paging.page, count: paging.count };
     }

     async cohort(actor: AuthUser, filters: NhisReportFilters = {}) {
          this.assertActor(actor);
          validatePeriod(filters);
          const db = await this.connection(), paging = parsePaging(filters, 25);
          const query = db('billing').where({ branchid: actor.branch }).where(builder => builder.whereNull('status').orWhereNotIn('status', ['voided', 'corrected']));
          if (filters.from) query.whereRaw('DATE(billedon) >= ?', [filters.from]);
          if (filters.to) query.whereRaw('DATE(billedon) <= ?', [filters.to]);
          const bills = await query.orderBy('billedon').orderBy('billingid');
          const rows = [], excludedMixedBills: number[] = [];
          const totals = { expected: 0, received: 0, revenueAdjustments: 0, writtenOff: 0, outstanding: 0, unverifiedLegacyReceipts: 0, reconciliationDifference: 0 };
          const ids = bills.map(bill => Number(bill.billingid));
          const allocations = ids.length ? await db('acc_nhis_allocations as allocation').join('acc_nhis_events as event', 'event.id', 'allocation.event_id').whereIn('allocation.billingid', ids).select('allocation.*', 'event.kind', 'event.reverses_kind') : [];
          const history = ids.length ? await db('billinghx').whereIn('Billingid', ids).where(builder => builder.whereNull('isVoided').orWhere('isVoided', 0)) : [];
          const payers = await resolveBillingPayers(db, bills);
          const allocationsByBill = groupByBill(allocations);
          const historyByBill = groupByBill(history, 'Billingid');
          for (const bill of bills) {
               const payer = payers.get(Number(bill.billingid));
               if (!payer) throw new AccountingError('Unable to resolve billing payer', 'NHIS_PAYER_UNRESOLVED', 409);
               if (payer.classification === 'mixed') excludedMixedBills.push(Number(bill.billingid));
               if (payer.classification !== 'nhis') continue;
               const billAllocations = allocationsByBill.get(Number(bill.billingid)) || [];
               const byKind = (kind: NhisEventKind) => sumMinor(billAllocations.filter(a => (a.kind === 'reversal' ? a.reverses_kind : a.kind) === kind).map(a => a.amount));
               const netHistory = sumMinor((historyByBill.get(Number(bill.billingid)) || []).map(h => h.type === 'credit' ? h.Amount : h.type === 'debit' ? -Number(h.Amount) : 0));
               const legacyPaid = minorUnits(bill.paid || 0), legacyWriteoff = minorUnits(bill.writeoff || 0);
               const row = {
                    billingId: Number(bill.billingid), reference: `BILL-${bill.billingid}`, serviceDate: dateOnly(bill.billedon),
                    expected: Number(bill.payable), received: (legacyPaid + byKind('receipt')) / 100,
                    revenueAdjustments: byKind('revenue_adjustment') / 100, writtenOff: (legacyWriteoff + byKind('write_off')) / 100,
                    outstanding: (minorUnits(bill.outstanding) - sumMinor(billAllocations.map(a => a.amount))) / 100,
                    unverifiedLegacyReceipts: (legacyPaid - netHistory) / 100,
                    reconciliationDifference: (minorUnits(bill.payable) - legacyPaid - legacyWriteoff - minorUnits(bill.outstanding)) / 100,
               };
               rows.push(row);
               for (const key of Object.keys(totals) as Array<keyof typeof totals>) totals[key] = (minorUnits(totals[key]) + minorUnits(row[key])) / 100;
          }
          return { payer: 'National Health Insurance Scheme (NHIS)', basis: 'current_balances_for_service_period', from: filters.from || null, to: filters.to || null,
               rows: rows.slice(paging.offset, paging.offset + paging.count), total: rows.length, page: paging.page, count: paging.count, totals, excludedMixedBills };
     }

     async cashReceipts(actor: AuthUser, filters: NhisReportFilters = {}) {
          this.assertActor(actor);
          validatePeriod(filters);
          const db = await this.connection(), paging = parsePaging(filters, 25);
          const legacy = db('billinghx as history').join('billing as bill', 'bill.billingid', 'history.Billingid')
               .where('bill.branchid', actor.branch).where(builder => builder.whereNull('history.isVoided').orWhere('history.isVoided', 0))
               .whereIn('history.type', ['credit', 'debit']).select('history.*', 'bill.patientid');
          if (filters.from) legacy.whereRaw('DATE(history.Date) >= ?', [filters.from]);
          if (filters.to) legacy.whereRaw('DATE(history.Date) <= ?', [filters.to]);
          const events = db('acc_nhis_events as event').join('acc_nhis_allocations as allocation', 'allocation.event_id', 'event.id')
               .where('event.branchid', actor.branch).where(builder => builder.where('event.kind', 'receipt').orWhere({ 'event.kind': 'reversal', 'event.reverses_kind': 'receipt' }))
               .select('event.id', 'event.reference', 'event.event_date', 'allocation.billingid', 'allocation.amount');
          if (filters.from) events.where('event.event_date', '>=', filters.from);
          if (filters.to) events.where('event.event_date', '<=', filters.to);
          const [history, allocated] = await Promise.all([legacy, events]);
          const payers = await resolveBillingPayers(db, history.map(row => ({ billingid: Number(row.Billingid), patientid: Number(row.patientid) })));
          const rows: Array<{ source: string; reference: string; billingId: number; date: string; amount: number }> = [];
          for (const row of history) {
               if (payers.get(Number(row.Billingid))?.classification !== 'nhis') continue;
               rows.push({ source: 'billinghx', reference: `PAY-${row.KeyID}`, billingId: Number(row.Billingid), date: dateOnly(row.Date), amount: Number(row.Amount) * (row.type === 'debit' ? -1 : 1) });
          }
          for (const row of allocated) rows.push({ source: 'acc_nhis_events', reference: row.reference, billingId: Number(row.billingid), date: dateOnly(row.event_date), amount: Number(row.amount) });
          rows.sort((a, b) => a.date.localeCompare(b.date) || a.billingId - b.billingId);
          return { basis: 'cash_received_in_period', rows: rows.slice(paging.offset, paging.offset + paging.count), total: rows.length, page: paging.page, count: paging.count,
               totals: { received: sumMinor(rows.filter(row => row.amount > 0).map(row => row.amount)) / 100, reversedOrRefunded: -sumMinor(rows.filter(row => row.amount < 0).map(row => row.amount)) / 100, netReceived: sumMinor(rows.map(row => row.amount)) / 100 } };
     }
}

function dateOnly(value: Date | string): string { return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); }
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function nextDate(value: string): string { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function isDuplicate(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY'; }
function groupByBill<T extends Record<string, unknown>>(rows: T[], key = 'billingid'): Map<number, T[]> {
     const groups = new Map<number, T[]>();
     for (const row of rows) {
          const id = Number(row[key]);
          if (!groups.has(id)) groups.set(id, []);
          groups.get(id)!.push(row);
     }
     return groups;
}
