import { effectiveTenantId } from '../../hooks/configuration';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { formatLoginUsername, LoginEntityType } from './TenantLoginDirectory';

export async function formatTenantLoginUsername(tenantId: number, entityType: LoginEntityType, entityId: number): Promise<string> {
     const tenant = await new TenantRegistry().requireTenant(effectiveTenantId(tenantId));
     return formatLoginUsername(tenant.platformId, entityType, entityId);
}
