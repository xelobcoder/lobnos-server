/**
 * Tenant registry administration.
 *
 * Registry and login usernames migrate automatically at application startup.
 * These commands are optional administration/reporting tools:
 *   pnpm tenants                            list organizations and six-digit tenant IDs
 *   pnpm tenants --set-code 123456 ABDIML   update facility metadata (not its login prefix)
 *   pnpm tenants --migrate 123456          recheck organization-prefix/account usernames
 *   pnpm tenants --migrate all             same, for every tenant this server serves
 *   pnpm tenants --migrate-tenant-ids       recheck legacy short internal IDs
 */
import { listServedTenants, TenantRegistry } from '../src/models/Tenancy/TenantRegistry';
import { bootstrapLoginUsernames } from '../src/models/auth/LoginUsernameBootstrapper';
import KnexConnection from '../src/database/KnexConnections';

async function listTenants(): Promise<void> {
     const tenants = await new TenantRegistry().listTenants();
     console.table(tenants.map((tenant) => ({
          tenantId: tenant.tenantId,
          organizationNumber: tenant.organizationNumber,
          facilityCode: tenant.facilityCode,
          platformId: tenant.platformId,
          name: tenant.name,
          database: tenant.databaseName,
          status: tenant.status,
     })));
}

async function migrate(tenantIds: number[]): Promise<void> {
     for (const tenantId of tenantIds) {
          await bootstrapLoginUsernames(tenantId);
          const connection = await KnexConnection(tenantId);
          for (const account of [
               { table: 'roles', id: 'employeeid' },
               { table: 'patients_credentials', id: 'patientid' },
               { table: 'clinicianscredentials', id: 'clinicianid' },
          ]) {
               if (!(await connection.schema.hasTable(account.table))) continue;
               const rows = await connection(account.table).select(account.id, 'legacy_login_username', 'login_username').orderBy(account.id);
               console.log(`\nTenant ${tenantId} ${account.table} usernames:`);
               console.table(rows);
          }
     }
}

async function main(): Promise<void> {
     const args = process.argv.slice(2);
     await TenantRegistry.ensureReady();

     if (args.includes('--migrate-tenant-ids')) {
          const mappings = await new TenantRegistry().migrateLegacyTenantNumbers();
          console.table(mappings);
          await migrate(mappings.map((mapping) => mapping.tenantId));
          console.log('Tenant IDs are also checked automatically at startup. Users with old tenant IDs in their sessions must sign in again.');
          return;
     }
     const setCodeIndex = args.indexOf('--set-code');
     if (setCodeIndex >= 0) {
          const tenantId = Number(args[setCodeIndex + 1]);
          const code = String(args[setCodeIndex + 2] || '');
          await new TenantRegistry().setFacilityCode(tenantId, code);
          console.log(`Tenant ${tenantId} now uses facility code ${code.toUpperCase()}`);
          return;
     }

     const migrateIndex = args.indexOf('--migrate');
     if (migrateIndex >= 0) {
          const target = args[migrateIndex + 1];
          const tenantIds = target === 'all' ? (await listServedTenants()).map((tenant) => tenant.tenantId) : [Number(target)];
          for (const tenantId of tenantIds) {
               if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || tenantId > 999999 ||
                    !(await new TenantRegistry().getTenant(tenantId))) {
                    throw new Error('Migration requires a registered tenant ID between 1 and 999999');
               }
          }
          await migrate(tenantIds);
          return;
     }

     await listTenants();
}

main()
     .then(() => process.exit(0))
     .catch((error) => {
          console.error(error?.message || error);
          process.exit(1);
     });
