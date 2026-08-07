import KnexConnection from '../../../../../database/KnexConnections';
import { NotificationContextProvider } from './NotificationContextProvider';
import { EventDefinition } from './NotificationEventDefinitions';
import { buildEventDefinitionFromCatalog } from './NotificationEventCatalog';

export class AppointmentContextProvider implements NotificationContextProvider {
     private connection;

     constructor(private tenantId: number) {
          this.connection = KnexConnection(tenantId);
     }

     async getContext(referenceId?: number | string): Promise<Record<string, unknown>> {
          if (!referenceId) throw new Error('Appointment reference is required');

          const connection = await this.connection;
          const row = await connection('appointments as a')
               .leftJoin('new_patients as np', 'np.patientid', 'a.patientid')
               .leftJoin('roles as rr', 'rr.employeeid', 'a.practioner')
               .select(
                    'a.refid as appointment_id',
                    'a.patientid as patient_id',
                    'a.appointment_date',
                    'a.appointment_time',
                    'a.purpose as appointment_purpose',
                    'a.location as appointment_location',
                    'a.practioner as practitioner_id',
                    'rr.branch as branch_id',
                    'rr.username as practitioner_name',
                    'np.fullpatientid as patient_number',
                    'np.firstname',
                    'np.middlename',
                    'np.lastname',
                    'np.email as patient_email',
                    'np.mobile_number as patient_phone',
                    'np.gender as patient_gender',
               )
               .where('a.refid', Number(referenceId))
               .first();

          if (!row) throw new Error('Appointment not found');

          return {
               appointment_id: row.appointment_id,
               appointment_date: row.appointment_date,
               appointment_time: row.appointment_time,
               appointment_purpose: row.appointment_purpose,
               appointment_location: row.appointment_location,
               practitioner_id: row.practitioner_id,
               branch_id: row.branch_id,
               practitioner_name: row.practitioner_name,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
          };
     }

     supportsEvent(eventCode: string): boolean {
          return eventCode.startsWith('APPOINTMENT_');
     }

     getEventDefinition(eventCode: string): EventDefinition | null {
          if (!this.supportsEvent(eventCode)) return null;
          return buildEventDefinitionFromCatalog(eventCode) ?? null;
     }
}
