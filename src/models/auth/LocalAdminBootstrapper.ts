import { randomInt } from 'crypto';
import bcrypt from 'bcrypt';
import KnexConnection from '../../database/KnexConnections';
import { configuration } from '../../hooks/configuration';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { formatLoginUsername } from './TenantLoginDirectory';
import { requireStrongPassword } from './PasswordPolicy';

const ADMIN_PERMISSIONS = {
     registration: true,
     billing: true,
     inventory: true,
     supply: true,
     payments: true,
     approval: true,
     settings: true,
     phelobotomy: true,
};

function bootstrapAdminDetails() {
     const name = String(process.env.PLS_BOOTSTRAP_ADMIN_NAME || '').trim();
     const email = String(process.env.PLS_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
     const password = process.env.PLS_BOOTSTRAP_ADMIN_PASSWORD;

     if (!name || name.length > 100) {
          throw new Error('PLS_BOOTSTRAP_ADMIN_NAME is required and must be at most 100 characters');
     }
     if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
          throw new Error('PLS_BOOTSTRAP_ADMIN_EMAIL must be a valid email address of at most 200 characters');
     }
     if (!password) throw new Error('PLS_BOOTSTRAP_ADMIN_PASSWORD is required for a role-less local facility');

     return { name, email, password: requireStrongPassword(password) };
}

export async function bootstrapLocalAdminAccount(tenantId: number): Promise<void> {
     if (configuration.isMultiTenant || configuration.desktopStandalone) return;

     const connection = await KnexConnection(tenantId);
     if (!await connection.schema.hasTable('roles')) {
          throw new Error('Cannot bootstrap the first local administrator because the roles table is missing');
     }

     const tenant = await new TenantRegistry().requireTenant(tenantId);
     const employeeId = await connection.transaction(async (trx) => {
          const existing = await trx('roles').orderBy('employeeid', 'asc').forUpdate().first('employeeid');
          if (existing) return null;

          const { name, email, password } = bootstrapAdminDetails();
          const branch = await trx('branch')
               .where({ activation: 1 })
               .orderBy('branchid', 'asc')
               .forUpdate()
               .first('branchid');
          if (!branch) throw new Error('Cannot bootstrap the first local administrator because there is no active branch');

          const [insertedId] = await trx('roles').insert({
               username: name,
               firstname: name,
               role: 'admin',
               password: await bcrypt.hash(password, 10),
               password_changed_on: trx.fn.now(),
               activation: 1,
               email,
               emailAuthenticated: 'true',
               mobile: String(randomInt(1000000000, 2000000000)),
               branch: branch.branchid,
               pin: null,
               pin_hash: null,
               permissions: JSON.stringify(ADMIN_PERMISSIONS),
          });
          const newEmployeeId = Number(insertedId);
          if (!Number.isSafeInteger(newEmployeeId) || newEmployeeId <= 0) {
               throw new Error('First local administrator could not be assigned a valid employee ID');
          }
          const updated = await trx('roles').where({ employeeid: newEmployeeId }).update({
               login_username: formatLoginUsername(tenant.platformId, 'staff', newEmployeeId),
          });
          if (updated !== 1) throw new Error('First local administrator login name could not be assigned');
          return newEmployeeId;
     });

     if (employeeId !== null) {
          const message = `[Bootstrap] Created first local administrator for tenant ${tenantId} (employee ${employeeId})`;
          const logger = (await import('../../hooks/logger')).default;
          logger.info(message);
     }
}
