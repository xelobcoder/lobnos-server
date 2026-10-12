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
          const hasLeadsTable = await connection.schema.hasTable('leads');
          const appointmentQuery = connection('appointments as a')
               .leftJoin('new_patients as np', 'np.patientid', 'a.patientid')
               .leftJoin('roles as rr', 'rr.employeeid', 'a.practioner')
               .select(
                    'a.refid as appointment_id',
                    'a.patientid as patient_id',
                    'a.lead_id as lead_id',
                    'a.appointment_date',
                    'a.appointment_time',
                    'a.purpose as appointment_purpose',
                    'a.location as appointment_location',
                    'a.inviteMethod as appointment_invite_method',
                    'a.preference as appointment_preference',
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
               );
          if (hasLeadsTable) {
               appointmentQuery.leftJoin('leads as l', 'l.id', 'a.lead_id').select(
                    'l.firstname as lead_firstname',
                    'l.lastname as lead_lastname',
                    'l.company_name as lead_company',
                    'l.contact_person as lead_contact_person',
                    'l.contact_email as lead_email',
                    'l.contact_phone as lead_phone',
               );
          }
          const row = await appointmentQuery.where('a.refid', Number(referenceId)).first();

          if (!row) throw new Error('Appointment not found');

          const leadName = `${row.lead_firstname || ''} ${row.lead_lastname || ''}`.replace(/\s+/g, ' ').trim()
               || row.lead_contact_person
               || row.lead_company
               || '';
          return {
               appointment_id: row.appointment_id,
               appointment_date: row.appointment_date,
               appointment_time: row.appointment_time,
               appointment_purpose: row.appointment_purpose,
               appointment_location: row.appointment_location,
               appointment_invite_method: row.appointment_invite_method,
               appointment_preference: row.appointment_preference,
               practitioner_id: row.practitioner_id,
               branch_id: row.branch_id,
               practitioner_name: row.practitioner_name,
               patient_id: row.patient_id,
               patient_number: row.patient_number,
               patient_name: `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim(),
               patient_email: row.patient_email,
               patient_phone: row.patient_phone,
               patient_gender: row.patient_gender,
               lead_id: row.lead_id ?? null,
               lead_name: leadName,
               lead_email: row.lead_email,
               lead_phone: row.lead_phone,
               appointment_contact_name: row.patient_id ? `${row.firstname || ''} ${row.middlename || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim() : leadName,
               appointment_contact_email: row.patient_id ? row.patient_email : row.lead_email,
               appointment_contact_phone: row.patient_id ? row.patient_phone : row.lead_phone,
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
