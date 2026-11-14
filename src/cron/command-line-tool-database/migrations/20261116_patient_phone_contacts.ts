import type { Knex } from 'knex';

export async function up(db: Knex) {
     if (!await db.schema.hasTable('patient_phone_contacts')) {
          await db.schema.createTable('patient_phone_contacts', table => {
               table.integer('patient_id').unsigned().notNullable().references('patientid').inTable('new_patients').onDelete('CASCADE');
               table.integer('position').unsigned().notNullable();
               table.string('phone', 32).notNullable().index();
               table.string('relationship', 32).notNullable();
               table.string('contact_name', 150).nullable();
               table.integer('owner_patient_id').unsigned().nullable().index();
               table.primary(['patient_id', 'position']);
          });
     }

     await db.raw(`
          INSERT INTO patient_phone_contacts (patient_id, position, phone, relationship, contact_name, owner_patient_id)
          SELECT patientid, 0,
                 CASE WHEN contactpointer = 'relative' THEN relativecontactnumber ELSE mobile_number END,
                 CASE WHEN contactpointer = 'relative' THEN COALESCE(NULLIF(contact_relationship, ''), 'relative') ELSE 'self' END,
                 CASE WHEN contactpointer = 'relative' THEN relativecontactname ELSE NULL END, NULL
          FROM new_patients
          WHERE NULLIF(TRIM(CASE WHEN contactpointer = 'relative' THEN relativecontactnumber ELSE mobile_number END), '') IS NOT NULL
          ON DUPLICATE KEY UPDATE patient_id = patient_phone_contacts.patient_id
     `);
     await db.raw(`
          INSERT INTO patient_phone_contacts (patient_id, position, phone, relationship, contact_name, owner_patient_id)
          SELECT patientid, 1, backup_phone, COALESCE(NULLIF(backup_relationship, ''), 'relative'), backup_contact_name, backup_patient_id
          FROM new_patients WHERE NULLIF(TRIM(backup_phone), '') IS NOT NULL
          ON DUPLICATE KEY UPDATE patient_id = patient_phone_contacts.patient_id
     `);
}
