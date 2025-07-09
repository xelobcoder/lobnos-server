import { configuration } from '../hooks/configuration';
import TestAscensionTurnAroundTime from '../models/operations/TurnAroundTime';
import { TenancyRepository } from '../models/Tenancy/tenancyRepo';

export async function runTATArchiveJob() {
     const isMultiTenant = configuration.isMultiTenant;
     if (!isMultiTenant) await TestAscensionTurnAroundTime.computeAndArchiveAllTATs(3);
     let totalArchived = 0;
     const tenants = await new TenancyRepository().getAllTenants();
     if (!tenants || tenants.length === 0) return console.log("[TAT Archive] No tenants found to archive ascensions.");
     for (const tenant of tenants) {
          try {
               const count = await TestAscensionTurnAroundTime.computeAndArchiveAllTATs(tenant.tenantid);
               totalArchived += count;
               console.log(`[TAT Archive] Tenant ${tenant.tenantid}: Archived ${count} ascensions.`);
          } catch (err) {
               console.error(`[TAT Archive] Error for tenant ${tenant.tenantid}:`, err);
          }
     }
     console.log(`[TAT Archive] Total archived ascensions: ${totalArchived}`);
     return totalArchived;
}
