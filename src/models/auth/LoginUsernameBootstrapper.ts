import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';

type LoginEntityType = 'staff' | 'patient' | 'clinician';

function normalizeCode(value: unknown, fallback: string): string {
     const normalized = String(value || '')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 8);
     return normalized || fallback;
}

function initialsFromName(value: unknown): string {
     return String(value || '')
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part.charAt(0))
          .join('');
}

export async function getLabLoginPrefix(tenantId: number, connectionOverride?: Knex | Knex.Transaction): Promise<string> {
     const connection = connectionOverride || await KnexConnection(tenantId);
     let labPrefix = 'PLS';
     let regionPrefix = 'RG';

     try {
          const settings = await connection('applicationsettings').where({ keyid: 1 }).first();
          const company = await connection('companyprofile').first();
          labPrefix = normalizeCode(settings?.patientIdPrefix || initialsFromName(company?.NAME || company?.name), 'PLS');

          if (settings?.regioncode && await connection.schema.hasTable('regions')) {
               const region = await connection('regions').select('regioncode').where({ id: settings.regioncode }).first();
               regionPrefix = normalizeCode(region?.regioncode, 'RG');
          }
     } catch (error) {
          logger.error('[LoginUsernameBootstrapper] Failed to resolve lab login prefix:', error);
     }

     return `${labPrefix}${regionPrefix}`;
}

export function buildLoginUsername(prefix: string, entityType: LoginEntityType, id: number): string {
     const typeCode = entityType === 'staff' ? 'S' : entityType === 'patient' ? 'P' : 'C';
     return `${prefix}${typeCode}${String(id).padStart(4, '0')}`;
}

async function ensureLoginUsernameColumn(connection: Knex, tableName: string, indexName: string): Promise<void> {
     if (!(await connection.schema.hasColumn(tableName, 'login_username'))) {
          await connection.schema.alterTable(tableName, (table) => {
               table.string('login_username', 64).nullable().index(indexName);
          });
     }
}

/**
 * The legacy `roles.role` column was created as a restrictive ENUM that predates
 * newer roles (clinician, pharmacy_*, customer service representative, super_admin, ...).
 * MySQL truncates any value not in the enum ("Data truncated for column 'role'").
 * Widen it once to a VARCHAR so all current and future roles are accepted.
 * Idempotent: only runs when the column is not already a native varchar.
 */
async function ensureRoleColumnIsVarchar(connection: Knex): Promise<void> {
     try {
          const [rows]: any = await connection.raw(
               `SELECT DATA_TYPE AS data_type FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'role'`
          );
          const dataType = String(rows?.[0]?.data_type || '').toLowerCase();
          if (dataType && dataType !== 'varchar') {
               await connection.raw(
                    `ALTER TABLE roles MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'scientist'`
               );
               logger.info(`[Bootstrap] Widened roles.role column from ${dataType} to VARCHAR(50)`);
          }
     } catch (error) {
          logger.error('[Bootstrap] Failed to widen roles.role column:', error);
     }
}

async function ensureRolesColumns(connection: Knex): Promise<void> {
     const columnsToCheck: Array<{ name: string; add: (table: Knex.CreateTableBuilder) => void }> = [
          { name: 'pin', add: (t) => t.integer('pin').unsigned().nullable().defaultTo(0) },
          { name: 'date_created', add: (t) => t.datetime('date_created').nullable().defaultTo(connection.fn.now()) },
          { name: 'refresh_token', add: (t) => t.string('refresh_token', 255).nullable() },
          { name: 'activation', add: (t) => t.boolean('activation').notNullable().defaultTo(false) },
          { name: 'updated_on', add: (t) => t.datetime('updated_on', { precision: 6 }).nullable() },
          { name: 'emailAuthenticated', add: (t) => t.string('emailAuthenticated', 6).notNullable().defaultTo('false') },
          { name: 'branch', add: (t) => t.integer('branch').unsigned().nullable() },
          { name: 'mobile', add: (t) => t.string('mobile', 10).nullable() },
          { name: 'alternativeMobile', add: (t) => t.string('alternativeMobile', 10).nullable() },
          { name: 'dob', add: (t) => t.date('dob').nullable() },
          { name: 'time', add: (t) => t.datetime('time', { precision: 6 }).nullable() },
          { name: 'firstname', add: (t) => t.string('firstname', 100).nullable() },
          { name: 'middlename', add: (t) => t.string('middlename', 100).nullable() },
          { name: 'lastname', add: (t) => t.string('lastname', 100).nullable() },
          { name: 'designation', add: (t) => t.integer('designation').nullable() },
          { name: 'staff_designation', add: (t) => t.string('staff_designation', 100).nullable() }
     ];

     for (const col of columnsToCheck) {
          if (!(await connection.schema.hasColumn('roles', col.name))) {
               await connection.schema.alterTable('roles', (table) => {
                    col.add(table);
               });
               logger.info(`[Bootstrap] Added missing column roles.${col.name}`);
          }
     }
}

export async function bootstrapLoginUsernames(tenantId = 1): Promise<void> {
     try {
          const connection = await KnexConnection(tenantId);
          const prefix = await getLabLoginPrefix(tenantId, connection);

          if (await connection.schema.hasTable('roles')) {
               await ensureRoleColumnIsVarchar(connection);
               await ensureRolesColumns(connection);
               await ensureLoginUsernameColumn(connection, 'roles', 'idx_roles_login_username');
               const rows = await connection('roles')
                    .select('employeeid')
                    .where((builder) => builder.whereNull('login_username').orWhere('login_username', ''));

               for (const row of rows) {
                    await connection('roles')
                         .where({ employeeid: row.employeeid })
                         .update({ login_username: buildLoginUsername(prefix, 'staff', Number(row.employeeid)) });
               }
          }

          if (await connection.schema.hasTable('patients_credentials')) {
               await ensureLoginUsernameColumn(connection, 'patients_credentials', 'idx_patient_credentials_login_username');
               const rows = await connection('patients_credentials')
                    .select('patientid')
                    .where((builder) => builder.whereNull('login_username').orWhere('login_username', ''));

               for (const row of rows) {
                    await connection('patients_credentials')
                         .where({ patientid: row.patientid })
                         .update({ login_username: buildLoginUsername(prefix, 'patient', Number(row.patientid)) });
               }
          }

          if (await connection.schema.hasTable('clinicianscredentials')) {
               await ensureLoginUsernameColumn(connection, 'clinicianscredentials', 'idx_clinicians_credentials_login_username');
               if (!(await connection.schema.hasColumn('clinicianscredentials', 'email'))) {
                    await connection.schema.alterTable('clinicianscredentials', (table) => {
                         table.string('email', 255).nullable();
                    });
               }
               if (!(await connection.schema.hasColumn('clinicianscredentials', 'ispasswordUpdated'))) {
                    await connection.schema.alterTable('clinicianscredentials', (table) => {
                         table.tinyint('ispasswordUpdated').notNullable().defaultTo(0);
                    });
               }
               const rows = await connection('clinicianscredentials')
                    .select('clinicianid')
                    .where((builder) => builder.whereNull('login_username').orWhere('login_username', ''));

               for (const row of rows) {
                    await connection('clinicianscredentials')
                         .where({ clinicianid: row.clinicianid })
                         .update({ login_username: buildLoginUsername(prefix, 'clinician', Number(row.clinicianid)) });
               }
          }
     } catch (error) {
          logger.error('[LoginUsernameBootstrapper] Failed to bootstrap login usernames:', error);
     }
}
