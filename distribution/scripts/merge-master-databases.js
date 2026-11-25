/**
 * Merges the two legacy master databases (`pls_master_platform` and `system_configuration`)
 * into a single control database, `primelabmaster_control` by default.
 *
 * - Source databases are never modified or dropped.
 * - Safe to re-run: tables are created only when missing and rows are copied with INSERT IGNORE.
 * - Triggers are dropped before copying (so they do not rewrite copied rows) and recreated afterwards.
 *
 * Usage: npm run master:merge [-- --target=primelabmaster_control --sources=pls_master_platform,system_configuration]
 */
const mysql = require('mysql2/promise');

const args = Object.fromEntries(
     process.argv.slice(2)
          .filter((arg) => arg.startsWith('--'))
          .map((arg) => {
               const [key, ...rest] = arg.slice(2).split('=');
               return [key, rest.join('=')];
          })
);

const target = args.target || 'primelabmaster_control';
const sources = (args.sources || 'pls_master_platform,system_configuration').split(',').map((s) => s.trim()).filter(Boolean);
const identifierPattern = /^[A-Za-z0-9_]+$/;

for (const name of [target, ...sources]) {
     if (!identifierPattern.test(name)) throw new Error(`Invalid database name: ${name}`);
}
if (sources.includes(target)) throw new Error('Target database must differ from the source databases');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function main() {
     const connection = await mysql.createConnection({
          host: process.env.SYSTEM_CONFIG_DB_HOST || process.env.DB_HOST,
          user: process.env.SYSTEM_CONFIG_DB_USERNAME || process.env.DB_USERNAME,
          password: process.env.SYSTEM_CONFIG_DB_PASSWORD || process.env.DB_PASSWORD,
          port: Number(process.env.SYSTEM_CONFIG_DB_PORT || process.env.DB_PORT),
          multipleStatements: false,
     });

     try {
          await connection.query(`CREATE DATABASE IF NOT EXISTS \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
          await connection.query(`USE \`${target}\``);
          await connection.query('SET FOREIGN_KEY_CHECKS = 0');

          const owners = new Map();
          const triggers = [];

          for (const source of sources) {
               const [exists] = await connection.query('SHOW DATABASES LIKE ?', [source]);
               if (exists.length === 0) {
                    console.warn(`Source database "${source}" not found; skipping.`);
                    continue;
               }

               const [sourceTriggers] = await connection.query(
                    'SELECT TRIGGER_NAME FROM information_schema.triggers WHERE TRIGGER_SCHEMA = ?',
                    [source]
               );
               for (const { TRIGGER_NAME } of sourceTriggers) {
                    const [[definition]] = await connection.query(`SHOW CREATE TRIGGER \`${source}\`.\`${TRIGGER_NAME}\``);
                    const sql = String(definition['SQL Original Statement'])
                         .replace(/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/i, '')
                         .replace(new RegExp(`\`?${escapeRegex(source)}\`?\\.`, 'g'), '');
                    triggers.push({ name: TRIGGER_NAME, sql, source });
                    await connection.query(`DROP TRIGGER IF EXISTS \`${target}\`.\`${TRIGGER_NAME}\``);
               }

               const [tables] = await connection.query(
                    "SELECT TABLE_NAME FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
                    [source]
               );

               for (const { TABLE_NAME: table } of tables) {
                    if (owners.has(table)) {
                         console.warn(`Table "${table}" exists in both ${owners.get(table)} and ${source}; keeping the ${owners.get(table)} copy.`);
                         continue;
                    }
                    owners.set(table, source);

                    const [targetHasTable] = await connection.query(
                         'SELECT 1 FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                         [target, table]
                    );
                    if (targetHasTable.length === 0) {
                         const [[createRow]] = await connection.query(`SHOW CREATE TABLE \`${source}\`.\`${table}\``);
                         await connection.query(createRow['Create Table']);
                         console.log(`Created ${target}.${table}`);
                    }

                    const [copy] = await connection.query(`INSERT IGNORE INTO \`${target}\`.\`${table}\` SELECT * FROM \`${source}\`.\`${table}\``);
                    console.log(`Copied ${source}.${table} -> ${target}.${table} (${copy.affectedRows} new rows)`);
               }
          }

          for (const trigger of triggers) {
               await connection.query(trigger.sql);
               console.log(`Recreated trigger ${trigger.name} (from ${trigger.source})`);
          }

          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
          console.log(`\nDone. Point SYSTEM_CONFIG_DATABASE=${target} in .env, then restart the server.`);
     } finally {
          await connection.end();
     }
}

main().catch((error) => {
     console.error('Master database merge failed:', error.message);
     process.exit(1);
});
