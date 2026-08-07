import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

export class PayrollContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Payroll reference is required');

          const connection = await this.connection;
          const row = await connection('payroll_transactions as pt')
               .leftJoin('payroll_periods as pp', 'pp.id', 'pt.payroll_period_id')
               .leftJoin('roles as r', 'r.employeeid', 'pt.employeeid')
               .select(
                    'pt.id as payroll_transaction_id',
                    'pt.payroll_period_id',
                    'pt.employeeid as employee_id',
                    'pt.gross_salary',
                    'pt.total_deductions',
                    'pt.net_salary',
                    'pt.status as payroll_status',
                    'pt.payment_date as payroll_date',
                    'pp.period_name as payroll_period',
                    'r.username as employee_name',
                    'r.email as employee_email',
                    'r.branch as branch_id',
               )
               .where('pt.id', Number(referenceId))
               .first();

          if (!row) throw new Error('Payroll transaction not found');

          return row;
     }
}
