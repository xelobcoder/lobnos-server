import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';
import { EventDefinition } from './NotificationEventDefinitions';
import { buildEventDefinitionFromCatalog } from './NotificationEventCatalog';

export class LaboratoryContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(_referenceId?: number | string): Promise<Record<string, unknown>> {
          const connection = await this.connection;
          const company = await connection('companyprofile')
               .select('name', 'email', 'phonenumber', 'address', 'website')
               .first();

          let lifecycleContext: Record<string, unknown> = {};
          if (_referenceId) {
               const resultRow = await connection('test_ascension as ta')
                    .leftJoin('billing as b', 'b.billingid', 'ta.billingid')
                    .leftJoin('new_patients as np', 'np.patientid', 'b.patientid')
                    .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
                    .select(
                         'ta.id as ascension_id',
                         'ta.testid as test_id',
                         'ta.billingid as billing_id',
                         'b.branchid as branch_id',
                         'tp.name as test_name',
                         'np.patientid as patient_id',
                         'np.fullpatientid as patient_number',
                         'np.firstname',
                         'np.middlename',
                         'np.lastname',
                         'np.email as patient_email',
                         'np.mobile_number as patient_phone',
                    )
                    .where('ta.id', Number(_referenceId))
                    .first();

               if (resultRow) {
                    lifecycleContext = {
                         ascension_id: resultRow.ascension_id,
                         test_id: resultRow.test_id,
                         billing_id: resultRow.billing_id,
                         branch_id: resultRow.branch_id,
                         test_name: resultRow.test_name,
                         patient_id: resultRow.patient_id,
                         patient_number: resultRow.patient_number,
                         patient_name: `${resultRow.firstname || ''} ${resultRow.middlename || ''} ${resultRow.lastname || ''}`.replace(/\s+/g, ' ').trim(),
                         patient_email: resultRow.patient_email,
                         patient_phone: resultRow.patient_phone,
                         result_status: 'available',
                         report_status: 'generated',
                         lifecycle_stage: 'laboratory_result_lifecycle',
                    };
               } else {
                    const billingRow = await connection('billing as b')
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
                         )
                         .where('b.billingid', Number(_referenceId))
                         .first();

                    if (billingRow) {
                         lifecycleContext = {
                              billing_id: billingRow.billing_id,
                              branch_id: billingRow.branch_id,
                              amount_total: billingRow.amount_total,
                              amount_paid: billingRow.amount_paid,
                              amount_balance: billingRow.amount_balance,
                              billing_status: billingRow.billing_status,
                              patient_id: billingRow.patient_id,
                              patient_number: billingRow.patient_number,
                              patient_name: `${billingRow.firstname || ''} ${billingRow.middlename || ''} ${billingRow.lastname || ''}`.replace(/\s+/g, ' ').trim(),
                              patient_email: billingRow.patient_email,
                              patient_phone: billingRow.patient_phone,
                              report_status: 'generated',
                              lifecycle_stage: 'laboratory_report_lifecycle',
                         };
                    }
               }
          }

          if (!company) {
               return {
                    laboratory_name: 'Prime Laboratory Services',
                    laboratory_email: '',
                    laboratory_phone: '',
                    laboratory_address: '',
                    laboratory_website: '',
                    ...lifecycleContext,
               };
          }

          return {
               laboratory_name: company.name || 'Prime Laboratory Services',
               laboratory_email: company.email || '',
               laboratory_phone: company.phonenumber || '',
               laboratory_address: company.address || '',
               laboratory_website: company.website || '',
               ...lifecycleContext,
          };
     }

     supportsEvent(eventCode: string): boolean {
          return eventCode.startsWith('RESULT_') || eventCode.startsWith('REPORT_') || eventCode.startsWith('IMAGING_') || eventCode === 'CRITICAL_RESULT';
     }

     getEventDefinition(eventCode: string): EventDefinition | null {
          if (!this.supportsEvent(eventCode)) return null;
          return buildEventDefinitionFromCatalog(eventCode) ?? null;
     }
}
