import type { Knex } from 'knex';
import { normalizeSmsPhone } from '../application/sms/SmsMessageMetrics';
import { findPhoneOwners, phoneContactsTable } from '../registration/PatientPhoneContacts';

export const MANUAL_APPOINTMENT_SMS = 'APPOINTMENT_MANUAL_REMINDER';
export const SHARED_APPOINTMENT_SMS_BODY = 'You have an appointment update. Please contact the facility for details.';

export async function resolveAppointmentSmsContact(db: Knex, patient: {
     patientid: number;
     mobile_number?: unknown;
     contactpointer?: string;
     relativecontactnumber?: unknown;
     relativecontactname?: string | null;
     backup_phone?: unknown;
     backup_relationship?: string | null;
     backup_contact_name?: string | null;
     backup_patient_id?: number | null;
}) {
     const primary = normalizeSmsPhone(patient.mobile_number);
     if (primary && patient.contactpointer !== 'relative') return { phone: primary, shared: false };

     const slots = [
          { position: 0, value: patient.contactpointer === 'relative' ? patient.relativecontactnumber : null,
               shared: true, named: Boolean(patient.relativecontactname?.trim()), owner: null },
          { position: 1, value: patient.backup_phone, shared: patient.backup_relationship !== 'self',
               named: Boolean(patient.backup_contact_name?.trim()), owner: patient.backup_patient_id },
     ];
     for (const slot of slots) {
          const phone = normalizeSmsPhone(slot.value);
          if (!phone) continue;
          if (!slot.shared) return { phone, shared: false };
          const contact = await db(phoneContactsTable).where({
               patient_id: patient.patientid, position: slot.position, phone: String(slot.value),
          }).first('owner_patient_id');
          const owner = slot.owner ?? contact?.owner_patient_id;
          if (!owner && !slot.named) continue;
          if (owner) {
               const owners = await findPhoneOwners(db, phone, patient.patientid);
               if (owners.length !== 1 || Number(owners[0].patientid) !== Number(owner)) continue;
          }
          return { phone, shared: true };
     }

     const additional = await db(phoneContactsTable).where({ patient_id: patient.patientid, relationship: 'self' })
          .where('position', '>=', 2).orderBy('position').select('phone');
     for (const contact of additional) {
          const phone = normalizeSmsPhone(contact.phone);
          if (phone) return { phone, shared: false };
     }
     return null;
}
