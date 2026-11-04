/** Encrypted pre-upgrade snapshot and authenticated restore verification. Credentials stay in private client files. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const mysql = require('mysql2/promise');
const { singleTenantKnexInstance: db } = require('../dist/src/database/connection');
const EncryptionManager = require('../dist/src/models/security/database-backup/encryption').default;
const { encryptBackupStream } = require('../dist/src/models/security/database-backup/backupCipher');
const { withDatabaseDump } = require('../dist/src/models/security/database-backup/backupProcess');
const args = process.argv.slice(2);
const option = name => args[args.indexOf(name) + 1];

function waitForExit(child) {
    child.stderr.resume();
    return new Promise((resolve, reject) => {
        child.once('error', () => reject(new Error('Database utility could not start')));
        child.once('close', code => code === 0 ? resolve() : reject(new Error('Database utility failed with exit code ' + code)));
    });
}
async function openAuthenticatedStream(filename, key, tenantId, keyId) {
    const handle = await fs.promises.open(filename, 'r');
    try {
        const stat = await handle.stat(), prefix = Buffer.alloc(12);
        await handle.read(prefix, 0, 12, 0);
        if (prefix.subarray(0, 8).toString() !== 'PLSBK002') throw Error('Unexpected backup format');
        const length = prefix.readUInt32BE(8);
        if (length < 1 || length > 4096 || stat.size < 12 + length + 16) throw Error('Invalid backup header');
        const header = Buffer.alloc(12 + length), tag = Buffer.alloc(16);
        await handle.read(header, 0, header.length, 0);
        await handle.read(tag, 0, tag.length, stat.size - 16);
        const metadata = JSON.parse(header.subarray(12).toString('utf8'));
        if (metadata.version !== 2 || metadata.tenantId !== tenantId || metadata.keyId !== keyId) throw Error('Backup identity mismatch');
        const iv = Buffer.from(metadata.iv, 'base64');
        if (iv.length !== 12) throw Error('Invalid backup IV');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(header); decipher.setAuthTag(tag);
        return { source: fs.createReadStream(filename, { start: header.length, end: stat.size - 17 }), decipher };
    } finally { await handle.close(); }
}
async function main() {
    for (const name of ['--database', '--tenant', '--output', '--verify-restore']) {
        if (!args.includes(name) || !option(name) || option(name).startsWith('--')) throw Error('Required option ' + name);
    }
    const database = option('--database'), restore = option('--verify-restore'), tenantId = Number(option('--tenant'));
    const directory = path.resolve(option('--output'));
    if (!/^[a-zA-Z0-9_]+$/.test(database) || !/^[a-zA-Z0-9_]+$/.test(restore) || database === restore || !restore.includes('_restore_')) throw Error('Invalid backup or fresh restore database name');
    if (!Number.isSafeInteger(tenantId) || tenantId < 100000 || tenantId > 999999) throw Error('A registered tenant identity is required');
    if (db.client.config.connection.database !== database) throw Error('Backup database must match this installation');
    const settings = db.client.config.connection;
    const connection = await mysql.createConnection({ ...settings, password: settings.password, database });
    try {
        const [events] = await connection.query('SELECT COUNT(*) n FROM information_schema.EVENTS WHERE EVENT_SCHEMA=?', [database]);
        if (Number(events[0].n)) throw Error('Event-bearing backups need an isolated restore server with event execution disabled');
        const [engines] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' AND ENGINE<>'InnoDB'", [database]);
        if (engines.length) throw Error('Consistent snapshot needs reviewed locking for non-InnoDB tables');
        await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
        const key = crypto.randomBytes(32), keyId = `UPGRADE-${database}-${crypto.randomUUID()}`;
        const sealedKey = EncryptionManager.encryptSecret(key.toString('hex'));
        const filename = path.join(directory, database + '.sql.encrypted');
        await withDatabaseDump(db.client.config, async (binary, dumpArgs, environment) => {
            const dump = spawn(binary, [dumpArgs[0], '--routines', '--events', '--triggers', '--no-tablespaces', '--set-gtid-purged=OFF', ...dumpArgs.slice(1)],
                { env: environment, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
            const exited = waitForExit(dump); void exited.catch(() => undefined);
            try { await encryptBackupStream(dump.stdout, filename, key, tenantId, keyId); await exited; }
            catch (error) { dump.kill(); await exited.catch(() => undefined); throw error; }
            const digest = crypto.createHash('sha256');
            for await (const chunk of fs.createReadStream(filename)) digest.update(chunk);
            const sha256 = digest.digest('hex');
            const manifest = { database, tenantId, keyId, sealedKey, sha256, filename: path.basename(filename), createdAt: new Date().toISOString(), restoreDatabase: restore,
                recoveryKey: 'Existing BACKUP_MASTER_KEY or BACKUP_MASTER_KEY_FILE is required; retain it separately.' };
            await fs.promises.writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
            // Authenticate the entire file before sending any SQL to MySQL.
            const verified = await openAuthenticatedStream(filename, key, tenantId, keyId);
            await pipeline(verified.source, verified.decipher, new Writable({ write(_chunk, _encoding, done) { done(); } }));
            const recovered = Buffer.from(EncryptionManager.decryptSecret(sealedKey), 'hex');
            if (!crypto.timingSafeEqual(recovered, key)) throw Error('Sealed recovery-key verification failed');
            await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [restore]);
            const mysqlBinary = path.join(path.dirname(binary), process.platform === 'win32' ? 'mysql.exe' : 'mysql');
            const importer = spawn(mysqlBinary, [dumpArgs[0], '--default-character-set=utf8mb4', '--binary-mode', restore],
                { env: environment, windowsHide: true, shell: false, stdio: ['pipe', 'ignore', 'pipe'] });
            const imported = waitForExit(importer); void imported.catch(() => undefined);
            const decrypted = await openAuthenticatedStream(filename, recovered, tenantId, keyId);
            try { await Promise.all([pipeline(decrypted.source, decrypted.decipher, importer.stdin), imported]); }
            catch (error) { importer.kill(); await imported.catch(() => undefined); throw error; }
            const [tables] = await connection.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [database]);
            const verifiedTables = [];
            for (const row of tables) {
                const [original] = await connection.query('SELECT COUNT(*) n FROM ??.??', [database, row.TABLE_NAME]);
                const [restored] = await connection.query('SELECT COUNT(*) n FROM ??.??', [restore, row.TABLE_NAME]);
                if (original[0].n !== restored[0].n) throw Error('Restored row count differs for ' + row.TABLE_NAME);
                verifiedTables.push({ table: row.TABLE_NAME, rows: original[0].n });
            }
            await fs.promises.writeFile(path.join(directory, 'restore-verification.json'), JSON.stringify({ database, restore, tables: verifiedTables, verifiedAt: new Date().toISOString() }, null, 2), { flag: 'wx', mode: 0o600 });
            console.log(JSON.stringify({ database, tenantId, encryptedBackup: filename, authenticated: true, restoredDatabase: restore, verifiedTables: tables.length }));
        });
    } finally { await connection.end(); await db.destroy(); }
}
module.exports = { openAuthenticatedStream, waitForExit };
if (require.main === module) main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
