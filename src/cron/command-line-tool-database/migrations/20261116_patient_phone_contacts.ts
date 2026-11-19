import type { Knex } from 'knex';

const phoneContactsMigrationId = '20261116_patient_phone_contacts';

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
          CREATE TABLE IF NOT EXISTS app_startup_migrations (
               migration_id VARCHAR(128) NOT NULL PRIMARY KEY,
               applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB
     `);

     await db.transaction(async trx => {
          const markerInsert = await trx.raw(
               'INSERT IGNORE INTO app_startup_migrations (migration_id) VALUES (?)',
               [phoneContactsMigrationId]
          );
          const result = Array.isArray(markerInsert) ? markerInsert[0] : markerInsert;

          if (!result || typeof result !== 'object' || !('affectedRows' in result)) {
               throw new Error('Unable to verify patient phone contacts migration state');
          }
          if (Number(result.affectedRows) !== 1) return;

          await trx.raw(`
          INSERT INTO patient_phone_contacts (patient_id, position, phone, relationship, contact_name, owner_patient_id)
          SELECT patientid, 0,
                 CASE WHEN contactpointer = 'relative' THEN relativecontactnumber ELSE mobile_number END,
                 CASE WHEN contactpointer = 'relative' THEN COALESCE(NULLIF(contact_relationship, ''), 'relative') ELSE 'self' END,
                 CASE WHEN contactpointer = 'relative' THEN relativecontactname ELSE NULL END, NULL
          FROM new_patients
          WHERE NULLIF(TRIM(CASE WHEN contactpointer = 'relative' THEN relativecontactnumber ELSE mobile_number END), '') IS NOT NULL
          ON DUPLICATE KEY UPDATE patient_id = patient_phone_contacts.patient_id
          `);
          await trx.raw(`
          INSERT INTO patient_phone_contacts (patient_id, position, phone, relationship, contact_name, owner_patient_id)
          SELECT patientid, 1, backup_phone, COALESCE(NULLIF(backup_relationship, ''), 'relative'), backup_contact_name, backup_patient_id
          FROM new_patients WHERE NULLIF(TRIM(backup_phone), '') IS NOT NULL
          ON DUPLICATE KEY UPDATE patient_id = patient_phone_contacts.patient_id
          `);
     });
}
