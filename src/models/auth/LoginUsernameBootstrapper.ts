import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import bcrypt from 'bcrypt';
import { effectiveTenantId } from '../../hooks/configuration';
import { formatLoginUsername, LoginEntityType } from './TenantLoginDirectory';
import { TenantRegistry } from '../Tenancy/TenantRegistry';

const LOGIN_ACCOUNTS: Array<{ table: string; id: string; previous: string; type: LoginEntityType }> = [
     { table: 'roles', id: 'employeeid', previous: 'username', type: 'staff' },
     { table: 'patients_credentials', id: 'patientid', previous: 'username', type: 'patient' },
     { table: 'clinicianscredentials', id: 'clinicianid', previous: 'identifier', type: 'clinician' },
];

/** Migrates tenant-local login IDs, preserving historical usernames and all display/clinical fields. */
export async function bootstrapLoginUsernames(tenantId: number): Promise<void> {
     const organizationId = effectiveTenantId(tenantId);
     const tenant = await new TenantRegistry().requireTenant(organizationId);
     formatLoginUsername(tenant.platformId, 'staff', 1);
     const connection = await KnexConnection(tenantId);
     for (const account of LOGIN_ACCOUNTS) {
          if (!(await connection.schema.hasTable(account.table))) continue;
          for (const column of ['login_username', 'legacy_login_username']) {
               if (!(await connection.schema.hasColumn(account.table, column))) {
                    await connection.schema.alterTable(account.table, (table) => table.string(column, 255).nullable());
               }
          }
          const hasPrevious = await connection.schema.hasColumn(account.table, account.previous);
          const prefix = `${tenant.platformId.toUpperCase()}${account.type === 'staff' ? 'S' : account.type === 'patient' ? 'P' : 'C'}`;
          const generatedLogin = "CONCAT(?, LPAD(CAST(?? AS CHAR), GREATEST(3, CHAR_LENGTH(CAST(?? AS CHAR))), '0'))";
          await connection.transaction(async (trx) => {
               const invalid = await trx(account.table).whereNull(account.id)
                    .orWhere(account.id, '<=', 0).orWhere(account.id, '>', 999999999).first();
               if (invalid) throw new Error(`Cannot migrate ${account.table}: invalid ${account.id}`);
               const needsMigration = await trx(account.table)
                    .whereRaw(`login_username IS NULL OR CAST(login_username AS BINARY) <> CAST(${generatedLogin} AS BINARY)`, [prefix, account.id, account.id])
                    .first(account.id);
               if (!needsMigration) return;
               await trx(account.table).whereNull('legacy_login_username').update({
                    legacy_login_username: hasPrevious
                         ? trx.raw('COALESCE(CONVERT(?? USING utf8mb4) COLLATE utf8mb4_bin, CONVERT(?? USING utf8mb4) COLLATE utf8mb4_bin)',
                              ['login_username', account.previous])
                         : trx.ref('login_username'),
               });
               // Clear old unique login values before assigning the deterministic new IDs.
               await trx(account.table).update({ login_username: null });
               await trx(account.table).update({
                    login_username: trx.raw(generatedLogin,
                         [prefix, account.id, account.id]),
               });
          });
          logger.info(`[Bootstrap] Checked ${account.table} login usernames for organization ${tenant.platformId} (tenant ${organizationId})`);
     }
}

async function ensureRoleColumns(connection: Knex): Promise<void> {
     const columns: Array<{ name: string; add: (table: Knex.CreateTableBuilder) => void }> = [
          { name: 'pin', add: (table) => table.integer('pin').unsigned().nullable().defaultTo(0) },
          { name: 'pin_hash', add: (table) => table.string('pin_hash', 60).nullable() },
          { name: 'date_created', add: (table) => table.datetime('date_created').nullable().defaultTo(connection.fn.now()) },
          { name: 'refresh_token', add: (table) => table.string('refresh_token', 255).nullable() },
          { name: 'activation', add: (table) => table.boolean('activation').notNullable().defaultTo(false) },
          { name: 'updated_on', add: (table) => table.datetime('updated_on', { precision: 6 }).nullable() },
          { name: 'emailAuthenticated', add: (table) => table.string('emailAuthenticated', 6).notNullable().defaultTo('false') },
          { name: 'branch', add: (table) => table.integer('branch').unsigned().nullable() },
          { name: 'mobile', add: (table) => table.string('mobile', 10).nullable() },
          { name: 'alternativeMobile', add: (table) => table.string('alternativeMobile', 10).nullable() },
          { name: 'dob', add: (table) => table.date('dob').nullable() },
          { name: 'time', add: (table) => table.datetime('time', { precision: 6 }).nullable() },
          { name: 'firstname', add: (table) => table.string('firstname', 100).nullable() },
          { name: 'middlename', add: (table) => table.string('middlename', 100).nullable() },
          { name: 'lastname', add: (table) => table.string('lastname', 100).nullable() },
          { name: 'designation', add: (table) => table.integer('designation').nullable() },
          { name: 'staff_designation', add: (table) => table.string('staff_designation', 100).nullable() },
     ];

     for (const column of columns) {
          if (!(await connection.schema.hasColumn('roles', column.name))) {
               await connection.schema.alterTable('roles', (table) => column.add(table));
               logger.info(`[Bootstrap] Added missing column roles.${column.name}`);
          }
     }

     await connection.raw('ALTER TABLE roles MODIFY COLUMN pin INT UNSIGNED NULL DEFAULT NULL');
     const legacyPins = await connection('roles').select('employeeid', 'pin')
          .whereNull('pin_hash').whereBetween('pin', [1000, 9999]);
     for (const employee of legacyPins) {
          const pinHash = await bcrypt.hash(String(employee.pin), 10);
          await connection('roles').where({ employeeid: employee.employeeid, pin: employee.pin })
               .whereNull('pin_hash').update({ pin_hash: pinHash, pin: null });
     }
}

async function ensureSessionColumns(connection: Knex): Promise<void> {
     if (!(await connection.schema.hasTable('loginlogs'))) return;
     if (await connection.schema.hasColumn('loginlogs', 'deviceFingerprint')) return;
     await connection.schema.alterTable('loginlogs', (table) => table.string('deviceFingerprint', 64).nullable());
     logger.info('[Bootstrap] Added missing column loginlogs.deviceFingerprint');
}

/** Keeps the staff schema compatible; logins use organization and account IDs, not stored usernames. */
export async function bootstrapLoginAccountSchema(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     if (await connection.schema.hasTable('roles')) await ensureRoleColumns(connection);
     if (await connection.schema.hasTable('clinicianscredentials')) {
          if (!(await connection.schema.hasColumn('clinicianscredentials', 'email'))) {
               await connection.schema.alterTable('clinicianscredentials', (table) => table.string('email', 255).nullable());
          }
          if (!(await connection.schema.hasColumn('clinicianscredentials', 'ispasswordUpdated'))) {
               await connection.schema.alterTable('clinicianscredentials', (table) => table.tinyint('ispasswordUpdated').notNullable().defaultTo(0));
          }
     }
     await ensureSessionColumns(connection);
     await bootstrapLoginUsernames(tenantId);
}
