interface Configuration {
    /** Set only by the trusted standalone desktop launcher, never by online deployment defaults. */
    desktopStandalone: boolean;
    isMultiTenant: boolean;
    /** Standard tenant database name derived from the tenant ID, e.g. tenant 3 -> `pls_t00003`. */
    tenancyNaming: (tenantId: string | number) => string;
    /** Combined control database (organization registry and master test catalog; no global user directory). */
    masterControlDatabase: string;
    /** Tenant this installation's own database (env DATABASE) is registered as. */
    defaultTenantId: number;
    /** When true, tenants can only add tests by importing them from the master catalog. */
    enforceMasterTestCatalog: boolean;
}

export const configuration: Configuration = {
    desktopStandalone: process.env.PLS_DESKTOP_STANDALONE === 'true',
    isMultiTenant: process.env.PLS_DESKTOP_STANDALONE === 'true' ? false : process.env.MULTI_TENANT !== 'false',
    tenancyNaming: (tenantId: string | number) => `PLS${String(tenantId).padStart(5, '0')}`,
    masterControlDatabase: process.env.SYSTEM_CONFIG_DATABASE || 'primelabmaster_control',
    defaultTenantId: Number(process.env.DEFAULT_TENANT_ID) > 0 ? Number(process.env.DEFAULT_TENANT_ID) : 3,
    enforceMasterTestCatalog: process.env.ENFORCE_MASTER_TEST_CATALOG === 'true',
};

/** In single-tenant mode every request is served by the default tenant, whatever id the caller passed. */
export const effectiveTenantId = (tenantId: number): number =>
    configuration.isMultiTenant ? Number(tenantId) : configuration.defaultTenantId;
