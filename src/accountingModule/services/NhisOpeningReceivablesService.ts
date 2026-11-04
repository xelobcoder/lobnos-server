import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { z } from 'zod';
import type { AuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import KnexConnection from '../../database/KnexConnections';
import { AccountingError } from '../errors/AccountingErrors';
import { billingReceivableIds } from '../integrations/BillingAccounting';
import { classifyBillingServices } from './BillingPayer';
import { minorUnits } from '../utils/money';
import { AuthorityService } from './AuthorityService';
import { AccountingPeriodService } from './AccountingPeriodService';
import { FinancialFinalizationGuard } from './FinancialFinalizationGuard';
import { SubledgerService } from './SubledgerService';
import { createAccountingService } from '../index';
import { SourceModule } from '../enums/source-module.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import { NormalBalance } from '../enums/normal-balance.enum';
import { nhisDate } from './NhisReceivablesService';

const previewSchema = z.object({ from: z.string(), to: z.string(), date: z.string() }).strict();
const postSchema = previewSchema.extend({ requestKey: z.string().regex(/^[a-zA-Z0-9_-]{16,80}$/), snapshotToken: z.string().regex(/^[a-f0-9]{64}$/),
    amount: z.union([z.string(), z.number()]), offsetAccountCode: z.string().min(1).max(20), reference: z.string().trim().min(1).max(120),
    reason: z.string().trim().min(1).max(1000), confirmed: z.literal(true), acknowledgedLegacyReceipts: z.literal(true) }).strict();
const reverseSchema = z.object({ requestKey: postSchema.shape.requestKey, reference: postSchema.shape.reference, reason: postSchema.shape.reason }).strict();
type Dates = z.infer<typeof previewSchema>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const day = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
interface OpeningBill { billingId: number; outstanding: number; paid: number; writeoff: number; date: string }

export class NhisOpeningReceivablesService {
    constructor(private tenantId: number, private override?: Knex) { }
    private connection() { return this.override || KnexConnection(this.tenantId); }
    private actor(user: AuthUser) {
        if (user.tenantId !== this.tenantId || !roleAllowed(user.role, ['admin']) || !Number.isSafeInteger(user.employeeid) || user.employeeid <= 0 || !Number.isSafeInteger(user.branch) || Number(user.branch) <= 0)
            throw new AccountingError('An owner in the active facility and branch must review opening receivables', 'NHIS_OPENING_AUTHORITY_REQUIRED', 403);
    }
    private dates(input: Dates) {
        for (const value of [input.from, input.to, input.date]) nhisDate(value);
        if (input.from > input.to || input.to > input.date || input.date > new Date().toISOString().slice(0, 10)) throw new AccountingError('The service period must end by the opening date, which cannot be in the future', 'INVALID_NHIS_DATE', 400);
    }
    private async authority(user: AuthUser, permission: 'accounting.journal.approve' | 'accounting.financial_correction.execute', amount: number) {
        const allowed = await new AuthorityService(this.tenantId).can(user.employeeid, permission, amount, user.branch);
        if (!allowed.allowed) throw new AccountingError(allowed.reason, 'NHIS_AUTHORITY_DENIED', 403);
    }
    private async lockDate(trx: Knex, user: AuthUser, date: string) {
        await new AccountingPeriodService(this.tenantId).assertPostingAllowed(date, trx);
        await trx('financial_day_closures').insert({ branchid: user.branch, financial_date: date, timezone: 'UTC', status: 'draft',
            workflow_version: 0, created_by: user.employeeid, created_at: new Date(), updated_at: new Date() }).onConflict(['branchid', 'financial_date']).ignore();
        await trx('financial_day_closures').where({ branchid: user.branch, financial_date: date }).forUpdate().first();
        await new FinancialFinalizationGuard(this.tenantId, trx).assertDateOpen(Number(user.branch), date);
    }
    private async cohort(db: Knex, user: AuthUser, input: Dates, lock: boolean) {
        let query = db('billing').where('branchid', user.branch).where('billedon', '>=', input.from)
            .where('billedon', '<', nextDate(input.to)).orderBy('billingid');
        if (lock) query = query.forUpdate();
        const candidates = await query, bills: OpeningBill[] = [];
        let receiptDifference = 0, mixedBills = 0;
        for (let offset = 0; offset < candidates.length; offset += 400) {
            const batch = candidates.slice(offset, offset + 400), ids = batch.map(row => Number(row.billingid));
            const covered = await billingReceivableIds(this.tenantId, ids, db);
            let servicesQuery = db('dboservices').whereIn('billingid', ids).orderBy('billingid').orderBy('serviceid');
            if (lock) servicesQuery = servicesQuery.forUpdate();
            const services = await servicesQuery;
            const history = await db('billinghx').whereIn('Billingid', ids).where(builder => builder.whereNull('isVoided').orWhere('isVoided', 0));
            for (const bill of batch) {
                const id = Number(bill.billingid), type = classifyBillingServices(services.filter(row => Number(row.billingid) === id));
                if (type === 'mixed') mixedBills++;
                if (type !== 'nhis' || covered.has(id) || ['voided', 'corrected', 'written-off'].includes(bill.status) || minorUnits(bill.outstanding || 0) <= 0) continue;
                const outstanding = minorUnits(bill.outstanding), paid = minorUnits(bill.paid || 0), writeoff = minorUnits(bill.writeoff || 0);
                if (minorUnits(bill.payable) - paid - writeoff !== outstanding) throw new AccountingError(`BILL-${id} must be reconciled before importing its opening balance`, 'NHIS_BALANCE_REVIEW_REQUIRED', 409);
                const recorded = history.filter(row => Number(row.Billingid) === id).reduce((sum, row) => sum + (row.type === 'credit' ? minorUnits(row.Amount) : row.type === 'debit' ? -minorUnits(row.Amount) : 0), 0);
                receiptDifference += paid - recorded;
                bills.push({ billingId: id, outstanding, paid, writeoff, date: day(bill.billedon) });
            }
        }
        const amount = bills.reduce((sum, bill) => sum + bill.outstanding, 0);
        const snapshotToken = hash({ tenantId: this.tenantId, branch: user.branch, from: input.from, to: input.to, date: input.date, bills, receiptDifference });
        return { bills, snapshotToken, amount: amount / 100, billCount: bills.length, unverifiedLegacyReceipts: receiptDifference / 100, excludedMixedBills: mixedBills };
    }
    async preview(user: AuthUser, input: unknown) {
        this.actor(user);
        const parsed = previewSchema.safeParse(input);
        if (!parsed.success) throw new AccountingError('Valid service-period and opening dates are required', 'INVALID_NHIS_OPENING', 400);
        this.dates(parsed.data);
        const db = await this.connection();
        return db.transaction(async trx => {
            const cohort = await this.cohort(trx, user, parsed.data, false);
            const accounts = await trx('acc_accounts').where({ type: 'equity', is_active: 1 }).select('account_code', 'name').orderBy('account_code');
            return { ...parsed.data, amount: cohort.amount, billCount: cohort.billCount, snapshotToken: cohort.snapshotToken,
                unverifiedLegacyReceipts: cohort.unverifiedLegacyReceipts, excludedMixedBills: cohort.excludedMixedBills, offsetAccounts: accounts,
                sample: cohort.bills.slice(0, 20).map(bill => ({ billingId: bill.billingId, amount: bill.outstanding / 100 })) };
        });
    }
    async post(user: AuthUser, input: unknown) {
        this.actor(user);
        const parsed = postSchema.safeParse(input);
        if (!parsed.success) throw new AccountingError('Review and explicitly confirm the opening amount, offset account and legacy receipts', 'INVALID_NHIS_OPENING', 400);
        const data = parsed.data, fingerprint = hash({ ...data, employeeid: user.employeeid, branch: user.branch, tenant: user.tenantId });
        if (minorUnits(data.amount) <= 0) throw new AccountingError('A positive opening amount is required', 'INVALID_AMOUNT', 400);
        await this.authority(user, 'accounting.journal.approve', Number(data.amount));
        const db = await this.connection();
        return db.transaction(async trx => {
            const previous = await trx('acc_nhis_openings').where('request_key', data.requestKey).first();
            if (previous) return this.replay(previous, fingerprint);
            this.dates(data);
            await this.lockDate(trx, user, data.date);
            const cohort = await this.cohort(trx, user, data, true);
            const raced = await trx('acc_nhis_openings').where('request_key', data.requestKey).forUpdate().first();
            if (raced) return this.replay(raced, fingerprint);
            if (cohort.snapshotToken !== data.snapshotToken) throw new AccountingError('Opening balances changed. Review a fresh preview.', 'NHIS_SNAPSHOT_STALE', 409);
            if (!cohort.billCount || minorUnits(data.amount) !== minorUnits(cohort.amount)) throw new AccountingError('Opening amount must equal the reviewed outstanding balances', 'INVALID_NHIS_OPENING', 409);
            const account = await trx('acc_accounts').where({ account_code: data.offsetAccountCode, type: 'equity', is_active: 1 }).forUpdate().first();
            if (!account) throw new AccountingError('Select an active accountant-approved equity offset account', 'INVALID_NHIS_OPENING_ACCOUNT', 400);
            const [id] = await trx('acc_nhis_openings').insert({ request_key: data.requestKey, fingerprint, snapshot_token: data.snapshotToken,
                branchid: user.branch, opening_date: data.date, service_from: data.from, service_to: data.to, offset_account_code: data.offsetAccountCode,
                amount: cohort.amount, bill_count: cohort.billCount, reference: data.reference, reason: data.reason, created_by: user.employeeid, created_at: new Date() });
            for (let offset = 0; offset < cohort.bills.length; offset += 40) {
                const batch = cohort.bills.slice(offset, offset + 40);
                const amount = batch.reduce((sum, bill) => sum + bill.outstanding, 0) / 100;
                const { entry } = await createAccountingService(this.tenantId).postTransaction({ tenantId: this.tenantId, trx,
                    transactionType: TransactionType.ADJUSTMENT, sourceModule: SourceModule.MANUAL, sourceTable: 'acc_nhis_openings', sourcePk: Number(id), sourceRef: String(offset / 40),
                    description: `Reviewed NHIS opening balances: ${data.reference}`, occurredAt: data.date, createdBy: user.employeeid,
                    lines: [...batch.map(bill => ({ accountCode: 'acc-1002', direction: NormalBalance.DEBIT, amount: bill.outstanding / 100,
                        billingid: bill.billingId, branchid: user.branch, employeeid: user.employeeid, partyType: 'nhis', partyRef: '1', partyName: 'National Health Insurance Scheme (NHIS)', documentRef: `BILL-${bill.billingId}` })),
                        { accountCode: data.offsetAccountCode, direction: NormalBalance.CREDIT, amount, branchid: user.branch, employeeid: user.employeeid }] });
                await trx('acc_nhis_opening_bills').insert(batch.map(bill => ({ billingid: bill.billingId, opening_id: id, journal_entry_id: entry.id, amount: bill.outstanding / 100 })));
                await new SubledgerService(this.tenantId).recordMany(batch.map(bill => ({ ledger: 'AR', partyType: 'nhis', partyId: 1, partyName: 'National Health Insurance Scheme (NHIS)',
                    documentType: 'adjustment', documentRef: `BILL-${bill.billingId}`, documentDate: data.date, amount: bill.outstanding / 100,
                    sourceModule: SourceModule.MANUAL, sourceTable: 'acc_nhis_opening_bills', sourceRef: `${id}:${bill.billingId}`, branchid: user.branch })), trx);
            }
            return { id: Number(id), amount: cohort.amount, billCount: cohort.billCount, reference: data.reference, alreadyApplied: false };
        }, String(db.client.config.client).includes('mysql') ? { isolationLevel: 'repeatable read' } : {});
    }
    private replay(previous: any, fingerprint: string) {
        if (previous.fingerprint !== fingerprint) throw new AccountingError('Opening request key was already used with different details', 'NHIS_REQUEST_CONFLICT', 409);
        return { id: Number(previous.id), amount: Number(previous.amount), billCount: Number(previous.bill_count), reference: previous.reference, alreadyApplied: true };
    }
    async reverse(user: AuthUser, id: number, input: unknown) {
        this.actor(user);
        const parsed = reverseSchema.safeParse(input);
        if (!parsed.success || !Number.isSafeInteger(id) || id <= 0) throw new AccountingError('A reversal reference, reason and request key are required', 'INVALID_NHIS_REVERSAL', 400);
        const data = parsed.data, db = await this.connection();
        const opening = await db('acc_nhis_openings').where({ id, branchid: user.branch }).first();
        if (!opening) throw new AccountingError('Opening import not found in your branch', 'NHIS_OPENING_NOT_FOUND', 404);
        await this.authority(user, 'accounting.financial_correction.execute', Number(opening.amount));
        const fingerprint = hash({ ...data, id, branch: user.branch, employeeid: user.employeeid });
        return db.transaction(async trx => {
            const prior = await trx('acc_nhis_opening_reversals').where('opening_id', id).first();
            if (prior) {
                if (prior.fingerprint !== fingerprint) throw new AccountingError('This opening import is already reversed', 'NHIS_ALREADY_REVERSED', 409);
                return { id, reversed: true, alreadyApplied: true };
            }
            const date = new Date().toISOString().slice(0, 10);
            await this.lockDate(trx, user, date);
            const links = await trx('acc_nhis_opening_bills').where('opening_id', id).orderBy('billingid');
            for (const link of links) {
                const bill = await trx('billing').where({ billingid: link.billingid, branchid: user.branch }).forUpdate().first();
                const movements = await trx('acc_nhis_allocations').where('billingid', link.billingid).sum({ amount: 'amount' }).first();
                if (!bill || minorUnits(bill.outstanding) !== minorUnits(link.amount) || minorUnits(movements?.amount || 0) !== 0)
                    throw new AccountingError('Reverse subsequent settlements or bill changes before reversing the opening import', 'NHIS_OPENING_HAS_MOVEMENTS', 409);
            }
            await trx('acc_nhis_openings').where('id', id).forUpdate().first();
            const raced = await trx('acc_nhis_opening_reversals').where('opening_id', id).forUpdate().first();
            if (raced) {
                if (raced.fingerprint === fingerprint) return { id, reversed: true, alreadyApplied: true };
                throw new AccountingError('This opening import is already reversed', 'NHIS_ALREADY_REVERSED', 409);
            }
            await trx('acc_nhis_opening_reversals').insert({ opening_id: id, request_key: data.requestKey, fingerprint, reversal_date: date,
                reference: data.reference, reason: data.reason, created_by: user.employeeid, created_at: new Date() });
            const accounting = createAccountingService(this.tenantId);
            for (const journalId of [...new Set(links.map(link => Number(link.journal_entry_id)))]) {
                const original = await trx('acc_journal_entries').where('id', journalId).forUpdate().first();
                if (original?.status !== 'posted') throw new AccountingError('Opening journal requires reconciliation before reversal', 'NHIS_OPENING_JOURNAL_CHANGED', 409);
                const batch = links.filter(link => Number(link.journal_entry_id) === journalId);
                await accounting.postTransaction({ tenantId: this.tenantId, trx, transactionType: TransactionType.REVERSAL, sourceModule: SourceModule.MANUAL,
                    sourceTable: 'acc_nhis_openings', sourcePk: id, sourceRef: original.source_ref || '', reversalOfEntryId: journalId,
                    description: `NHIS opening reversal: ${data.reference}`, occurredAt: date, createdBy: user.employeeid,
                    lines: [...batch.map(link => ({ accountCode: 'acc-1002', direction: NormalBalance.CREDIT, amount: Number(link.amount), branchid: user.branch,
                        billingid: Number(link.billingid), employeeid: user.employeeid, partyType: 'nhis', partyRef: '1', partyName: 'National Health Insurance Scheme (NHIS)', documentRef: `BILL-${link.billingid}` })),
                        { accountCode: opening.offset_account_code, direction: NormalBalance.DEBIT, amount: batch.reduce((sum, link) => sum + minorUnits(link.amount), 0) / 100, branchid: user.branch, employeeid: user.employeeid }] });
                await trx('acc_journal_entries').where('id', journalId).update({ status: 'reversed' });
            }
            await new SubledgerService(this.tenantId).recordMany(links.map(link => ({ ledger: 'AR', partyType: 'nhis', partyId: 1, partyName: 'National Health Insurance Scheme (NHIS)',
                documentType: 'adjustment', documentRef: `BILL-${link.billingid}`, documentDate: date, amount: -Number(link.amount), sourceModule: SourceModule.MANUAL,
                sourceTable: 'acc_nhis_opening_reversals', sourceRef: `${id}:${link.billingid}`, branchid: user.branch })), trx);
            return { id, reversed: true, alreadyApplied: false };
        });
    }
    async history(user: AuthUser) {
        this.actor(user); const db = await this.connection();
        const rows = await db('acc_nhis_openings as o').leftJoin('acc_nhis_opening_reversals as r', 'r.opening_id', 'o.id')
            .where('o.branchid', user.branch).select('o.id', 'o.reference', 'o.amount', 'o.bill_count', 'o.opening_date', 'r.id as reversalId').orderBy('o.id', 'desc').limit(50);
        return rows;
    }
}
function nextDate(value: string) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
