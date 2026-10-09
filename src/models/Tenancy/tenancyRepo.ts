import { systemConfigConnection as tenancyConnection } from "../../database/connection";
import { RegisteredTenant, TENANTS_TABLE, TenantRegistry } from "./TenantRegistry";

function toLegacyTenant(tenant: RegisteredTenant): PrimeLimsTenant {
     return {
          tenantid: tenant.tenantId,
          name: tenant.name,
          createdon: tenant.createdAt as Date,
          isActive: tenant.isActive ? 1 : 0,
          updatedOn: tenant.updatedAt as Date,
          referedid: tenant.platformId,
          expirydate: (tenant.suspendedAt ?? tenant.archivedAt) as Date,
     };
}

/** Tenant registry access backed by primelabmaster_control.prime_tenants (see TenantRegistry). */
export class TenancyRepository {
     private registry = new TenantRegistry();

     async getTenantDetails(tenantid: number): Promise<PrimeLimsTenant | null> {
          if (!Number.isSafeInteger(Number(tenantid))) return null;
          const tenant = await this.registry.getTenant(Number(tenantid));
          return tenant ? toLegacyTenant(tenant) : null;
     }

     async getAllTenants(): Promise<PrimeLimsTenant[]> {
          return (await this.registry.listActiveTenants()).map(toLegacyTenant);
     }

     async activateTenant(tenantid: number): Promise<boolean> {
          const updated = await tenancyConnection(TENANTS_TABLE).where({ tenant_number: tenantid })
               .update({ status: "active", suspended_at: null });
          TenantRegistry.invalidate();
          return updated > 0;
     }

     async deactivateTenant(tenantid: number): Promise<boolean> {
          const updated = await tenancyConnection(TENANTS_TABLE).where({ tenant_number: tenantid })
               .update({ status: "suspended", suspended_at: tenancyConnection.fn.now() });
          TenantRegistry.invalidate();
          return updated > 0;
     }

     async verifyTenantId(tenantid: number): Promise<boolean> {
          return !!(await this.registry.getTenant(Number(tenantid)));
     }

     async createDatabase(dbName: string): Promise<void> {
          try {
               await tenancyConnection.raw(`CREATE DATABASE IF NOT EXISTS ??`, [dbName]);
          } catch (err) {
               console.error(`Error creating database ${dbName}:`, err);
          }
     }

     async validateTenantStanding(tenantId: number): Promise<boolean> {
          const tenant = await this.registry.getTenant(Number(tenantId));
          return !!tenant && tenant.isActive;
     }
}
