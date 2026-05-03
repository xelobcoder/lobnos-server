"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configuration = void 0;
exports.configuration = {
    isMultiTenant: false,
    tenancyNaming: (tenantId) => `primetenant${tenantId.toString()}`,
};
