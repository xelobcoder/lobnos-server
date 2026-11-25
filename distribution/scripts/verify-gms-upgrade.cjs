/** Compare every original row/column against the restored encrypted pre-upgrade snapshot. */
const fs = require('node:fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { databaseTlsOptions } = require('../dist/src/database/tls');
const args = process.argv.slice(2), option = name => args[args.indexOf(name) + 1];
const quote = value => '`' + value.replace(/`/g, '``') + '`';
async function main() {
    const database = option('--database'), snapshot = option('--snapshot'), output = option('--output');
    const production = process.env.NODE_ENV === 'production', p = process.env;
    if (!args.includes('--database') || !args.includes('--snapshot') || !args.includes('--output') || database !== 'gmsprimelab' || !snapshot?.startsWith('gmsprimelab_preupgrade_restore_') || !output) throw Error('Explicit GMS target, pre-upgrade restore database and output are required');
    if (database !== (production ? p.PRODUCTION_DATABASE : p.DATABASE)) throw Error('Configured database differs');
    const host = production ? p.PRODUCTION_DB_HOSTNAME : p.DB_HOST;
    const c = await mysql.createConnection({ host, ...databaseTlsOptions(host), user: production ? p.PRODUCTION_DB_USERNAME : p.DB_USERNAME,
        password: production ? p.PRODUCTION_DB_PASSWORD : p.DB_PASSWORD, port: Number((production ? p.PRODUCTION_DB_PORT : p.DB_PORT) || 3306) });
    try {
        const [tables] = await c.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [snapshot]);
        const archived = { clinician_packages: 'legacy_clinician_packages', organization_packages: 'legacy_organization_packages', commission_defaults: 'legacy_commission_defaults', dbobillingrefundtable: 'legacy_refund_witnesses' };
        const report = [];
        for (const { TABLE_NAME: source } of tables) {
            const target = archived[source] || source;
            const [original] = await c.query('SELECT COUNT(*) n FROM ??.??', [snapshot, source]);
            const [current] = await c.query('SELECT COUNT(*) n FROM ??.??', [database, target]);
            const [columns] = await c.query('SELECT COLUMN_NAME,DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION', [snapshot, source]);
            const [nowColumns] = await c.query('SELECT COLUMN_NAME,DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?', [database, target]);
            const [keys] = await c.query("SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION", [snapshot, source]);
            const missingColumns = columns.filter(col => !nowColumns.some(now => now.COLUMN_NAME.toLowerCase() === col.COLUMN_NAME.toLowerCase())).map(col => col.COLUMN_NAME);
            const compared = columns.filter(col => !missingColumns.includes(col.COLUMN_NAME) && !(source === 'roles' && ['pin', 'pin_hash'].includes(col.COLUMN_NAME)));
            const qualified = (alias, column) => alias + '.' + quote(column);
            const equality = compared.map(col => {
                const left = qualified('s', col.COLUMN_NAME), right = qualified('t', col.COLUMN_NAME);
                const currentType = nowColumns.find(now => now.COLUMN_NAME.toLowerCase() === col.COLUMN_NAME.toLowerCase())?.DATA_TYPE;
                const textual = /char|text|enum|set|json|binary|blob/.test(col.DATA_TYPE) || /char|text/.test(currentType || '');
                return textual ? `(CAST(${left} AS BINARY) <=> CAST(${right} AS BINARY))` : `(${left} <=> ${right})`;
            });
            let mismatchedRows = 0, comparison = 'empty';
            if (original[0].n && !missingColumns.length) {
                if (keys.length) {
                    const join = keys.map(key => `${qualified('s', key.COLUMN_NAME)} = ${qualified('t', key.COLUMN_NAME)}`).join(' AND ');
                    const [mismatch] = await c.query(`SELECT COUNT(*) n FROM ${quote(snapshot)}.${quote(source)} s LEFT JOIN ${quote(database)}.${quote(target)} t ON ${join} WHERE ${qualified('t', keys[0].COLUMN_NAME)} IS NULL OR NOT (${equality.join(' AND ')})`);
                    mismatchedRows = Number(mismatch[0].n); comparison = 'primary-key and null-safe original-column comparison';
                } else {
                    const values = compared.map(col => `CAST(${quote(col.COLUMN_NAME)} AS CHAR)`).join(',');
                    const checksum = `COUNT(*) n, BIT_XOR(CRC32(CAST(JSON_ARRAY(${values}) AS CHAR))) digest`;
                    const [a] = await c.query(`SELECT ${checksum} FROM ${quote(snapshot)}.${quote(source)}`);
                    const [b] = await c.query(`SELECT ${checksum} FROM ${quote(database)}.${quote(target)}`);
                    mismatchedRows = a[0].n === b[0].n && a[0].digest === b[0].digest ? 0 : -1; comparison = 'row count and original-column aggregate checksum (no primary key)';
                }
            }
            report.push({ table: source, preservedIn: target, originalRows: original[0].n, currentRows: current[0].n, missingColumns, mismatchedRows, comparison });
        }
        const [pins] = await c.query('SELECT s.employeeid,s.pin original_pin,t.pin current_pin,t.pin_hash FROM ??.roles s JOIN ??.roles t ON s.employeeid=t.employeeid', [snapshot, database]);
        let pinFailures = 0, migratedPins = 0;
        for (const row of pins) {
            if (Number(row.original_pin) >= 1000 && Number(row.original_pin) <= 9999 && row.current_pin == null) {
                migratedPins++;
                if (!row.pin_hash || !await bcrypt.compare(String(row.original_pin), row.pin_hash)) pinFailures++;
            } else if (String(row.original_pin) !== String(row.current_pin)) pinFailures++;
        }
        const failures = report.filter(row => row.missingColumns.length || row.mismatchedRows !== 0 || row.currentRows < row.originalRows);
        fs.writeFileSync(output, JSON.stringify({ database, snapshot, verifiedAt: new Date().toISOString(), originalTables: tables.length, failures, pinFailures, migratedPins, tables: report }, null, 2), { mode: 0o600 });
        console.log(JSON.stringify({ originalTables: tables.length, differingTables: failures.map(row => ({ table: row.table, mismatchedRows: row.mismatchedRows, missingColumns: row.missingColumns })), pinFailures, migratedPins }));
        if (failures.length || pinFailures) process.exitCode = 1;
    } finally { await c.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
