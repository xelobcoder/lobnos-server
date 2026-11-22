import KnexConnection from '../../../database/KnexConnections';
import logger from '../../../hooks/logger';

const UINT_MAX = 4294967295;

export async function bootstrapDefaultBranch(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);
     if (!await connection.schema.hasTable('branch')) {
          throw new Error('Cannot create a default branch because the branch table is missing');
     }
     const hasCompanyProfile = await connection.schema.hasTable('companyprofile');

     const created = await connection.transaction(async (trx) => {
          const existing = await trx('branch').orderBy('branchid', 'asc').forUpdate().first('branchid');
          if (existing) return false;

          const profile = hasCompanyProfile
               ? await trx('companyprofile').first()
               : undefined;
          const profileName = String(profile?.NAME || profile?.name || '').trim();
          const rawContact = String(profile?.PHONENUMBER || profile?.phone || '').replace(/\D/g, '');
          const parsedContact = Number(rawContact);
          const contact = Number.isSafeInteger(parsedContact) && parsedContact <= UINT_MAX ? parsedContact : 0;

          await trx('branch').insert({
               branchid: 1,
               name: profileName || 'Main Branch',
               address: profile?.ADDRESS || profile?.address || null,
               email: profile?.EMAIL || profile?.email || null,
               contact,
               managerid: '1',
               activation: 1,
          });
          return true;
     });

     if (created) logger.info(`[Bootstrap] Created default active branch for tenant ${tenantId}`);
}
