interface Configuration {
    isMultiTenant: boolean;
    tenancyNaming: (tenantId: string) => string;
}

export const configuration: Configuration = {
    isMultiTenant: true,
    tenancyNaming: (tenantId: string | number) => `primetenant${tenantId.toString()}`,
};
