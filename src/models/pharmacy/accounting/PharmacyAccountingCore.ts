import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import { Knex } from 'knex';
import { roleAllowed } from '../../../middleware/roles';
import { money } from '../PharmacyRules';
import { dateOnly, json } from '../PharmacyEnterpriseCore';
import { AccountingPeriodService } from '../../../accountingModule/services/AccountingPeriodService';

export class PharmacyAccountingError extends Error {
     constructor(message: string, public code = 'INVALID_REQUEST', public status = 400) { super(message); }
}
export const fail = (message: string, code = 'INVALID_REQUEST', status = 400): never => { throw new PharmacyAccountingError(message, code, status); };
export interface AccountingContext { tenantId: number; branch: number; actor: number; role: string }
export function positiveId(value: any, label = 'identifier'): number {
     const n = Number(value); if (!Number.isSafeInteger(n) || n <= 0) fail(`Invalid ${label}`); return n;
}
export function accountingDate(value: any): string {
     try { return dateOnly(value); } catch { return fail('Use a valid YYYY-MM-DD financial date'); }
}
export function text(value: any, label: string, max = 500): string {
     if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > max) fail(`Enter ${label} (3-${max} characters)`);
     return value.trim();
}
/** No implicit rounding of user-entered money; exact Decimal arithmetic until persistence. */
export function amount(value: any, signed = false, zero = false): string {
     if (!['string', 'number'].includes(typeof value) || (typeof value === 'string' && !/^-?\d+(\.\d{1,2})?$/.test(value))) fail('Enter an amount with at most two decimal places');
     const d = new Decimal(value);
     if (!d.isFinite() || d.abs().gt('999999999999.99') || !d.eq(d.toDecimalPlaces(2)) || (!signed && d.lt(0)) || (!zero && d.isZero())) fail('Invalid monetary amount');
     return d.toFixed(2);
}
export function stableHash(value: any): string {
     const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
          ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
     return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function assertVersion(row: any, input: any): void {
     if (!Number.isInteger(input.expectedVersion) || input.expectedVersion !== Number(row.version)) fail('Document changed; reload before continuing', 'VERSION_CONFLICT', 409);
}
export function assertTransition(row: any, action: string, actor: number): string {
     const transitions: Record<string, Record<string, string>> = {
          submit: { draft: 'submitted' }, approve: { submitted: 'approved' }, post: { approved: 'posted' },
          void: { draft: 'voided', submitted: 'voided' }, reverse: { posted: 'reversed', approved: 'reversed', partially_paid: 'reversed', paid: 'reversed' },
          pay: { approved: 'partially_paid', partially_paid: 'partially_paid' },
     };
     const next = transitions[action]?.[row.status];
     if (!next) fail(`Cannot ${action} a ${row.status} document`, 'INVALID_STATE', 409);
     if (action === 'approve' && (Number(row.created_by) === actor || Number(row.submitted_by) === actor)) fail('Creator and submitter cannot approve their own document', 'APPROVAL_SEPARATION', 403);
     return next;
}
export const journalNumbers = (lines: any[]) => lines.map(l => ({ account: l.account, debit: money(l.debit || 0), credit: money(l.credit || 0) }));
export function journalLines(input: any): Array<{ account: string; debit: string; credit: string }> {
     if (!Array.isArray(input) || input.length < 2 || input.length > 100) fail('A journal requires 2-100 lines');
     const lines = input.map(l => {
          if (!l || typeof l.account !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(l.account)) fail('Invalid local account code');
          const debit = amount(l.debit ?? 0, false, true), credit = amount(l.credit ?? 0, false, true);
          if (new Decimal(debit).gt(0) === new Decimal(credit).gt(0)) fail('Each line must have exactly one positive debit or credit');
          return { account: l.account, debit, credit };
     });
     const total = lines.reduce((s, l) => s.plus(l.debit).minus(l.credit), new Decimal(0));
     if (!total.isZero()) fail('Journal debits and credits must balance');
     return lines;
}
export class PharmacyAccountingCore {
     constructor(readonly db: Knex, readonly context: AccountingContext) {
          positiveId(context.tenantId, 'authenticated tenant'); positiveId(context.branch, 'authenticated branch'); positiveId(context.actor, 'authenticated employee');
          if (!roleAllowed(context.role, ['admin', 'pharmacy_manager', 'pharmacy_accountant'])) fail('Pharmacy finance authority required', 'FORBIDDEN', 403);
     }
     async settingsLock(trx: Knex.Transaction): Promise<any> {
          await trx('pharmacy_accounting_settings').insert({ branchid: this.context.branch, tenant_id: this.context.tenantId, enabled: false, updated_by: this.context.actor })
               .onConflict('branchid').ignore();
          const row = await trx('pharmacy_accounting_settings').where({ branchid: this.context.branch }).forUpdate().first();
          if (Number(row.tenant_id) !== this.context.tenantId) fail('Accounting tenant configuration mismatch', 'TENANT_MISMATCH', 409);
          return { ...row, enabled: Boolean(row.enabled), mappings: json(row.mappings) };
     }
     async atomic(input: any, operation: string, work: (trx: Knex.Transaction, settings: any) => Promise<any>): Promise<any> {
          if (!input || typeof input.idempotencyKey !== 'string' || !/^[A-Za-z0-9:_-]{8,128}$/.test(input.idempotencyKey)) fail('A valid idempotencyKey (8-128 characters) is required');
          const { idempotencyKey, ...payload } = input;
          const hash = stableHash({ operation, payload, ...this.context });
          // Settings is also a branch mutation mutex. It makes concurrent absent-key retries safe.
          for (let attempt = 0; ; attempt++) {
               try {
                    return await this.db.transaction(async trx => {
                         const settings = await this.settingsLock(trx);
                         const key = { branchid: this.context.branch, request_key: idempotencyKey };
                         const prior = await trx('pharmacy_accounting_requests').where(key).forUpdate().first();
                         if (prior) {
                              if (prior.request_hash !== hash || Number(prior.actor_id) !== this.context.actor) fail('Idempotency key was used for a different request', 'IDEMPOTENCY_CONFLICT', 409);
                              return json(prior.response);
                         }
                         const result = await work(trx, settings);
                         await trx('pharmacy_accounting_requests').insert({ ...key, request_hash: hash, actor_id: this.context.actor, response: JSON.stringify(result) });
                         return result;
                    });
               } catch (e: any) {
                    if (attempt < 2 && ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(e.code)) continue;
                    throw e;
               }
          }
     }
     async audit(trx: Knex.Transaction, action: string, entity: string, before: any, after: any): Promise<void> {
          await trx('pharmacy_accounting_audit').insert({ branchid: this.context.branch, actor_id: this.context.actor, action, entity_id: entity, before_state: before == null ? null : JSON.stringify(before), after_state: JSON.stringify(after) });
     }
     async document(trx: Knex.Transaction, id: string, kind: string): Promise<any> {
          const row = await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch, kind }).forUpdate().first();
          if (!row) fail('Document not found in this branch', 'NOT_FOUND', 404);
          return { ...row, details: json(row.details) };
     }
     async postingAllowed(trx: Knex.Transaction, date: string): Promise<void> {
          const settings = await trx('pharmacy_accounting_settings').where({ branchid: this.context.branch }).first();
          if (settings?.enabled && (!settings.effective_date || date < accountingDate(settings.effective_date))) fail('Posting date precedes the configured pharmacy cutover; use the reviewed consolidation workflow', 'BEFORE_CUTOVER', 409);
          await new AccountingPeriodService(this.context.tenantId).assertPostingAllowed(date, trx);
     }
}
