/** Read-only planner. Never imports application startup or mutates the registry. */
import knex from 'knex';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assessLegacySchema, renderLegacyUpgradeSql } from '../src/database/legacy-upgrade/LegacySchema';
import { databaseTlsOptions } from '../src/database/tls';

async function main() {
    const args = process.argv.slice(2);
    const option = (name: string) => {
        const value = args[args.indexOf(name) + 1];
        if (!value || value.startsWith('--')) throw new Error(`A value is required for ${name}`);
        return value;
    };
    if (!args.includes('--database') || !args.includes('--reference') || !args.includes('--output')) {
        throw new Error('Usage: npm run tenant:upgrade-plan -- --database CLIENT_DB --reference REVIEWED_CURRENT_DB --output DIRECTORY');
    }
    const database = option('--database'), reference = option('--reference'), output = path.resolve(option('--output'));
    const production = process.env.NODE_ENV === 'production';
    const host = (production ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST)!;
    const db = knex({ client: 'mysql2', connection: {
        host, ...databaseTlsOptions(host),
        user: production ? process.env.PRODUCTION_DB_USERNAME : process.env.DB_USERNAME,
        password: production ? process.env.PRODUCTION_DB_PASSWORD : process.env.DB_PASSWORD,
        port: Number((production ? process.env.PRODUCTION_DB_PORT : process.env.DB_PORT) || 3306),
    }, pool: { min: 0, max: 1 } });
    try {
        const plan = await assessLegacySchema(db, database, reference);
        await mkdir(output, { recursive: true });
        await writeFile(path.join(output, 'assessment.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
        await writeFile(path.join(output, 'compatibility.sql'), renderLegacyUpgradeSql(plan), { flag: 'wx' });
        console.log(JSON.stringify({ database, reference, existingTables: plan.existingTables, additiveSteps: plan.steps.length, reviewItems: plan.review.length, output }, null, 2));
    } finally { await db.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
