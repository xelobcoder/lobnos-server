import { spawn } from 'node:child_process';
import { createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import EncryptionManager from './encryption';

/** Passwords and TLS client material are kept out of command lines and error messages. */
export async function withDatabaseDump<T>(config: any, run: (binary: string, args: string[], env?: NodeJS.ProcessEnv) => Promise<T>): Promise<T> {
     const directory = await fs.mkdtemp(path.join(process.env.BACKUP_TEMP_DIRECTORY || tmpdir(), 'pls-dump-'));
     await fs.chmod(directory, 0o700);
     try {
          const connection = config.connection;
          if (config.client === 'mysql' || config.client === 'mysql2') {
               const quote = (value: unknown) => `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`;
               const options = ['[client]', `host=${quote(connection.host)}`, `port=${quote(connection.port || 3306)}`,
                    `user=${quote(connection.user)}`, `password=${quote(connection.password)}`];
               if (connection.ssl) {
                    options.push('ssl-mode=VERIFY_IDENTITY');
                    for (const [property, option] of [['ca', 'ssl-ca'], ['cert', 'ssl-cert'], ['key', 'ssl-key']]) {
                         if (!connection.ssl[property]) continue;
                         const filename = path.join(directory, `${property}.pem`);
                         await fs.writeFile(filename, connection.ssl[property], { mode: 0o600 });
                         options.push(`${option}=${quote(filename)}`);
                    }
               }
               const defaults = path.join(directory, 'client.cnf');
               await fs.writeFile(defaults, options.join('\n') + '\n', { mode: 0o600 });
               const binary = process.env.MYSQLDUMP_PATH || (process.platform === 'win32'
                    ? 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe' : 'mysqldump');
               if (!/^[a-zA-Z0-9_]+$/.test(connection.database)) throw new Error('Invalid registered backup database name');
               return await run(binary, [`--defaults-extra-file=${defaults}`, '--single-transaction', '--set-gtid-purged=OFF', '--hex-blob', '--', connection.database]);
          }
          if (config.client === 'postgresql') {
               const tlsEnvironment: NodeJS.ProcessEnv = {};
               if (connection.ssl) {
                    tlsEnvironment.PGSSLMODE = 'verify-full';
                    for (const [property, variable] of [['ca', 'PGSSLROOTCERT'], ['cert', 'PGSSLCERT'], ['key', 'PGSSLKEY']]) {
                         if (!connection.ssl[property]) continue;
                         const filename = path.join(directory, `${property}.pem`);
                         await fs.writeFile(filename, connection.ssl[property], { mode: 0o600 });
                         tlsEnvironment[variable] = filename;
                    }
               }
               return await run(process.env.PG_DUMP_PATH || 'pg_dump', ['-h', connection.host, '-p', String(connection.port || 5432), '-U', connection.user, '-d', connection.database], {
                    ...process.env, PGPASSWORD: connection.password,
                    ...tlsEnvironment,
               });
          }
          throw new Error('Unsupported backup database client');
     } finally {
          // Only this invocation's newly-created private temporary directory is removed.
          await fs.rm(directory, { recursive: true, force: true });
     }
}

export async function runBackupProcess(binary: string, args: string[], tenantId: number, output: string, encrypted: boolean, env?: NodeJS.ProcessEnv, serverManagedKey = false): Promise<string | undefined> {
     // Persist and capture the data key before mysqldump opens its consistent snapshot.
     const encryption = encrypted ? await EncryptionManager.prepareBackupEncryption(tenantId, serverManagedKey) : undefined;
     const child = spawn(binary, args, { windowsHide: true, shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] });
     // Drain diagnostics without persisting database contents, credentials or SQL in logs.
     child.stderr.resume();
     const exited = new Promise<void>((resolve, reject) => {
          child.once('error', () => reject(new Error('Backup utility could not be started')));
          child.once('close', code => code === 0 ? resolve() : reject(new Error('Backup utility failed')));
     });
     void exited.catch(() => undefined);
     const partial = `${output}.${randomUUID()}.partial`;
     let published = false;
     try {
          let keyId: string | undefined;
          if (encrypted) {
               await encryption!.encrypt(child.stdout, partial);
               keyId = encryption!.keyId;
          } else {
               await pipeline(child.stdout, createWriteStream(partial, { flags: 'wx', mode: 0o600 }));
          }
          await exited;
          await fs.link(partial, output);
          published = true;
          return keyId;
     } finally {
          if (!published) child.kill();
          await exited.catch(() => undefined);
          await fs.unlink(partial).catch(() => undefined);
     }
}
