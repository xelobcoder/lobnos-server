import { expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { resolveAppointmentSmsContact } from './AppointmentSmsContact';

it('resolves a linked parent and stops using their old number when ownership changes', async () => {
     const { db } = accountingSqlDatabase();
     try {
          await db.schema.createTable('new_patients', table => {
               table.increments('patientid');
               for (const field of ['firstname', 'middlename', 'lastname', 'mobile_number', 'contactpointer', 'backup_phone', 'backup_relationship']) {
                    table.string(field);
               }
          });
          await db.schema.createTable('patient_phone_contacts', table => {
               table.integer('patient_id');
               table.integer('position');
               table.string('phone');
               table.string('relationship');
               table.integer('owner_patient_id');
          });
          await db('new_patients').insert({ patientid: 10, mobile_number: '0200000104', contactpointer: 'self' });
          const child = { patientid: 11, backup_phone: '0200000104', backup_relationship: 'mother', backup_patient_id: 10 };

          expect(await resolveAppointmentSmsContact(db, child)).toEqual({ phone: '0200000104', shared: true });
          await db('new_patients').where({ patientid: 10 }).update({ mobile_number: '0200000105' });
          expect(await resolveAppointmentSmsContact(db, child)).toBeNull();
     } finally {
          await db.destroy();
     }
});
