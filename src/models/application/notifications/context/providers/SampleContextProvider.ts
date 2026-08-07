import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';
import { EventDefinition } from './NotificationEventDefinitions';
import { buildEventDefinitionFromCatalog } from './NotificationEventCatalog';

export class SampleContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Sample/ascension reference is required');

          const connection = await this.connection;
          const row = await connection('test_ascension as ta')
               .leftJoin('samplestatus as ss', 'ss.ascensionid', 'ta.id')
               .leftJoin('billing as b', 'b.billingid', 'ta.billingid')
               .leftJoin('new_patients as np', 'np.patientid', 'b.patientid')
               .leftJoin('test_panels as tp', 'tp.id', 'ta.testid')
               .leftJoin('roles as rc', 'rc.employeeid', 'ta.sampleCollectedBy')
               .select(
                    'ta.id as ascension_id',
                    'ta.testid as test_id',
                    'ta.billingid as billing_id',
                    'b.branchid as branch_id',
                    'ta.collectionStartDate as collection_start_time',
                    'ta.collectionEndDate as collection_end_time',
                    'ss.keyid as sample_id',
                    'ss.rejectionmessage as sample_rejection_reason',
                    'tp.name as test_name',
                    'rc.username as collected_by_name',
                    'np.patientid as patient_id',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('ta.id', Number(referenceId))
               .first();

          if (!row) throw new Error('Sample/ascension record not found');

          return {
               ascension_id: row.ascension_id,
               sample_id: row.sample_id,
               test_id: row.test_id,
               test_name: row.test_name,
               billing_id: row.billing_id,
               branch_id: row.branch_id,
               collection_start_time: row.collection_start_time,
               collection_end_time: row.collection_end_time,
               sample_rejection_reason: row.sample_rejection_reason,
               collected_by_name: row.collected_by_name,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }

     supportsEvent(eventCode: string): boolean {
          return eventCode.startsWith('SAMPLE_');
     }

     getEventDefinition(eventCode: string): EventDefinition | null {
          if (!this.supportsEvent(eventCode)) return null;
          return buildEventDefinitionFromCatalog(eventCode) ?? null;
     }
}
