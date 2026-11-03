import { Knex } from 'knex';
import { PharmacyAccountingCore, fail, text } from './PharmacyAccountingCore';
import { DEFAULT_PHARMACY_ACCOUNTS, RESERVED_PHARMACY_ACCOUNT_NUMBERS } from './PharmacyLocalChart';
import { expectedMappingType } from './PharmacyAccountingCatalogue';
import { json } from '../PharmacyEnterpriseCore';

export class PharmacyLocalAccounts extends PharmacyAccountingCore {
     private async parent(trx: Knex.Transaction, value: unknown, type: string, self?: string): Promise<string | null> {
          if (value == null || value === '') return null;
          const root = typeof value === 'string' ? value : fail('Invalid parent account');
          const visited = new Set<string>(self ? [self] : []);
          let code: string | null = root;
          while (code) {
               if (visited.has(code)) fail('Account hierarchy contains a cycle');
               visited.add(code);
               const standard = DEFAULT_PHARMACY_ACCOUNTS.find(account => account.account_code === code);
               const parent = standard || await trx('pharmacy_local_accounts').where({ branchid: this.context.branch, local_code: code, is_active: true }).forUpdate().first();
               if (!parent || parent.type !== type) fail('Parent must be an active pharmacy account of the same type');
               code = 'parent_code' in parent ? parent.parent_code : null;
               if (visited.size > 100) fail('Account hierarchy is too deep');
          }
          return root;
     }
     async create(input: any): Promise<any> {
          return this.atomic(input, 'local-accounts:create', async (trx, settings) => {
               if (Object.keys(input).some(key => !['idempotencyKey', 'accountCode', 'name', 'type', 'normalBalance', 'parentAccountId', 'localCode'].includes(key))) fail('Unsupported local account fields');
               if (typeof input.accountCode !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/.test(input.accountCode)) fail('Account code must contain 1-20 letters, numbers, underscores or hyphens');
               if (RESERVED_PHARMACY_ACCOUNT_NUMBERS.has(input.accountCode)) fail(`Account number ${input.accountCode} is used by a standard Pharmacy account`, 'ACCOUNT_EXISTS', 409);
               if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(input.type) || !['debit', 'credit'].includes(input.normalBalance)) fail('Invalid account type or normal balance');
               const local = input.localCode || `${input.type}:${input.accountCode}`;
               if (typeof local !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,99}$/.test(local) || expectedMappingType(local) !== input.type ||
                    !local.startsWith(input.type + ':') || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(local.slice(input.type.length + 1))) fail('Local posting code must use the selected account type as its prefix');
               const normalized = local.toLowerCase();
               if (DEFAULT_PHARMACY_ACCOUNTS.some(account => account.account_code.toLowerCase() === normalized) || Object.keys(settings.mappings).some(code => code.toLowerCase() === normalized) ||
                    await trx('pharmacy_local_accounts').where({ branchid: this.context.branch }).where(builder => builder.whereRaw('LOWER(local_code) = ?', [normalized]).orWhereRaw('LOWER(account_code) = ?', [input.accountCode.toLowerCase()])).forUpdate().first()) fail('This pharmacy account code or posting code already exists', 'ACCOUNT_EXISTS', 409);
               const parent = await this.parent(trx, input.parentAccountId, input.type);
               const values = { branchid: this.context.branch, account_code: input.accountCode, local_code: local, name: text(input.name, 'account name', 120),
                    type: input.type, normal_balance: input.normalBalance, parent_code: parent, is_active: true, created_by: this.context.actor };
               const [id] = await trx('pharmacy_local_accounts').insert(values);
               const result = { id, ...values };
               await this.audit(trx, 'local-accounts:create', String(id), null, result);
               return result;
          });
     }
     async update(id: number, input: any): Promise<any> {
          return this.atomic(input, `local-accounts:update:${id}`, async (trx, settings) => {
               const row = await trx('pharmacy_local_accounts').where({ id, branchid: this.context.branch }).forUpdate().first();
               if (!row) fail('Pharmacy account not found in this branch', 'NOT_FOUND', 404);
               if (Object.keys(input).some(key => !['idempotencyKey', 'name', 'isActive', 'parentAccountId'].includes(key))) fail('Account code, type and normal balance are immutable');
               if (input.isActive !== undefined && typeof input.isActive !== 'boolean') fail('isActive must be boolean');
               const parent = input.parentAccountId === undefined ? row.parent_code : await this.parent(trx, input.parentAccountId, row.type, row.local_code);
               const name = input.name === undefined ? row.name : text(input.name, 'account name', 120);
               const history = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
                    .where({ 'j.branchid': this.context.branch, 'l.account_code': row.local_code }).first();
               if (history && (name !== row.name || parent !== row.parent_code)) fail('Accounts with posting history cannot be renamed or reparented', 'HISTORY_PROTECTED', 409);
               if (input.isActive === false) {
                    if (settings.enabled && Object.keys(settings.mappings).some(code => code.toLowerCase() === row.local_code.toLowerCase())) fail('An enabled pharmacy mapping cannot be deactivated', 'MAPPING_IN_USE', 409);
                    if (await trx('pharmacy_local_accounts').where({ branchid: this.context.branch, parent_code: row.local_code, is_active: true }).first()) fail('Deactivate child accounts first');
                    if (await trx('pharmacy_tax_rules').where({ branchid: this.context.branch, local_account: row.local_code, is_active: true }).first()) fail('An active tax rule uses this account', 'ACCOUNT_IN_USE', 409);
               }
               const next = { name, parent_code: parent, is_active: input.isActive === undefined ? Boolean(row.is_active) : input.isActive, updated_at: new Date() };
               await trx('pharmacy_local_accounts').where({ id, branchid: this.context.branch }).update(next);
               await this.audit(trx, 'local-accounts:update', String(id), row, { ...row, ...next });
               return { ...row, ...next };
          });
     }
     async remove(id: number, input: any): Promise<any> {
          return this.atomic(input, `local-accounts:remove:${id}`, async (trx, settings) => {
               const row = await trx('pharmacy_local_accounts').where({ id, branchid: this.context.branch }).forUpdate().first();
               if (!row) fail('Pharmacy account not found in this branch', 'NOT_FOUND', 404);
               if (Object.keys(settings.mappings).some(code => code.toLowerCase() === row.local_code.toLowerCase())) fail('Remove the facility mapping before deleting this account', 'ACCOUNT_IN_USE', 409);
               if (await trx('pharmacy_local_accounts').where({ branchid: this.context.branch, parent_code: row.local_code }).first()) fail('Remove or reparent child accounts first', 'ACCOUNT_IN_USE', 409);
               const history = await trx('pharmacy_journal_lines as l').join('pharmacy_journals as j', 'j.id', 'l.journal_id')
                    .where({ 'j.branchid': this.context.branch, 'l.account_code': row.local_code }).first();
               const rule = await trx('pharmacy_tax_rules').where({ branchid: this.context.branch, local_account: row.local_code }).first();
               const taxHistory = await trx('pharmacy_tax_events').where({ branchid: this.context.branch, local_account: row.local_code }).first();
               const documents = await trx('pharmacy_accounting_documents').where({ branchid: this.context.branch }).where('details', 'like', `%${row.local_code}%`).select('details');
               const contains = (value: unknown): boolean => value === row.local_code || (Array.isArray(value) ? value.some(contains) : value !== null && typeof value === 'object' ? Object.values(value).some(contains) : false);
               if (history || rule || taxHistory || documents.some(document => contains(json(document.details)))) fail('This account has accounting or tax history. Deactivate it instead; records must be retained', 'HISTORY_PROTECTED', 409);
               await trx('pharmacy_local_accounts').where({ id, branchid: this.context.branch }).delete();
               await this.audit(trx, 'local-accounts:remove', String(id), row, { deleted: true });
               return { id, deleted: true };
          });
     }
}
