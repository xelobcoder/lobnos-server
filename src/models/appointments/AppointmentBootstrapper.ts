import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { up as migrateAppointmentWorkflow } from '../../cron/command-line-tool-database/migrations/20261023_appointment_workflow';

const TABLE = 'appointments';

async function hasIndex(connection: Knex, indexName: string): Promise<boolean> {
     const [rows] = await connection.raw(
          'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1',
          [TABLE, indexName]
     );
     return Array.isArray(rows) && rows.length > 0;
}

async function ensureIndex(connection: Knex, column: string, indexName: string): Promise<void> {
     if (await hasIndex(connection, indexName)) return;
     await connection.schema.alterTable(TABLE, (table) => {
          table.index([column], indexName);
     });
}

/**
 * Widens `patientid` to NULL so lead-only appointments can be stored. Only applied when the
 * column has the expected legacy type; anything else is left untouched and logged.
 */
async function ensurePatientIdNullable(connection: Knex): Promise<void> {
     const [rows] = await connection.raw(
          'SELECT IS_NULLABLE AS is_nullable, COLUMN_TYPE AS column_type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
          [TABLE, 'patientid']
     );
     const column = Array.isArray(rows) ? rows[0] : undefined;
     if (!column || String(column.is_nullable).toUpperCase() === 'YES') return;
     if (!/^int(\(\d+\))? unsigned$/i.test(String(column.column_type).trim())) {
          logger.warn(`[Bootstrap] appointments.patientid has unexpected type ${column.column_type}; lead-only appointments disabled until reviewed`);
          return;
     }
     await connection.raw('ALTER TABLE `appointments` MODIFY COLUMN `patientid` INT UNSIGNED NULL');
}

/**
 * Additive, idempotent appointment metadata migration (per tenant):
 *   appointment_type VARCHAR(30) NULL DEFAULT 'consultation'  (legacy rows backfilled by the default)
 *   lead_id          INT UNSIGNED NULL  -> leads.id
 *   billingid        INT UNSIGNED NULL  -> billing.billingid (lab/ultrasound workflow)
 *   patientid        widened to NULL (no data change)
 * No foreign keys are added so legacy/orphan rows and tenants without CRM tables keep working.
 */
export async function bootstrapAppointmentTables(tenantId: number): Promise<void> {
     const connection = await KnexConnection(tenantId);
     if (!(await connection.schema.hasTable(TABLE))) {
          logger.info(`[Bootstrap] Tenant ${tenantId}: ${TABLE} table not present, appointment metadata migration skipped`);
          return;
     }

     if (!(await connection.schema.hasColumn(TABLE, 'appointment_type'))) {
          await connection.schema.alterTable(TABLE, (table) => {
               table.string('appointment_type', 30).nullable().defaultTo('consultation');
          });
     }
     if (!(await connection.schema.hasColumn(TABLE, 'lead_id'))) {
          await connection.schema.alterTable(TABLE, (table) => {
               table.integer('lead_id').unsigned().nullable();
          });
     }
     if (!(await connection.schema.hasColumn(TABLE, 'billingid'))) {
          await connection.schema.alterTable(TABLE, (table) => {
               table.integer('billingid').unsigned().nullable();
          });
     }

     await ensureIndex(connection, 'appointment_type', 'idx_appointments_type');
     await ensureIndex(connection, 'lead_id', 'idx_appointments_lead');
     await ensureIndex(connection, 'billingid', 'idx_appointments_billing');
     await ensureIndex(connection, 'appointment_date', 'idx_appointments_date');
     await ensurePatientIdNullable(connection);
     await migrateAppointmentWorkflow(connection);
}
