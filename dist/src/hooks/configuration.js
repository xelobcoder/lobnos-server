"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = void 0;
exports.configuration = {
    EXPIRYDATE: new Date('2025-04-29T06:00:00'),
    isMultiTenant: false,
    PORT: 5000,
    tenancyNaming: (tenantId) => `primetenant${tenantId.toString()}`,
};
