"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configuration_1 = require("../hooks/configuration");
const tenantConnections_1 = require("../models/Tenancy/tenantConnections");
const connection_1 = require("./connection");
const KnexConnection = async (tenantId) => {
    return configuration_1.configuration.isMultiTenant ? await (0, tenantConnections_1.KnexConnectionTenant)(tenantId) :
        connection_1.singleTenantKnexInstance;
};
exports.default = KnexConnection;
