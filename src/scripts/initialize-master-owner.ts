import bcrypt from 'bcrypt';
import { initializeMasterOwner } from '../models/Tenancy/MasterOwnerSession';
import { systemConfigConnection, singleTenantKnexInstance } from '../database/connection';
import { requireStrongPassword } from '../models/auth/PasswordPolicy';
import KnexConnection from '../database/KnexConnections';
import { releaseTenantConnection } from '../models/Tenancy/tenantConnections';
import { parseMasterOwnerInitArguments } from './masterOwnerInitArguments';

async function readPasswordFromStdin() {
     const chunks = [];
     for await (const chunk of process.stdin) chunks.push(chunk);
     return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

function promptHiddenPassword(prompt: string): Promise<string> {
     const input = process.stdin;
     return new Promise((resolve, reject) => {
          let password = '';
          const finish = (error?: Error) => {
               input.removeListener('data', onData);
               input.setRawMode(false);
               input.pause();
               process.stdout.write('\n');
               if (error) reject(error);
               else resolve(password);
          };
          const onData = (chunk: string) => {
               for (const character of chunk) {
                    if (character === '\u0003' || character === '\u0004') {
                         finish(new Error('Master initialization cancelled'));
                         return;
                    }
                    if (character === '\r' || character === '\n') {
                         finish();
                         return;
                    }
                    if (character === '\u007f' || character === '\b') {
                         password = Array.from(password).slice(0, -1).join('');
                    } else if (character >= ' ') {
                         password += character;
                    }
               }
          };
          process.stdout.write(prompt);
          input.setEncoding('utf8');
          input.setRawMode(true);
          input.resume();
          input.on('data', onData);
     });
}

async function promptAndConfirmPassword() {
     if (!process.stdin.isTTY || !process.stdout.isTTY) return readPasswordFromStdin();
     const password = await promptHiddenPassword('Master password: ');
     const confirmation = await promptHiddenPassword('Confirm master password: ');
     if (password !== confirmation) throw new Error('Master passwords do not match');
     return password;
}

async function main() {
     const options = parseMasterOwnerInitArguments(process.argv.slice(2));
     if (options.mode === 'import-staff') {
          if (!/^[1-9]\d{5}$/.test(options.tenantId ?? '') || !/^[1-9]\d*$/.test(options.employeeId ?? '')) throw Error('Provide a tenant ID and staff employee ID');
          const tenantId = Number(options.tenantId);
          try {
               const db = await KnexConnection(tenantId);
               const user = await db('roles').where({ employeeid: Number(options.employeeId), activation: 1 }).first();
               if (!user || String(user.role).toLowerCase().replace(/[\s_-]/g,'') !== 'superadmin') throw Error('Select an active super-admin account');
               await initializeMasterOwner(options.username, user.password);
          } finally { await releaseTenantConnection(tenantId); }
     } else if (options.mode === 'password-stdin' || options.mode === 'prompt') {
          const password = options.mode === 'prompt' ? await promptAndConfirmPassword() : await readPasswordFromStdin();
          await initializeMasterOwner(options.username, await bcrypt.hash(requireStrongPassword(password), 12));
     } else {
          throw new Error('Unsupported master initialization mode');
     }
     console.log('Master administrator initialized.');
}

main().catch(error => {
     console.error(error?.code === 'ER_DUP_ENTRY' ? 'The master administrator is already initialized.' :
          error?.code ? 'The master administrator could not be initialized (' + error.code + ')' : error.message);
     process.exitCode = 1;
}).finally(async () => { await Promise.all([systemConfigConnection.destroy(), singleTenantKnexInstance.destroy()]); });
