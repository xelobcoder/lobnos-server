import { createHash } from 'crypto';
import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';
import { AccountingError } from '../errors/AccountingErrors';
import { AuthorityDecision } from '../interfaces/IAuthorityService';
import {
     FinancialCloseActionInput,
     FinancialDayCloseStatus,
     IFinancialDayCloseService,
     ManagerCloseDecisionInput,
} from '../interfaces/IFinancialDayCloseService';
import { parsePaging } from '../utils/pagination';
import { AuthorityService, OWNER_ONLY_ROLES } from './AuthorityService';
import { isSuperAdminRole, roleAllowed } from '../../middleware/roles';
import { FinancialPinVerificationService } from './FinancialPinVerificationService';
import { FinancialSnapshotService } from './FinancialSnapshotService';

const CLOSE_TRANSITIONS: Record<FinancialDayCloseStatus, FinancialDayCloseStatus[]> = {
     draft: ['accountant_submitted'],
     returned_to_accountant: ['accountant_submitted'],
     accountant_submitted: ['manager_approved', 'returned_to_accountant'],
     manager_approved: ['finalized'],
     finalized: [],
};

export function canTransitionFinancialDay(from: FinancialDayCloseStatus, to: FinancialDayCloseStatus): boolean {
     return CLOSE_TRANSITIONS[from]?.includes(to) || false;
}

export class FinancialDayCloseService implements IFinancialDayCloseService {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: any) { }

     async submit(actor: AuthUser, branchId: number, financialDate: string, input: FinancialCloseActionInput): Promise<any> {
          this.assertActorBranch(actor, branchId);
          const authority = await this.submitAuthority(actor, branchId);
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               await this.verifyPin(trx, actor, input, 'daily_close_accountant_submit', `${branchId}:${financialDate}`);
               await trx('financial_day_closures').insert({
                    branchid: branchId, financial_date: financialDate, timezone: this.timezone(input.timezone), status: 'draft', workflow_version: 0,
                    created_by: actor.employeeid, created_at: new Date(), updated_at: new Date(),
               }).onConflict(['branchid', 'financial_date']).ignore();
               const closure = await trx('financial_day_closures').where({ branchid: branchId, financial_date: financialDate }).forUpdate().first();
               if (!closure) throw new AccountingError('Unable to create financial day close', 'DAILY_CLOSE_CREATE_FAILED', 500);
               if (!canTransitionFinancialDay(closure.status, 'accountant_submitted')) throw new AccountingError(`Financial day is ${closure.status}`, 'INVALID_DAILY_CLOSE_TRANSITION', 409);
               this.assertVersion(closure, input.expectedVersion);
               const snapshot = await new FinancialSnapshotService(this.tenantId, trx).create(branchId, financialDate);
               this.assertReconciled(snapshot);
               const version = Number(closure.workflow_version || 0) + 1;
               await this.insertSnapshot(trx, closure.id, 'accountant_submitted', version, actor.employeeid, snapshot);
               await trx('financial_day_closures').where({ id: closure.id }).update({
                    status: 'accountant_submitted', workflow_version: version, accountant_employeeid: actor.employeeid,
                    accountant_submitted_at: new Date(), manager_employeeid: null, manager_decided_at: null, owner_employeeid: null,
                    finalized_at: null, locked_at: null, return_reason: null, latest_snapshot_hash: snapshot.hash,
                    timezone: this.timezone(input.timezone || closure.timezone), updated_by: actor.employeeid, updated_at: new Date(),
               });
               await this.insertAction(trx, closure, actor, authority, 'accountant_submitted', 'accountant_submitted', version, input.notes, snapshot.hash);
               return this.detailIn(trx, closure.id);
          });
     }

     async managerDecision(actor: AuthUser, closureId: number, input: ManagerCloseDecisionInput): Promise<any> {
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               const closure = await this.requireClosure(trx, closureId);
               this.assertActorBranch(actor, Number(closure.branchid));
               this.assertVersion(closure, input.expectedVersion);
               const nextStatus = input.decision === 'reject' ? 'returned_to_accountant' : 'manager_approved';
               if (!canTransitionFinancialDay(closure.status, nextStatus)) throw new AccountingError(`Financial day is ${closure.status}`, 'INVALID_DAILY_CLOSE_TRANSITION', 409);
               if (Number(closure.accountant_employeeid) === actor.employeeid) throw new AccountingError('The accountant cannot approve their own submission', 'SEGREGATION_OF_DUTIES', 403);
               const authority = await new AuthorityService(this.tenantId).can(actor.employeeid, 'accounting.daily_close.manager_approve', null, Number(closure.branchid));
               if (!authority.allowed) throw new AccountingError(authority.reason, 'DAILY_CLOSE_AUTHORITY_DENIED', 403);
               await this.verifyPin(trx, actor, input, 'daily_close_manager_decision', String(closureId));
               const version = Number(closure.workflow_version) + 1;
               if (input.decision === 'reject') {
                    const reason = String(input.reason || '').trim();
                    if (reason.length < 3) throw new AccountingError('A return reason is required', 'DAILY_CLOSE_REASON_REQUIRED', 400);
                    await trx('financial_day_closures').where({ id: closureId }).update({ status: 'returned_to_accountant', workflow_version: version, manager_employeeid: actor.employeeid, manager_decided_at: new Date(), return_reason: reason, updated_by: actor.employeeid, updated_at: new Date() });
                    await this.insertAction(trx, closure, actor, authority, 'manager_rejected', 'returned_to_accountant', version, reason, closure.latest_snapshot_hash);
                    return this.detailIn(trx, closureId);
               }
               const snapshot = await new FinancialSnapshotService(this.tenantId, trx).create(Number(closure.branchid), this.dateOnly(closure.financial_date));
               this.assertReconciled(snapshot);
               this.assertSnapshotUnchanged(closure.latest_snapshot_hash, snapshot.hash);
               await this.insertSnapshot(trx, closure.id, 'manager_approved', version, actor.employeeid, snapshot);
               await trx('financial_day_closures').where({ id: closureId }).update({ status: 'manager_approved', workflow_version: version, manager_employeeid: actor.employeeid, manager_decided_at: new Date(), return_reason: null, latest_snapshot_hash: snapshot.hash, updated_by: actor.employeeid, updated_at: new Date() });
               await this.insertAction(trx, closure, actor, authority, 'manager_approved', 'manager_approved', version, input.notes, snapshot.hash);
               return this.detailIn(trx, closureId);
          });
     }

     async finalize(actor: AuthUser, closureId: number, input: FinancialCloseActionInput): Promise<any> {
          if (!roleAllowed(this.role(actor), OWNER_ONLY_ROLES)) throw new AccountingError('Only a facility owner may finalize a financial day', 'OWNER_REQUIRED', 403);
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               const closure = await this.requireClosure(trx, closureId);
               this.assertActorBranch(actor, Number(closure.branchid));
               this.assertVersion(closure, input.expectedVersion);
               if (!canTransitionFinancialDay(closure.status, 'finalized')) throw new AccountingError(`Financial day is ${closure.status}`, 'INVALID_DAILY_CLOSE_TRANSITION', 409);
               if ([closure.accountant_employeeid, closure.manager_employeeid].map(Number).includes(actor.employeeid)) throw new AccountingError('Facility Owner must be different from the Accountant and Finance Manager', 'SEGREGATION_OF_DUTIES', 403);
               const authority = await new AuthorityService(this.tenantId).can(actor.employeeid, 'accounting.daily_close.finalize', null, Number(closure.branchid));
               if (!authority.allowed) throw new AccountingError(authority.reason, 'DAILY_CLOSE_AUTHORITY_DENIED', 403);
               await this.verifyPin(trx, actor, input, 'daily_close_owner_finalize', String(closureId));
               const financialDate = this.dateOnly(closure.financial_date);
               const snapshot = await new FinancialSnapshotService(this.tenantId, trx).create(Number(closure.branchid), financialDate);
               this.assertReconciled(snapshot);
               this.assertSnapshotUnchanged(closure.latest_snapshot_hash, snapshot.hash);
               const version = Number(closure.workflow_version) + 1;
               await this.insertSnapshot(trx, closure.id, 'finalized', version, actor.employeeid, snapshot);
               await this.createRecordManifest(trx, closure.id, Number(closure.branchid), financialDate);
               await trx('billing').where({ branchid: closure.branchid }).whereRaw('DATE(billedon) = ?', [financialDate]).update({ islocked: 1, record_validated_and_signed_off: 1, record_validated_and_signed_off_by: actor.employeeid });
               await trx('dboservices').where({ branchid: closure.branchid }).whereRaw('DATE(serviceAddedOn) = ?', [financialDate]).update({ isLocked: 1 });
               const now = new Date();
               await trx('financial_day_closures').where({ id: closureId }).update({ status: 'finalized', workflow_version: version, owner_employeeid: actor.employeeid, finalized_at: now, locked_at: now, latest_snapshot_hash: snapshot.hash, finalized_hash: snapshot.hash, updated_by: actor.employeeid, updated_at: now });
               await this.insertAction(trx, closure, actor, authority, 'owner_finalized', 'finalized', version, input.notes, snapshot.hash);
               return this.detailIn(trx, closureId);
          });
     }

     async list(filters: { branchId?: number; from?: string; to?: string; status?: FinancialDayCloseStatus; page?: number; count?: number } = {}): Promise<any> {
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          const paging = parsePaging(filters, 25);
          const base = db('financial_day_closures as closure');
          if (filters.branchId) base.where('closure.branchid', filters.branchId);
          if (filters.from) base.where('closure.financial_date', '>=', filters.from);
          if (filters.to) base.where('closure.financial_date', '<=', filters.to);
          if (filters.status) base.where('closure.status', filters.status);
          const totalRow = await base.clone().clearSelect().clearOrder().count('* as total').first();
          const data = await base.clone().select('closure.*').orderBy('closure.financial_date', 'desc').orderBy('closure.id', 'desc').limit(paging.count).offset(paging.offset);
          return { data, total: Number(totalRow?.total || 0), page: paging.page, count: paging.count };
     }

     async detail(actor: AuthUser, closureId: number): Promise<any> {
          const authority = await new AuthorityService(this.tenantId).can(actor.employeeid, 'accounting.daily_close.view_audit', null, actor.branch);
          if (!authority.allowed) throw new AccountingError(authority.reason, 'DAILY_CLOSE_AUTHORITY_DENIED', 403);
          const db = this.connectionOverride || await KnexConnection(this.tenantId);
          return this.detailIn(db, closureId);
     }

     private async detailIn(db: any, closureId: number): Promise<any> {
          const closure = await db('financial_day_closures').where({ id: closureId }).first();
          if (!closure) throw new AccountingError('Financial day close not found', 'DAILY_CLOSE_NOT_FOUND', 404);
          const [actions, snapshots, lockCount] = await Promise.all([
               db('financial_day_close_actions').where({ closure_id: closureId }).orderBy('action_at'),
               db('financial_day_close_snapshots').where({ closure_id: closureId }).orderBy('workflow_version'),
               db('financial_record_locks').where({ closure_id: closureId }).count('* as count').first(),
          ]);
          return { closure, actions, snapshots, lockedRecords: Number(lockCount?.count || 0) };
     }

     private async requireClosure(trx: any, closureId: number): Promise<any> {
          const closure = await trx('financial_day_closures').where({ id: closureId }).forUpdate().first();
          if (!closure) throw new AccountingError('Financial day close not found', 'DAILY_CLOSE_NOT_FOUND', 404);
          if (closure.status === 'finalized') throw new AccountingError('Financial day is finalized and immutable', 'FINANCIAL_DAY_FINALIZED', 409);
          return closure;
     }

     private async submitAuthority(actor: AuthUser, branchId: number): Promise<AuthorityDecision> {
          if (this.role(actor) === 'accountant') return { allowed: true, reason: 'Granted by accountant role', delegationId: null, source: 'role' };
          const decision = await new AuthorityService(this.tenantId).can(actor.employeeid, 'accounting.daily_close.submit', null, branchId);
          if (!decision.allowed) throw new AccountingError(decision.reason, 'DAILY_CLOSE_AUTHORITY_DENIED', 403);
          return decision;
     }

     private async verifyPin(trx: any, actor: AuthUser, input: FinancialCloseActionInput, purpose: string, resourceId: string): Promise<void> {
          await new FinancialPinVerificationService(this.tenantId).verify(actor, input.pin, {
               purpose, resourceType: 'financial_day_close', resourceId,
               ipAddress: input.requestContext?.ipAddress, userAgent: input.requestContext?.userAgent, requestId: input.requestContext?.requestId,
          });
     }

     private assertActorBranch(actor: AuthUser, branchId: number): void {
          if (!Number.isInteger(branchId) || branchId <= 0) throw new AccountingError('Valid branch ID is required', 'INVALID_BRANCH', 400);
          if (!isSuperAdminRole(actor.role) && (actor.branch === null || Number(actor.branch) !== branchId)) throw new AccountingError('Financial day authority is restricted to your branch', 'BRANCH_SCOPE_DENIED', 403);
     }

     private assertVersion(closure: any, expectedVersion?: number): void {
          if (expectedVersion !== undefined && Number(expectedVersion) !== Number(closure.workflow_version)) throw new AccountingError('Financial day was changed by another user; reload and try again', 'STALE_DAILY_CLOSE', 409);
     }

     private assertReconciled(snapshot: any): void {
          if (snapshot.discrepancies.length) throw new AccountingError(snapshot.discrepancies.map((item: any) => item.message).join('; '), 'FINANCIAL_DAY_NOT_RECONCILED', 409);
     }

     private assertSnapshotUnchanged(expected: string, actual: string): void {
          if (!expected || expected !== actual) throw new AccountingError('Financial records changed after the previous authorization; Accountant resubmission is required', 'FINANCIAL_DAY_SNAPSHOT_CHANGED', 409);
     }

     private timezone(value?: string): string {
          const timezone = String(value || 'UTC').trim();
          try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { throw new AccountingError('A valid IANA timezone is required', 'INVALID_TIMEZONE', 400); }
          return timezone;
     }

     private dateOnly(value: Date | string): string {
          if (typeof value === 'string') return value.slice(0, 10);
          return value.toISOString().slice(0, 10);
     }

     private role(actor: AuthUser): string { return String(actor.role || '').toLowerCase().trim(); }

     private async insertSnapshot(trx: any, closureId: number, stage: string, version: number, actorId: number, snapshot: any): Promise<void> {
          await trx('financial_day_close_snapshots').insert({ closure_id: closureId, stage, workflow_version: version, totals_json: JSON.stringify(snapshot.totals), discrepancies_json: JSON.stringify(snapshot.discrepancies), record_counts_json: JSON.stringify(snapshot.recordCounts), outbox_pending: snapshot.outboxPending, outbox_failed: snapshot.outboxFailed, ledger_debits: snapshot.ledgerDebits, ledger_credits: snapshot.ledgerCredits, snapshot_hash: snapshot.hash, created_by: actorId, created_at: new Date() });
     }

     private async insertAction(trx: any, closure: any, actor: AuthUser, authority: AuthorityDecision, action: string, toStatus: string, version: number, reason?: string, snapshotHash?: string): Promise<void> {
          await trx('financial_day_close_actions').insert({ closure_id: closure.id, action, from_status: closure.status, to_status: toStatus, actor_employeeid: actor.employeeid, actor_role: actor.role, actor_branchid: actor.branch, permission: action.startsWith('accountant') ? 'accounting.daily_close.submit' : action.startsWith('manager') ? 'accounting.daily_close.manager_approve' : 'accounting.daily_close.finalize', authority_source: authority.source, authority_delegation_id: authority.delegationId, result: 'succeeded', reason: reason?.trim() || null, snapshot_hash: snapshotHash || null, workflow_version: version, metadata_json: JSON.stringify({ tenantId: actor.tenantId }), action_at: new Date() });
     }

     private async createRecordManifest(trx: any, closureId: number, branchId: number, financialDate: string): Promise<void> {
          const sources = [
               { module: 'billing', table: 'billing', key: 'billingid', query: trx('billing').where({ branchid: branchId }).whereRaw('DATE(billedon) = ?', [financialDate]) },
               { module: 'billing', table: 'dboservices', key: 'serviceid', query: trx('dboservices').where({ branchid: branchId }).whereRaw('DATE(serviceAddedOn) = ?', [financialDate]) },
               { module: 'billing', table: 'billinghx', key: 'KeyID', query: trx('billinghx as row').join('billing as bill', 'bill.billingid', 'row.Billingid').where('bill.branchid', branchId).whereRaw('DATE(row.Date) = ?', [financialDate]).select('row.*') },
               { module: 'expense', table: 'expensesrecord', key: 'id', query: trx('expensesrecord').where({ branchid: branchId }).whereRaw('DATE(date) = ?', [financialDate]) },
               { module: 'expense', table: 'expense_payments', key: 'id', query: trx('expense_payments').where({ branchid: branchId }).whereRaw('DATE(payment_date) = ?', [financialDate]) },
               { module: 'billing', table: 'receipts', key: 'id', query: trx('receipts as row').join('billing as bill', 'bill.billingid', 'row.billingid').where('bill.branchid', branchId).whereRaw('DATE(row.generated_at) = ?', [financialDate]).select('row.*') },
               { module: 'billing', table: 'dbobillingrefundtable', key: 'refundid', query: trx('dbobillingrefundtable as row').join('dboservices as service', 'service.serviceid', 'row.serviceid').where('service.branchid', branchId).whereRaw('DATE(row.approvalDate) = ?', [financialDate]).select('row.*') },
               { module: 'accounting', table: 'acc_journal_entries', key: 'id', query: trx('acc_journal_entries as row').whereRaw('DATE(row.occurred_at) = ?', [financialDate]).whereExists(function (this: Knex.QueryBuilder) { this.select(trx.raw('1')).from('acc_journal_lines as line').whereRaw('line.journal_entry_id = row.id').where('line.branchid', branchId); }).select('row.*') },
               { module: 'accounting', table: 'acc_journal_lines', key: 'id', query: trx('acc_journal_lines as row').join('acc_journal_entries as entry', 'entry.id', 'row.journal_entry_id').where('row.branchid', branchId).whereRaw('DATE(entry.occurred_at) = ?', [financialDate]).select('row.*') },
               { module: 'accounting', table: 'acc_manual_journals', key: 'id', query: trx('acc_manual_journals as row').whereRaw('DATE(row.journal_date) = ?', [financialDate]).whereExists(function (this: Knex.QueryBuilder) { this.select(trx.raw('1')).from('acc_manual_journal_lines as line').whereRaw('line.manual_journal_id = row.id').where('line.branchid', branchId); }).select('row.*') },
               { module: 'accounting', table: 'acc_manual_journal_lines', key: 'id', query: trx('acc_manual_journal_lines as row').join('acc_manual_journals as journal', 'journal.id', 'row.manual_journal_id').where('row.branchid', branchId).whereRaw('DATE(journal.journal_date) = ?', [financialDate]).select('row.*') },
               { module: 'accounting', table: 'acc_subledger_entries', key: 'id', query: trx('acc_subledger_entries').where({ branchid: branchId, document_date: financialDate }) },
               { module: 'accounting', table: 'finance_ledger', key: 'id', query: trx('finance_ledger').where({ branchid: branchId }).whereRaw('DATE(occurred_at) = ?', [financialDate]) },
          ];
          for (const source of sources) {
               const rows = await source.query;
               for (const row of rows) {
                    const identity = JSON.stringify({ [source.key]: row[source.key] });
                    await trx('financial_record_locks').insert({ closure_id: closureId, branchid: branchId, financial_date: financialDate, source_module: source.module, source_table: source.table, source_ref: String(row[source.key]), source_pk_json: identity, source_identity_hash: this.hash(`${source.table}:${identity}`), content_hash: this.hash(this.stableJson(row)), locked_at: new Date() }).onConflict(['source_module', 'source_table', 'source_identity_hash']).ignore();
               }
          }
     }

     private hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
     private stableJson(value: any): string {
          if (Array.isArray(value)) return `[${value.map((item) => this.stableJson(item)).join(',')}]`;
          if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${this.stableJson(value[key])}`).join(',')}}`;
          return JSON.stringify(value);
     }
}
