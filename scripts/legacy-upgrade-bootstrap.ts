import { configuration } from '../src/hooks/configuration';

async function main() {
    const args = process.argv.slice(2);
    const database = args[args.indexOf('--database') + 1];
    const expected = process.env.NODE_ENV === 'production' ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
    if (!args.includes('--database') || !database || database !== expected) {
        throw new Error('Pass --database with the exact configured database name');
    }
    // A maintenance command must never enumerate or bootstrap other registered facilities.
    process.env.PLS_LEGACY_SCHEMA_UPGRADE = 'true';
    configuration.isMultiTenant = false;
    configuration.desktopStandalone = true;
    const { TenantRegistry } = await import('../src/models/Tenancy/TenantRegistry');
    const registry = new TenantRegistry();
    const tenant = await registry.getLocalTenant();
    if (!tenant || tenant.tenantId !== configuration.defaultTenantId) {
        throw new Error('Register this database and set its DEFAULT_TENANT_ID before upgrading');
    }
    const { runApplicationBootstrappers } = await import('../src/bootstrap/applicationStartup');
    const result = await runApplicationBootstrappers(tenant.tenantId, true, { startWorkers: false });
    console.log(JSON.stringify({ database, tenantId: tenant.tenantId, ...result, backgroundWorkersStarted: false }));
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
