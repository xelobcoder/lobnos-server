import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeTenantCollation } from '../src/database/legacy-upgrade/TenantCollation';

async function main() {
    const args = process.argv.slice(2);
    const option = (name: string) => { const index = args.indexOf(name), value = args[index + 1]; if (index < 0 || !value || value.startsWith('--')) throw new Error(`Required option ${name}`); return value; };
    const database = option('--database'), manifestFile = path.resolve(option('--backup-manifest')), output = path.resolve(option('--output'));
    const expected = process.env.NODE_ENV === 'production' ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
    if (database !== expected) throw new Error('Collation upgrade requires the exact configured database');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    const verification = JSON.parse(await readFile(path.join(path.dirname(manifestFile), 'restore-verification.json'), 'utf8'));
    if (![manifest.database, manifest.restoreDatabase].includes(database) || verification.database !== manifest.database || verification.restore !== manifest.restoreDatabase || !manifest.sha256) throw new Error('A verified backup and restore are required');
    if (path.basename(manifest.filename) !== manifest.filename) throw new Error('Invalid backup path');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(path.join(path.dirname(manifestFile), manifest.filename))) hash.update(chunk);
    if (hash.digest('hex') !== manifest.sha256) throw new Error('Backup fingerprint changed');
    const { singleTenantKnexInstance: db } = await import('../src/database/connection');
    try {
        const result = await normalizeTenantCollation(db);
        await writeFile(output, JSON.stringify({ database, ...result, completedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
        console.log(JSON.stringify({ database, changedTables: result.changedTables.length, preservedCaseSensitiveColumns: result.preservedCaseSensitiveColumns }));
    } finally { await db.destroy(); }
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
