import type { Knex } from 'knex';
import { configuration } from "../hooks/configuration";
import {scopedCatalogDatabase} from '../models/system-admin/MasterCatalogContext';
import { KnexConnectionTenant } from "../models/Tenancy/tenantConnections";
import { singleTenantKnexInstance } from "./connection";

const KnexConnection = async (tenantId: number): Promise<Knex> => {
     const catalog=scopedCatalogDatabase(tenantId);
     if(catalog)return catalog;
     return configuration.isMultiTenant ? await KnexConnectionTenant(tenantId):
     singleTenantKnexInstance;
}

export default KnexConnection
