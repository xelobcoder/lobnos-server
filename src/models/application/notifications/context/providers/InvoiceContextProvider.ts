import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';

export class InvoiceContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Billing reference is required');

          const connection = await this.connection;
          const row = await connection('billing as b')
               .leftJoin('new_patients as np', 'np.patientid', 'b.patientid')
               .select(
                    'b.billingid as billing_id',
                    'b.branchid as branch_id',
                    'b.totalcost as amount_total',
                    'b.paid as amount_paid',
                    'b.balance as amount_balance',
                    'b.status as billing_status',
                    'np.patientid as patient_id',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('b.billingid', Number(referenceId))
               .first();

          if (!row) throw new Error('Billing record not found');

          return {
               billing_id: row.billing_id,
               branch_id: row.branch_id,
               amount_total: row.amount_total,
               amount_paid: row.amount_paid,
               amount_balance: row.amount_balance,
               billing_status: row.billing_status,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }
}
