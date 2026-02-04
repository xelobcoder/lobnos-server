interface Configuration {
    isMultiTenant: boolean;
    tenancyNaming: (tenantId: string) => string;
}

export const configuration: Configuration = {
    isMultiTenant: false,
    tenancyNaming: (tenantId: string | number) => `primetenant${tenantId.toString()}`,
};
