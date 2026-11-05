import { writeFile } from 'node:fs/promises';
import knex, { Knex } from 'knex';
import { databaseTlsOptions } from '../database/tls';
import { auditTenantCollation } from '../database/legacy-upgrade/TenantCollationAudit';
import { UNICODE_CI_PROTOCOL_ID } from '../database/legacy-upgrade/SchemaCollationPolicy';

async function main() {
    const args = process.argv.slice(2);
    const value = (flag: string) => {
        const index = args.indexOf(flag);
        if (index < 0) return undefined;
        const result = args[index + 1];
        if (!result || result.startsWith('--')) throw new Error(`Missing value for ${flag}`);
        return result;
    };
    const registered = args.includes('--registered');
    const database = value('--database');
    const output = value('--output');
    if (registered === Boolean(database)) throw new Error('Choose exactly one: --registered or --database CONFIGURED_DATABASE');
    for (let index = 0; index < args.length; index++) {
        if (args[index] === '--registered') continue;
        if (['--database', '--output'].includes(args[index])) { index++; continue; }
        throw new Error(`Unknown option ${args[index]}`);
    }
    const production = process.env.NODE_ENV === 'production';
    const host = production ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST;
    const base = {
        host,
        port: Number(production ? process.env.PRODUCTION_DB_PORT || 2309 : process.env.DB_PORT || 3306),
        user: production ? process.env.PRODUCTION_DB_USERNAME : process.env.DB_USERNAME,
        password: production ? process.env.PRODUCTION_DB_PASSWORD : process.env.DB_PASSWORD,
        connectTimeout: 10000,
        charsetNumber: UNICODE_CI_PROTOCOL_ID,
    };
    const configured = production ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
    if (!registered && database !== configured) throw new Error('--database must match the configured installation database');
    type Target = { database: string; host: string; port: number };
    let targets: Target[] = [{ database, host, port: base.port }];
    if (registered) {
        const controlHost = process.env.SYSTEM_CONFIG_DB_HOST || host;
        const control = knex({
            client: 'mysql2',
            connection: {
                ...base, host: controlHost,
                port: Number(process.env.SYSTEM_CONFIG_DB_PORT || base.port),
                user: process.env.SYSTEM_CONFIG_DB_USERNAME || base.user,
                password: process.env.SYSTEM_CONFIG_DB_PASSWORD || base.password,
                database: process.env.SYSTEM_CONFIG_DATABASE || 'primelabmaster_control',
                ...databaseTlsOptions(controlHost, 'SYSTEM_CONFIG_DB'),
            },
            pool: { min: 0, max: 1 },
        });
        try {
            const rows = await control('prime_tenants').select('database_name', 'db_connection_string')
                .where('status', 'active').whereNull('deleted_at').orderBy('database_name');
            targets = rows.map(row => {
                let endpoint: URL | undefined;
                if (row.db_connection_string) {
                    try { endpoint = new URL(row.db_connection_string); }
                    catch { throw new Error(`Invalid registered database endpoint for ${row.database_name}`); }
                }
                return { database: row.database_name, host: endpoint?.hostname || host, port: Number(endpoint?.port || base.port) };
            });
        } finally { await control.destroy(); }
        if (!targets.length) throw new Error('No active tenants were returned; an empty registry is not a successful fleet audit');
    }
    const results: Array<Awaited<ReturnType<typeof auditTenantCollation>> | { database: string; compliant: false; error: string }> = [];
    for (const target of targets) {
        let db: Knex | undefined;
        try {
            db = knex({
                client: 'mysql2',
                connection: { ...base, ...target, ...databaseTlsOptions(target.host) },
                pool: { min: 0, max: 1 },
                acquireConnectionTimeout: 15000,
            });
            results.push(await auditTenantCollation(db));
        } catch (error) {
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'AUDIT_FAILED';
            results.push({ database: target.database, compliant: false, error: code });
        } finally { if (db) await db.destroy(); }
    }
    const report = {
        checkedAt: new Date().toISOString(),
        scope: registered ? 'Active registered database endpoints' : 'Configured installation database',
        readOnly: true,
        results,
    };
    if (output) await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
    if (results.some(result => 'error' in result)) process.exitCode = 2;
    else if (results.some(result => !result.compliant)) process.exitCode = 1;
}

main().catch(error => {
    console.error('Collation audit failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 2;
});
