import KnexConnection from '../../../database/KnexConnections';
import { IStaffFocAccount, IStaffFocPolicy, IStaffFocTransaction } from '../interfaces/IStaffFocService';

export class StaffFocRepository {
     async getPolicy(tenantId: number): Promise<IStaffFocPolicy | null> {
          const conn = await KnexConnection(tenantId);
          const policy = await conn('staff_foc_policy').where({ active: 1 }).first();
          return policy || null;
     }

     async getAccount(tenantId: number, employeeId: number, year: number, trx?: any): Promise<IStaffFocAccount | null> {
          const conn = trx || await KnexConnection(tenantId);
          const account = await conn('staff_foc_account')
               .select(
                    'staff_foc_account.*',
                    'roles.username as staff_name',
                    'roles.role as staff_role',
                    'roles.email as staff_email',
                    'roles.mobile as staff_mobile'
               )
               .leftJoin('roles', 'roles.employeeid', 'staff_foc_account.employeeid')
               .where({
                    'staff_foc_account.employeeid': employeeId,
                    'staff_foc_account.period_year': year,
               })
               .first();

          return account || null;
     }

     async getAccountForUpdate(tenantId: number, employeeId: number, year: number, trx: any): Promise<IStaffFocAccount | null> {
          const account = await trx('staff_foc_account')
               .where({
                    employeeid: employeeId,
                    period_year: year,
               })
               .forUpdate()
               .first();

          return account || null;
     }

     async createAccount(tenantId: number, data: Partial<IStaffFocAccount>, trx?: any): Promise<number> {
          const conn = trx || await KnexConnection(tenantId);
          const [id] = await conn('staff_foc_account').insert({
               employeeid: data.employeeid,
               policy_id: data.policy_id || null,
               period_year: data.period_year,
               period_start: data.period_start,
               period_end: data.period_end,
               limit_amount: data.limit_amount,
               used_amount: data.used_amount || 0.00,
               remaining_amount: data.remaining_amount,
               active: data.active !== undefined ? data.active : true,
          });
          return id;
     }

     async updateAccountBalance(tenantId: number, accountId: number, usedAmount: number, remainingAmount: number, trx?: any): Promise<void> {
          const conn = trx || await KnexConnection(tenantId);
          await conn('staff_foc_account')
               .where({ id: accountId })
               .update({
                    used_amount: usedAmount,
                    remaining_amount: remainingAmount,
                    updated_at: new Date(),
               });
     }

     async updateAccountLimit(tenantId: number, accountId: number, newLimit: number, trx?: any): Promise<void> {
          const conn = trx || await KnexConnection(tenantId);
          const account = await conn('staff_foc_account').where({ id: accountId }).first();
          if (!account) return;

          const used = Number(account.used_amount || 0);
          const remaining = Math.max(0, newLimit - used);

          await conn('staff_foc_account')
               .where({ id: accountId })
               .update({
                    limit_amount: newLimit,
                    remaining_amount: remaining,
                    updated_at: new Date(),
               });
     }

     async createTransaction(tenantId: number, data: Partial<IStaffFocTransaction>, trx?: any): Promise<number> {
          const conn = trx || await KnexConnection(tenantId);
          const [id] = await conn('staff_foc_transaction').insert({
               foc_account_id: data.foc_account_id,
               employeeid: data.employeeid,
               patientid: data.patientid,
               billingid: data.billingid,
               branchid: data.branchid || 1,
               gross_amount: data.gross_amount,
               foc_amount: data.foc_amount,
               payable_amount: data.payable_amount || 0.00,
               status: data.status || 'approved',
               reason: data.reason || null,
               requested_by: data.requested_by,
               approved_by: data.approved_by || null,
               approved_on: data.approved_on || null,
          });
          return id;
     }

     async getTransactionById(tenantId: number, transactionId: number, trx?: any): Promise<IStaffFocTransaction | null> {
          const conn = trx || await KnexConnection(tenantId);
          const tx = await conn('staff_foc_transaction')
               .select(
                    'staff_foc_transaction.*',
                    'staff_role.username as staff_name',
                    'req_role.username as requested_by_name',
                    'app_role.username as approved_by_name',
                    conn.raw('CONCAT_WS(" ", np.firstname, np.middlename, np.lastname) as patient_name')
               )
               .leftJoin('roles as staff_role', 'staff_role.employeeid', 'staff_foc_transaction.employeeid')
               .leftJoin('roles as req_role', 'req_role.employeeid', 'staff_foc_transaction.requested_by')
               .leftJoin('roles as app_role', 'app_role.employeeid', 'staff_foc_transaction.approved_by')
               .leftJoin('new_patients as np', 'np.patientid', 'staff_foc_transaction.patientid')
               .where('staff_foc_transaction.id', transactionId)
               .first();

          return tx || null;
     }

     async updateTransactionStatus(tenantId: number, transactionId: number, status: 'approved' | 'rejected' | 'reversed', approverId?: number, trx?: any, reversalReason?: string): Promise<void> {
          const conn = trx || await KnexConnection(tenantId);
          const updateData: any = {
               status,
          };
          if (approverId) {
               updateData.approved_by = approverId;
               updateData.approved_on = new Date();
          }
          if (status === 'reversed') {
               updateData.reversal_reason = reversalReason || null;
               updateData.reversed_by = approverId || null;
               updateData.reversed_at = new Date();
          }

          await conn('staff_foc_transaction')
               .where({ id: transactionId })
               .update(updateData);
     }

     async getAllAccounts(
          tenantId: number,
          year: number,
          search?: string,
          page = 1,
          count = 10
     ): Promise<{ accounts: IStaffFocAccount[]; total: number }> {
          const conn = await KnexConnection(tenantId);
          let query = conn('staff_foc_account')
               .select(
                    'staff_foc_account.*',
                    'roles.username as staff_name',
                    'roles.role as staff_role',
                    'roles.email as staff_email',
                    'roles.mobile as staff_mobile'
               )
               .leftJoin('roles', 'roles.employeeid', 'staff_foc_account.employeeid')
               .where('staff_foc_account.period_year', year);

          if (search && search.trim().length > 0) {
               const s = `%${search.trim()}%`;
               query = query.where((builder) => {
                    builder.where('roles.username', 'like', s)
                         .orWhere('roles.email', 'like', s)
                         .orWhere('roles.mobile', 'like', s);
               });
          }

          const countResult = await query.clone().clearSelect().count({ total: '*' }).first();
          const total = Number(countResult?.total || 0);

          const offset = (page - 1) * count;
          const accounts = await query.orderBy('roles.username', 'asc').limit(count).offset(offset);

          return { accounts, total };
     }

     async getTransactions(
          tenantId: number,
          filters: {
               employeeid?: number;
               patientid?: number;
               status?: string;
               year?: number;
               from?: string;
               to?: string;
               page?: number;
               count?: number;
          }
     ): Promise<{ transactions: IStaffFocTransaction[]; total: number }> {
          const conn = await KnexConnection(tenantId);
          const page = filters.page || 1;
          const count = filters.count || 10;
          const offset = (page - 1) * count;

          let query = conn('staff_foc_transaction')
               .select(
                    'staff_foc_transaction.*',
                    'staff_role.username as staff_name',
                    'req_role.username as requested_by_name',
                    'app_role.username as approved_by_name',
                    conn.raw('CONCAT_WS(" ", np.firstname, np.middlename, np.lastname) as patient_name')
               )
               .leftJoin('roles as staff_role', 'staff_role.employeeid', 'staff_foc_transaction.employeeid')
               .leftJoin('roles as req_role', 'req_role.employeeid', 'staff_foc_transaction.requested_by')
               .leftJoin('roles as app_role', 'app_role.employeeid', 'staff_foc_transaction.approved_by')
               .leftJoin('new_patients as np', 'np.patientid', 'staff_foc_transaction.patientid');

          if (filters.employeeid) query = query.where('staff_foc_transaction.employeeid', filters.employeeid);
          if (filters.patientid) query = query.where('staff_foc_transaction.patientid', filters.patientid);
          if (filters.status) query = query.where('staff_foc_transaction.status', filters.status);
          if (filters.from && filters.to) {
               query = query.whereRaw('DATE(staff_foc_transaction.created_at) BETWEEN ? AND ?', [filters.from, filters.to]);
          } else if (filters.from) {
               query = query.whereRaw('DATE(staff_foc_transaction.created_at) >= ?', [filters.from]);
          } else if (filters.to) {
               query = query.whereRaw('DATE(staff_foc_transaction.created_at) <= ?', [filters.to]);
          }

          const countResult = await query.clone().clearSelect().count({ total: '*' }).first();
          const total = Number(countResult?.total || 0);

          const transactions = await query.orderBy('staff_foc_transaction.id', 'desc').limit(count).offset(offset);

          return { transactions, total };
     }

     async getFocSummaryReport(tenantId: number, year: number, branchId?: number): Promise<any> {
          const conn = await KnexConnection(tenantId);

          let baseQuery = conn('staff_foc_transaction')
               .whereRaw('YEAR(created_at) = ?', [year])
               .where('status', 'approved');

          if (branchId) {
               baseQuery = baseQuery.where('branchid', branchId);
          }

          const totals: any = await baseQuery.clone().select(
               conn.raw('COALESCE(SUM(foc_amount), 0) as total_foc_value'),
               conn.raw('COUNT(DISTINCT id) as total_transactions'),
               conn.raw('COUNT(DISTINCT employeeid) as total_staff_beneficiaries'),
               conn.raw('COUNT(DISTINCT patientid) as total_patients_served')
          ).first();

          const topStaff = await baseQuery.clone()
               .select(
                    'staff_foc_transaction.employeeid',
                    'roles.username as staff_name',
                    conn.raw('COALESCE(SUM(foc_amount), 0) as total_used'),
                    conn.raw('COUNT(staff_foc_transaction.id) as transaction_count')
               )
               .leftJoin('roles', 'roles.employeeid', 'staff_foc_transaction.employeeid')
               .groupBy('staff_foc_transaction.employeeid', 'roles.username')
               .orderBy('total_used', 'desc')
               .limit(10);

          return {
               year,
               totalFocValue: Number(totals?.total_foc_value || 0),
               totalTransactions: Number(totals?.total_transactions || 0),
               totalStaffBeneficiaries: Number(totals?.total_staff_beneficiaries || 0),
               totalPatientsServed: Number(totals?.total_patients_served || 0),
               topStaff,
          };
     }
}
