import TestAscensionTurnAroundTime from '../models/operations/TurnAroundTime';
import { listServedTenants } from '../models/Tenancy/TenantRegistry';

export async function runTATArchiveJob() {
     let totalArchived = 0;
     const tenants = (await listServedTenants()).map((tenant) => ({ tenantid: tenant.tenantId }));
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
