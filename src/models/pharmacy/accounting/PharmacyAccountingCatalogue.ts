import { Knex } from 'knex';
import { PharmacyAccountingCore, accountingDate, fail, positiveId, text } from './PharmacyAccountingCore';
import { json } from '../PharmacyEnterpriseCore';

export const MAPPING_TYPES: Record<string, string> = {
     sales: 'revenue', inventory: 'asset', cost_of_sales: 'expense', operating_expenses: 'expense',
     opening_equity: 'equity', payable: 'liability', receivable: 'asset', cash: 'asset', bank: 'asset',
     mobile_money: 'asset', inventory_adjustments: 'expense', quarantine_inventory: 'asset',
     stock_in_transit: 'asset', inventory_in_transit: 'asset', supplier_returns_pending: 'asset',
     interbranch_receivable: 'asset', interbranch_payable: 'liability', 'liability:grni': 'liability',
};
export const accountFields = ['id', 'account_code', 'name', 'type', 'normal_balance', 'parent_account_id', 'is_active'];
export const CANONICAL_CONTROLS: Record<string, string> = { receivable: 'acc-1002', payable: 'acc-2000', supplier_payable: 'acc-2000', inventory: 'acc-1003', cost_of_sales: 'acc-5000', cash: 'acc-1000', bank: 'acc-1001', mobile_money: 'acc-1001' };
/** Shared specialized reports currently depend on these controls; never silently misclassify them. */
export async function assertCanonicalControls(db: Knex | Knex.Transaction, branch: number, mappings: Record<string, string>): Promise<void> {
     for (const [local, code] of Object.entries(mappings)) {
          if (local === 'liability:grni' && (code === CANONICAL_CONTROLS.payable || code === mappings.payable || code === mappings.supplier_payable))
               fail('Goods received not invoiced requires its own liability control account, separate from supplier payables', 'GRNI_CONTROL_REQUIRED', 422);
          let category = local.startsWith('receivable:') ? 'receivable' : local.startsWith('payable:') ? 'payable' : local;
          if (local.startsWith('collection:')) {
               const collection = await db('pharmacy_collection_accounts').where({ id: positiveId(local.slice(11)), branchid: branch }).forUpdate().first();
               if (!collection) fail('Collection mapping does not belong to this pharmacy branch');
               category = collection.account_type;
          }
          const canonical = CANONICAL_CONTROLS[category];
          if (canonical && code !== canonical) fail(`Mapping ${local} must use ${canonical}: shared AR/AP, inventory/COGS and cash reports currently require canonical controls. Custom core controls require a reviewed reporting-classification migration.`, 'CANONICAL_CONTROL_REQUIRED', 422);
     }
}
export function expectedMappingType(local: string): string | undefined {
     if (local === 'sales_returns' || local === 'sales_discounts') return 'revenue';
     if (local.startsWith('payable:') || local === 'supplier_payable') return 'liability';
     if (local.startsWith('receivable:') || local.startsWith('collection:')) return 'asset';
     for (const type of ['expense', 'revenue', 'asset', 'liability', 'equity']) if (local.startsWith(type + ':')) return type;
     return MAPPING_TYPES[local];
}
/** Same resolution contract as the bridge; exact code always wins over a category. */
export async function mappedAccount(db: Knex | Knex.Transaction, branch: number, mappings: any, local: string): Promise<any> {
     if (typeof local !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(local)) fail('Supply a valid classified local account code');
     if (!expectedMappingType(local)) fail('Use a classified local account code or a typed expense:/revenue:/asset:/liability:/equity: code');
     let category = local === 'supplier_payable' ? 'payable' : local;
     if (local.startsWith('collection:')) {
          const account = await db('pharmacy_collection_accounts').where({ id: positiveId(local.slice(11)), branchid: branch, is_active: true, currency: 'GHS' }).forUpdate().first();
          if (!account || !['cash', 'bank', 'mobile_money'].includes(account.account_type)) fail('Collection account is unavailable in this branch');
          category = account.account_type;
     } else if (local.startsWith('payable:')) {
          if (!await db('pharmacy_suppliers').where({ id: local.slice(8), branchid: branch }).forUpdate().first()) fail('Supplier account is not in this branch');
          category = 'payable';
     } else if (local.startsWith('receivable:')) {
          if (!await db('pharmacy_customer_accounts').where({ id: positiveId(local.slice(11)), branchid: branch }).forUpdate().first()) fail('Customer account is not in this branch');
          category = 'receivable';
     }
     const code = Object.prototype.hasOwnProperty.call(mappings, local) ? mappings[local] : mappings[category];
     if (!code) fail(`An explicit shared account mapping is required for ${local}`, 'MAPPING_REQUIRED', 409);
     const account = await db('acc_accounts').where({ account_code: code, is_active: true }).forUpdate().first();
     if (!account || (expectedMappingType(local) && account.type !== expectedMappingType(local))) fail(`The active account mapping for ${local} has an invalid type`);
     return account;
}
export class PharmacyAccountingCatalogue extends PharmacyAccountingCore {
     async settings(): Promise<any> {
          const row = await this.db('pharmacy_accounting_settings').where({ branchid: this.context.branch }).first();
          if (!row) return { branchid: this.context.branch, tenant_id: this.context.tenantId, enabled: false, effective_date: null, mappings: {}, updated_by: null, updated_at: null };
          if (Number(row.tenant_id) !== this.context.tenantId) fail('Accounting tenant configuration mismatch', 'TENANT_MISMATCH', 409);
          return { ...row, enabled: Boolean(row.enabled), mappings: json(row.mappings) };
     }
     async saveSettings(input: any): Promise<any> {
          return this.atomic(input, 'settings:update', async (trx, previous) => {
               if (typeof input.enabled !== 'boolean') fail('enabled must be a boolean');
               if (!input.mappings || typeof input.mappings !== 'object' || Array.isArray(input.mappings)) fail('Provide explicit mappings');
               const mappings: Record<string, string> = {};
               if (Object.keys(input.mappings).length > 500) fail('Too many account mappings');
               for (const [local, code] of Object.entries(input.mappings)) {
                    if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(local) || ['constructor', 'prototype', '__proto__'].includes(local) || typeof code !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,19}$/.test(code)) fail('Invalid mapping code');
                    if (!expectedMappingType(local)) fail(`Unclassified local mapping ${local}; use a supported category or typed local code`);
                    const account = await trx('acc_accounts').where({ account_code: code, is_active: true }).forUpdate().first();
                    if (!account || (expectedMappingType(local) && account.type !== expectedMappingType(local))) fail(`Mapping ${local} requires an active ${expectedMappingType(local) || 'shared'} account`);
                    // Validate branch ownership even when an exact override is supplied.
                    await mappedAccount(trx, this.context.branch, { [local]: code }, local);
                    mappings[local] = String(code);
               }
               const effectiveDate = input.effective_date == null ? null : accountingDate(input.effective_date);
               if (input.enabled && !effectiveDate) fail('Enabling accounting requires effective_date');
               if (input.enabled) for (const category of Object.keys(MAPPING_TYPES)) {
                    if (!mappings[category]) fail(`Enabling accounting requires an explicit ${category} mapping`);
               }
               if (input.enabled) await assertCanonicalControls(trx, this.context.branch, mappings);
               const linked = await trx('pharmacy_accounting_posting_links').where({ branchid: this.context.branch }).first();
               if (linked) {
                    const oldDate = previous.effective_date == null ? null : accountingDate(previous.effective_date);
                    if (effectiveDate !== oldDate || !input.enabled) fail('Posted accounting cutover cannot be disabled or redated', 'HISTORY_PROTECTED', 409);
                    for (const [local, code] of Object.entries(previous.mappings)) if (mappings[local] !== code) fail('Historical mappings cannot be removed or reassigned; use a reviewed migration', 'HISTORY_PROTECTED', 409);
                    for (const local of Object.keys(mappings).filter(k => !Object.prototype.hasOwnProperty.call(previous.mappings, k))) {
                         const history = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where({ 'j.branchid': this.context.branch, 'l.account_code': local }).first();
                         if (history) fail('A new exact mapping cannot override the category mapping of a historical local account', 'HISTORY_PROTECTED', 409);
                    }
               }
               const next = { enabled: input.enabled, effective_date: effectiveDate, mappings, tenant_id: this.context.tenantId, branchid: this.context.branch, updated_by: this.context.actor, updated_at: new Date() };
               await trx('pharmacy_accounting_settings').where({ branchid: this.context.branch }).update({ ...next, mappings: JSON.stringify(mappings) });
               await this.audit(trx, 'settings:update', String(this.context.branch), previous, next);
               return next;
          });
     }
     async accounts(): Promise<any> {
          const [settings, sharedAccounts, owned] = await Promise.all([
               this.settings(), this.db('acc_accounts').select(accountFields).orderBy('account_code'),
               this.db('pharmacy_accounting_owned_accounts').where({ branchid: this.context.branch }),
          ]);
          const rows = sharedAccounts.map(a => ({ ...a, is_active: Boolean(a.is_active), local_codes: Object.keys(settings.mappings).filter(k => settings.mappings[k] === a.account_code) }));
          return { items: rows.filter(a => a.local_codes.length || owned.some(o => Number(o.account_id) === Number(a.id))), sharedAccounts: rows };
     }
     private async parent(trx: Knex.Transaction, parentId: any, type: string, self?: number): Promise<number | null> {
          if (parentId == null) return null;
          let id = positiveId(parentId, 'parent account');
          const root = id, visited = new Set<number>(self ? [self] : []);
          while (id) {
               if (visited.has(id)) fail('Account hierarchy contains a cycle');
               visited.add(id);
               const parent = await trx('acc_accounts').where({ id }).forUpdate().first();
               if (!parent || !parent.is_active || parent.type !== type) fail('Parent must be an active account of the same type');
               id = parent.parent_account_id == null ? 0 : Number(parent.parent_account_id);
               if (visited.size > 100) fail('Account hierarchy is too deep');
          }
          return root;
     }
     async createAccount(input: any): Promise<any> {
          return this.atomic(input, 'accounts:create', async (trx, settings) => {
               if (typeof input.accountCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,19}$/.test(input.accountCode)) fail('accountCode must be 1-20 characters');
               if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(input.type) || !['debit', 'credit'].includes(input.normalBalance)) fail('Invalid account type or normalBalance');
               if (await trx('acc_accounts').where({ account_code: input.accountCode }).forUpdate().first()) fail('Account code already exists; assign it through settings', 'ACCOUNT_EXISTS', 409);
               const parentId = await this.parent(trx, input.parentAccountId, input.type);
               const values = { account_code: input.accountCode, name: text(input.name, 'account name', 120), type: input.type, normal_balance: input.normalBalance, parent_account_id: parentId, is_active: true };
               const [id] = await trx('acc_accounts').insert(values);
               await trx('pharmacy_accounting_owned_accounts').insert({ account_id: id, branchid: this.context.branch, created_by: this.context.actor });
               if (input.localCode !== undefined) {
                    if (typeof input.localCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(input.localCode) || ['constructor', 'prototype', '__proto__'].includes(input.localCode)) fail('Invalid localCode');
                    if (settings.mappings[input.localCode]) fail('Local code already has an assignment');
                    await mappedAccount(trx, this.context.branch, { [input.localCode]: input.accountCode }, input.localCode);
                    if (settings.enabled) await assertCanonicalControls(trx, this.context.branch, { [input.localCode]: input.accountCode });
                    await trx('pharmacy_accounting_settings').where({ branchid: this.context.branch }).update({ mappings: JSON.stringify({ ...settings.mappings, [input.localCode]: input.accountCode }), updated_by: this.context.actor, updated_at: new Date() });
               }
               const result = { id, ...values, local_codes: input.localCode ? [input.localCode] : [] };
               await this.audit(trx, 'accounts:create', String(id), null, result); return result;
          });
     }
     async updateAccount(id: number, input: any): Promise<any> {
          return this.atomic(input, `accounts:update:${id}`, async (trx, settings) => {
               const row = await trx('acc_accounts').where({ id }).forUpdate().first();
               if (!row) fail('Account not found', 'NOT_FOUND', 404);
               const assigned = Object.values(settings.mappings).includes(row.account_code);
               const owned = await trx('pharmacy_accounting_owned_accounts').where({ account_id: id, branchid: this.context.branch }).first();
               if (!assigned && !owned) fail('This facility account is not assigned to pharmacy', 'FORBIDDEN', 403);
               const allowed = ['idempotencyKey', 'name', 'isActive', 'parentAccountId'];
               if (Object.keys(input).some(k => !allowed.includes(k))) fail('Account code, type and normal balance are immutable');
               if (input.isActive !== undefined && typeof input.isActive !== 'boolean') fail('isActive must be boolean');
               const sharedHistory = await trx('acc_journal_lines').where({ account_id: id }).first();
               const localCodes = Object.keys(settings.mappings).filter(k => settings.mappings[k] === row.account_code);
               const localHistory = localCodes.length ? await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id').where('j.branchid', this.context.branch).whereIn('l.account_code', localCodes).first() : null;
               const history = sharedHistory || localHistory;
               if (history && (input.name !== undefined && input.name !== row.name || input.parentAccountId !== undefined && input.parentAccountId !== row.parent_account_id)) fail('Accounts with posting history cannot be renamed or reparented', 'HISTORY_PROTECTED', 409);
               if (input.isActive === false) {
                    if (assigned && settings.enabled) fail('An enabled pharmacy mapping cannot be deactivated', 'MAPPING_IN_USE', 409);
                    if (await trx('acc_accounts').where({ parent_account_id: id, is_active: true }).first()) fail('Deactivate child accounts first');
               }
               const next = { name: input.name === undefined ? row.name : text(input.name, 'account name', 120), is_active: input.isActive === undefined ? Boolean(row.is_active) : input.isActive, parent_account_id: input.parentAccountId === undefined ? row.parent_account_id : await this.parent(trx, input.parentAccountId, row.type, id), updated_at: new Date() };
               await trx('acc_accounts').where({ id }).update(next);
               await this.audit(trx, 'accounts:update', String(id), row, next); return { ...row, ...next, local_codes: Object.keys(settings.mappings).filter(k => settings.mappings[k] === row.account_code) };
          });
     }
}
