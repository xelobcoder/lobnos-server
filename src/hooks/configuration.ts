interface Configuration {
    isMultiTenant: boolean;
    tenancyNaming: (tenantId: string) => string;
    /** Combined control database (tenant registry, global login directory, master test catalog). */
    masterControlDatabase: string;
    /** Tenant used when no tenant can be resolved in single-tenant mode. */
    defaultTenantId: number;
    /** When true, tenants can only add tests by importing them from the master catalog. */
    enforceMasterTestCatalog: boolean;
}

export const configuration: Configuration = {
    isMultiTenant: false,
    tenancyNaming: (tenantId: string | number) => `primetenant${tenantId.toString()}`,
    masterControlDatabase: process.env.SYSTEM_CONFIG_DATABASE || 'primelabmaster_control',
    defaultTenantId: Number(process.env.DEFAULT_TENANT_ID) > 0 ? Number(process.env.DEFAULT_TENANT_ID) : 3,
    enforceMasterTestCatalog: process.env.ENFORCE_MASTER_TEST_CATALOG === 'true',
};

/** In single-tenant mode every request is served by the default tenant, whatever id the caller passed. */
export const effectiveTenantId = (tenantId: number): number =>
    configuration.isMultiTenant ? tenantId : configuration.defaultTenantId;
