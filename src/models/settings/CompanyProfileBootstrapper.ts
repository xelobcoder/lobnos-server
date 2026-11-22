import KnexConnection from '../../database/KnexConnections';
import logger from '../../hooks/logger';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { companyInfoCache } from '../../services/cache/testPanelCache';

export async function bootstrapTenantCompanyProfile(tenantId: number): Promise<void> {
     const db = await KnexConnection(tenantId);
     if (!await db.schema.hasTable('companyprofile')) {
          throw new Error('Cannot seed company profile because the companyprofile table is missing');
     }

     const created = await db.transaction(async (trx) => {
          const existing = await trx('companyprofile').forUpdate().first();
          if (existing) return false;

          const tenant = await new TenantRegistry().getTenant(tenantId);
          if (!tenant || !['active', 'provisioning'].includes(tenant.status)) {
               throw new Error(`Cannot seed company profile for inactive or unregistered tenant ${tenantId}`);
          }

          await trx('companyprofile').insert({
               NAME: tenant.name || tenant.databaseName,
               EMAIL: tenant.email || '',
               MOTTO: '',
               PHONENUMBER: tenant.phone || '',
               ADDRESS: '',
               STREET: '',
          });
          return true;
     });

     if (created) {
          await companyInfoCache.invalidate(tenantId);
          logger.info(`[Bootstrap] Created company profile for tenant ${tenantId} from its registry record`);
     }
}
