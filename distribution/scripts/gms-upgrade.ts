import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { configuration } from '../src/hooks/configuration';
import { assessLegacySchema } from '../src/database/legacy-upgrade/LegacySchema';
import { applyReviewedGmsColumns } from '../src/database/legacy-upgrade/ReviewedGmsColumns';

async function main() {
    const args = process.argv.slice(2);
    const value = (name: string) => {
        const index = args.indexOf(name), result = args[index + 1];
        if (index < 0 || !result || result.startsWith('--')) throw new Error(`Required option ${name}`);
        return result;
    };
    const database = value('--database'), reference = value('--reference'), manifestFile = path.resolve(value('--backup-manifest'));
    const expected = process.env.NODE_ENV === 'production' ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
    if (database !== 'gmsprimelab' || database !== expected) throw new Error('This reviewed profile is restricted to the configured original gmsprimelab database');
    process.env.PLS_LEGACY_SCHEMA_UPGRADE = 'true';
    configuration.isMultiTenant = false;
    configuration.desktopStandalone = true;
    const { singleTenantKnexInstance: db } = await import('../src/database/connection');
    const { TenantRegistry } = await import('../src/models/Tenancy/TenantRegistry');
    const tenant = await new TenantRegistry().getLocalTenant();
    if (!tenant || tenant.tenantId !== configuration.defaultTenantId) throw new Error('Configured GMS registration and tenant identity must match before applying');
    const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
    const verified = JSON.parse(await fs.readFile(path.join(path.dirname(manifestFile), 'restore-verification.json'), 'utf8'));
    if (manifest.database !== database || manifest.tenantId !== tenant.tenantId || verified.database !== database || verified.restore !== manifest.restoreDatabase || !verified.tables?.length) throw new Error('A verified GMS restore snapshot is required');
    if (path.basename(manifest.filename) !== manifest.filename || !manifest.sha256) throw new Error('Invalid backup filename or missing fingerprint');
    const digest = crypto.createHash('sha256');
    for await (const chunk of createReadStream(path.join(path.dirname(manifestFile), manifest.filename))) digest.update(chunk);
    if (digest.digest('hex') !== manifest.sha256) throw new Error('Encrypted backup fingerprint does not match');
    for (const table of verified.tables) {
        const restored = await db(table.table).withSchema(verified.restore).count({ count: '*' }).first();
        if (Number(restored?.count) !== Number(table.rows)) throw new Error(`Restore verification no longer matches ${table.table}`);
    }
    const connection = await db.client.acquireConnection();
    let locked = false;
    try {
        const [lock] = await db.raw('SELECT GET_LOCK(?, 0) acquired', [`pls_schema_upgrade:${database}`]).connection(connection);
        if (Number(lock[0].acquired) !== 1) throw new Error('Another GMS upgrade already holds the maintenance lock');
        locked = true;
        const { normalizeTenantCollation } = await import('../src/database/legacy-upgrade/TenantCollation');
        await normalizeTenantCollation(db);
        const plan = await assessLegacySchema(db, database, reference);
        console.log(JSON.stringify({ database, tenantId: tenant.tenantId, compatibilitySteps: plan.steps.length, phase: 'applying' }));
        for (const step of plan.steps) {
            if (step.column && await db.schema.hasColumn(step.table, step.column)) continue;
            await db.raw(step.sql);
        }
        const reviewed = await applyReviewedGmsColumns(db);
        console.log(JSON.stringify({ phase: 'reviewed-columns', ...reviewed }));
        const { runApplicationBootstrappers } = await import('../src/bootstrap/applicationStartup');
        const bootstrap = await runApplicationBootstrappers(tenant.tenantId, true, { startWorkers: false });
        const repeat = await applyReviewedGmsColumns(db);
        if (repeat.changed.length) throw new Error('Bootstrap changed a reviewed definition; rerun and review before service restart');
        const report = { database, tenantId: tenant.tenantId, platformId: tenant.platformId, compatibilitySteps: plan.steps.length,
            reviewed, reviewedColumnsStableAfterBootstrap: true, ...bootstrap, backgroundWorkersStarted: false, completedAt: new Date().toISOString() };
        await fs.writeFile(path.join(path.dirname(manifestFile), 'migration-result.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
        console.log(JSON.stringify(report));
    } finally {
        if (locked) await db.raw('SELECT RELEASE_LOCK(?)', [`pls_schema_upgrade:${database}`]).connection(connection);
        await db.client.releaseConnection(connection);
        await db.destroy();
    }
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
