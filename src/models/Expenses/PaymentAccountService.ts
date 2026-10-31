import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';
import { fundingAvailability } from './FundingAvailability';

export interface CreatePaymentAccountInput {
     name: string;
     accountType: 'cash' | 'bank' | 'mobile_money' | 'other';
     currency?: string;
     branchid?: number | null;
     glAccountCode: string;
     bankAccountId?: number | null;
}

export interface GrantPaymentAccountAccessInput {
     employeeid: number;
     canPay?: boolean;
     canView?: boolean;
     canReconcile?: boolean;
}

export class PaymentAccountService {
     constructor(private readonly tenantId: number) { }

     async listAvailable(actor: AuthUser, capability: 'view' | 'pay' = 'view'): Promise<any[]> {
          const connection = await KnexConnection(this.tenantId);
          const permissionColumn = capability === 'pay' ? 'access.can_pay' : 'access.can_view';
          const accounts = await connection('payment_accounts as account')
               .join('payment_account_users as access', 'access.payment_account_id', 'account.id')
               .select('account.id', 'account.name', 'account.account_type', 'account.currency', 'account.branchid', 'account.gl_account_code', 'account.bank_account_id')
               .where('account.is_active', true)
               .where('access.employeeid', actor.employeeid)
               .where('access.is_active', true)
               .where(permissionColumn, true)
               .andWhere((builder) => builder.whereNull('account.branchid').orWhere('account.branchid', actor.branch))
               .orderBy('account.name');
          return Promise.all(accounts.map(async (account:any)=>({...account,...await fundingAvailability(connection,account.gl_account_code)})));
     }

     async managementOptions(actor: AuthUser): Promise<{ employees: any[]; ledgerAccounts: any[] }> {
          const connection = await KnexConnection(this.tenantId);
          const employeesQuery = connection('roles').select('employeeid', 'username', 'role', 'branch as branchid').orderBy('username');
          if (actor.branch !== null) employeesQuery.where('branch', actor.branch);
          const [employees, ledgerAccounts] = await Promise.all([
               employeesQuery,
               connection('acc_accounts').select('account_code', 'name', 'type', 'is_active').where({ type: 'asset', is_active: true }).orderBy('account_code'),
          ]);
          return { employees, ledgerAccounts };
     }

     async listAll(branchid?: number | null): Promise<any[]> {
          const connection = await KnexConnection(this.tenantId);
          const query = connection('payment_accounts').select('*').orderBy('name');
          if (branchid !== undefined && branchid !== null) query.where((builder) => builder.whereNull('branchid').orWhere('branchid', branchid));
          const accounts = await query;
          if (!accounts.length) return [];
          const accessRows = await connection('payment_account_users as access')
               .leftJoin('roles as role', 'role.employeeid', 'access.employeeid')
               .select('access.*', 'role.username', 'role.role')
               .whereIn('access.payment_account_id', accounts.map((account: any) => account.id))
               .where('access.is_active', true);
          return accounts.map((account: any) => ({ ...account, users: accessRows.filter((access: any) => Number(access.payment_account_id) === Number(account.id)) }));
     }

     async create(actor: AuthUser, input: CreatePaymentAccountInput): Promise<any> {
          const name = String(input.name || '').trim();
          const glAccountCode = String(input.glAccountCode || '').trim();
          if (!name || !glAccountCode) throw new Error('Account name and GL account are required');
          if (!['cash', 'bank', 'mobile_money', 'other'].includes(input.accountType)) throw new Error('Invalid payment account type');

          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const glAccount = await trx('acc_accounts').where({ account_code: glAccountCode, is_active: true }).first();
               if (!glAccount) throw new Error('GL account was not found or is inactive');
               if (input.bankAccountId) {
                    const bank = await trx('acc_bank_accounts').where({ id: input.bankAccountId, is_active: true }).first();
                    if (!bank) throw new Error('Bank account was not found or is inactive');
               }

               const branchid = input.branchid ?? actor.branch ?? null;
               const duplicate = await trx('payment_accounts').where({ name, branchid }).first();
               if (duplicate) throw new Error('A payment account with this name already exists for the branch');
               const [id] = await trx('payment_accounts').insert({
                    name,
                    account_type: input.accountType,
                    currency: String(input.currency || 'GHS').toUpperCase(),
                    branchid,
                    gl_account_code: glAccountCode,
                    bank_account_id: input.bankAccountId || null,
                    is_active: true,
                    created_by: actor.employeeid,
                    updated_by: actor.employeeid,
                    created_at: new Date(),
                    updated_at: new Date(),
               });
               return trx('payment_accounts').where({ id }).first();
          });
     }

     async grantAccess(actor: AuthUser, paymentAccountId: number, input: GrantPaymentAccountAccessInput): Promise<any> {
          if (!Number.isInteger(paymentAccountId) || paymentAccountId <= 0) throw new Error('Valid payment account is required');
          if (!Number.isInteger(input.employeeid) || input.employeeid <= 0) throw new Error('Valid employee is required');
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const account = await trx('payment_accounts').where({ id: paymentAccountId, is_active: true }).first();
               if (!account) throw new Error('Payment account was not found or is inactive');
               const employee = await trx('roles').where({ employeeid: input.employeeid }).first();
               if (!employee) throw new Error('Employee was not found');
               if (account.branchid !== null && employee.branch !== null && Number(account.branchid) !== Number(employee.branch)) {
                    throw new Error('Employee and payment account belong to different branches');
               }

               const existing = await trx('payment_account_users').where({ payment_account_id: paymentAccountId, employeeid: input.employeeid }).first();
               const values = {
                    can_pay: Boolean(input.canPay),
                    can_view: input.canView === undefined ? true : Boolean(input.canView),
                    can_reconcile: Boolean(input.canReconcile),
                    granted_by: actor.employeeid,
                    granted_at: new Date(),
                    revoked_by: null,
                    revoked_at: null,
                    is_active: true,
               };
               if (existing) await trx('payment_account_users').where({ id: existing.id }).update(values);
               else await trx('payment_account_users').insert({ payment_account_id: paymentAccountId, employeeid: input.employeeid, ...values });
               return trx('payment_account_users').where({ payment_account_id: paymentAccountId, employeeid: input.employeeid }).first();
          });
     }
}
