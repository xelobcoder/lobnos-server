import bcrypt from 'bcrypt';
import { initializeMasterOwner } from '../models/Tenancy/MasterOwnerSession';
import { systemConfigConnection, singleTenantKnexInstance } from '../database/connection';
import { requireStrongPassword } from '../models/auth/PasswordPolicy';
import KnexConnection from '../database/KnexConnections';
import { releaseTenantConnection } from '../models/Tenancy/tenantConnections';

async function main() {
     const [username, mode, tenantArg, employeeArg] = process.argv.slice(2);
     if (mode === '--import-staff') {
          if (!/^[1-9]\d{5}$/.test(tenantArg ?? '') || !/^[1-9]\d*$/.test(employeeArg ?? '')) throw Error('Provide a tenant ID and staff employee ID');
          const tenantId = Number(tenantArg);
          try {
               const db = await KnexConnection(tenantId);
               const user = await db('roles').where({ employeeid: Number(employeeArg), activation: 1 }).first();
               if (!user || String(user.role).toLowerCase().replace(/[\s_-]/g,'') !== 'superadmin') throw Error('Select an active super-admin account');
               await initializeMasterOwner(username, user.password);
          } finally { await releaseTenantConnection(tenantId); }
     } else if (mode === '--password-stdin') {
          const chunks = [];
          for await (const chunk of process.stdin) chunks.push(chunk);
          const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
          await initializeMasterOwner(username, await bcrypt.hash(requireStrongPassword(password), 12));
     } else {
          throw Error('Usage: master:init <username> --password-stdin | --import-staff <tenantId> <employeeId>');
     }
     console.log('Master administrator initialized.');
}

main().catch(error => {
     console.error(error?.code === 'ER_DUP_ENTRY' ? 'The master administrator is already initialized.' :
          error?.code ? 'The master administrator could not be initialized (' + error.code + ')' : error.message);
     process.exitCode = 1;
}).finally(async () => { await Promise.all([systemConfigConnection.destroy(), singleTenantKnexInstance.destroy()]); });
