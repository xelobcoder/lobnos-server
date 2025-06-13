interface Configuration {
    EXPIRYDATE: Date;
    PORT: number;
    isMultiTenant: boolean;
    tenancyNaming: (tenantId: string) => string;
}

export const configuration: Configuration = {
    EXPIRYDATE: new Date('2025-04-29T06:00:00'),
    isMultiTenant: false,
    PORT: 5000,
    tenancyNaming: (tenantId: string | number) => `primetenant${tenantId.toString()}`,
};
