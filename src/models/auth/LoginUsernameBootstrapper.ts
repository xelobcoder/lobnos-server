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

export async function bootstrapLoginUsernames(tenantId = 1): Promise<void> {
     try {
          const connection = await KnexConnection(tenantId);
          const prefix = await getLabLoginPrefix(tenantId, connection);

          if (await connection.schema.hasTable('roles')) {
               await ensureLoginUsernameColumn(connection, 'roles', 'idx_roles_login_username');
               if (!(await connection.schema.hasColumn('roles', 'staff_designation'))) {
                    await connection.schema.alterTable('roles', (table) => {
                         table.string('staff_designation', 100).nullable();
                    });
               }
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
