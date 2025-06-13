import { configuration } from "../hooks/configuration";
import { KnexConnectionTenant } from "../models/Tenancy/tenantConnections";
import { singleTenantKnexInstance } from "./connection";

const KnexConnection = async (tenantId: number) => {
     return configuration.isMultiTenant ? await KnexConnectionTenant(tenantId):
     singleTenantKnexInstance;
}

export default KnexConnection
