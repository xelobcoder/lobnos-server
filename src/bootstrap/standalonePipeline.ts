import fs from 'fs';
import path from 'path';
import { Knex } from 'knex';
import { LocalProvisionError } from './standaloneProvisioning';
import { safeDatabaseIdentifier } from '../models/Tenancy/FacilitySchema';

/** Reviewed up migrations only; never replay legacy base migrations or transaction/demo seeds. */
export const LOCAL_MIGRATIONS = [
     '20260716_drop_tax_configuration_relief_columns',
     '20260716_drop_tax_configuration_statutory_columns',
     '20260716_dynamic_payroll_rules',
     '20260807_email_module',
     '20260807_email_module_activation',
     '20260807_notification_foundation',
     '20260812_backup_security_settings_password',
     '20260820_advanced_commission_calculations',
     '20260829_result_value_analytics',
     '20260901_pharmacy_item_profiles',
     '20260901_pharmacy_pos_sales',
     '20261004_commission_recipient_policy',
     '20261012_workspace_layout',
     '20261012_workspace_ribbon',
     '20261013_sms_provider_settings',
     '20261018_registration_prompt_settings',
     '20261018_optional_clinician_phone',
     '20261018_clinician_organizations',
     '20261018_staff_pin_security',
     '20261018_workspace_portal',
     '20261019_patient_portal',
     '20261020_patient_billing_requests',
     '20261021_patient_portal_engagement',
     '20261022_organization_credit_invoices',
     '20261023_appointment_workflow',
     '20261023_supplier_payment_funding',
     '20261023_operations_workflow_integrity',
     '20261023_referrer_acquisition_crm',
     '20261023_crm_relationship_workflow',
] as const;
export const LOCAL_REFERENCE_MODULES = [
     '01_regions', '01_sample_containers', '02_application_settings', '05_payment_modes',
     '07_departments', '08_sampletypes', 'districts', 'registrationfields', 'shifts',
] as const;

export function verifyLocalPipelineAssets(): void {
     const root = path.resolve(__dirname, '../cron/command-line-tool-database');
     const extension = __filename.endsWith('.ts') ? '.ts' : '.js';
     const directory = path.join(root, 'migrations');
     try {
          const actual = fs.readdirSync(directory).filter(name => name.endsWith(extension)).sort();
          const expected = LOCAL_MIGRATIONS.map(name => name + extension).sort();
          if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error();
          for (const name of LOCAL_REFERENCE_MODULES) {
               if (!fs.statSync(path.join(root, 'Seeds', name + extension)).isFile()) throw new Error();
          }
          if (!fs.statSync(path.join(__dirname, 'applicationStartup' + extension)).isFile()) throw new Error();
     } catch {
          throw new LocalProvisionError('Provisioning pipeline prerequisite failed: reviewed migrations, reference seeds or runtime bootstrappers are missing or changed. Rebuild with the complete reviewed baseline; no databases were created.');
     }
}

export async function migrateLocalInstallation(db: Knex): Promise<void> {
     // MySQL DDL is not transactional. All up functions are guarded/retryable and Knex
     // records completed migrations; partial failures are not marked ready.
     await db.migrate.latest({
          directory: path.resolve(__dirname, '../cron/command-line-tool-database/migrations'),
          loadExtensions: ['.js'], extension: 'js', disableTransactions: true,
          tableName: 'pls_local_migrations',
     });
}

/** Re-enabling FOREIGN_KEY_CHECKS does not validate rows imported while checks were off. */
export async function verifyLocalForeignKeys(db: Knex, database: string): Promise<void> {
     safeDatabaseIdentifier(database);
     const [keys] = await db.raw(`SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
          REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
          ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`, [database]);
     const groups = new Map<string, any[]>();
     for (const key of keys) {
          if (String(key.REFERENCED_TABLE_SCHEMA).toLowerCase() !== database.toLowerCase()) {
               throw new LocalProvisionError('Local schema contains a cross-database foreign key. Readiness was refused.');
          }
          for (const identifier of [key.TABLE_NAME, key.COLUMN_NAME, key.REFERENCED_TABLE_NAME, key.REFERENCED_COLUMN_NAME]) {
               safeDatabaseIdentifier(identifier);
          }
          const name = `${key.TABLE_NAME}:${key.CONSTRAINT_NAME}`;
          groups.set(name, [...(groups.get(name) || []), key]);
     }
     for (const columns of groups.values()) {
          const first = columns[0];
          const joins = columns.map(() => 'c.?? = p.??').join(' AND ');
          const nonNull = columns.map(() => 'c.?? IS NOT NULL').join(' AND ');
          const [orphans] = await db.raw(`SELECT 1 FROM ??.?? c LEFT JOIN ??.?? p ON ${joins}
               WHERE ${nonNull} AND p.?? IS NULL LIMIT 1`,
               [database, first.TABLE_NAME, database, first.REFERENCED_TABLE_NAME,
                    ...columns.flatMap(column => [column.COLUMN_NAME, column.REFERENCED_COLUMN_NAME]),
                    ...columns.map(column => column.COLUMN_NAME), first.REFERENCED_COLUMN_NAME]);
          if (orphans.length) throw new LocalProvisionError('Local reference data has unresolved foreign keys. Readiness was refused; ask an administrator to repair the reviewed catalog, not delete existing data.');
     }
}
