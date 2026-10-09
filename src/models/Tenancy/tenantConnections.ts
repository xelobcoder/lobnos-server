import knex, { Knex } from "knex";
import mysql, { Pool } from "mysql2/promise";
import { TenantRegistry } from "./TenantRegistry";

interface TenantConnection {
     databaseName: string;
     mysqlPool: Pool;
     knex: Knex;
}

const tenantConnections = new Map<number, Promise<TenantConnection>>();

async function createTenantConnection(tenantId: number): Promise<TenantConnection> {
     const tenant = await new TenantRegistry().requireTenant(tenantId);
     const connectionConfig = {
          host: tenant.host || process.env.DB_HOST!,
          port: tenant.port || Number(process.env.DB_PORT!),
          user: process.env.DB_USERNAME!,
          password: process.env.DB_PASSWORD!,
          database: tenant.databaseName,
     };

     const mysqlPool = mysql.createPool({
          ...connectionConfig,
          connectionLimit: 10,
          waitForConnections: true,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
     });

     const knexInstance = knex({
          client: "mysql2",
          connection: connectionConfig,
          pool: {
               min: 0,
               max: 20,
               idleTimeoutMillis: 30000,
               afterCreate: (conn: any, done: Function) => {
                    conn.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))", (err: any) => {
                         done(err, conn);
                    });
               }
          },
     });

     return { databaseName: tenant.databaseName, mysqlPool, knex: knexInstance };
}

/** One long-lived pool per tenant, resolved from the master tenant registry. */
function getTenantConnection(tenantId: number): Promise<TenantConnection> {
     const id = Number(tenantId);
     let connection = tenantConnections.get(id);
     if (!connection) {
          connection = createTenantConnection(id);
          tenantConnections.set(id, connection);
          connection.catch(() => tenantConnections.delete(id));
     }
     return connection;
}

async function primeTenancyConnector(tenantId: number): Promise<Pool> {
     return (await getTenantConnection(tenantId)).mysqlPool;
}

async function KnexConnectionTenant(tenantId: number): Promise<Knex> {
     return (await getTenantConnection(tenantId)).knex;
}

/** Closes a tenant's pools, e.g. after its database registration changed. */
async function releaseTenantConnection(tenantId: number): Promise<void> {
     const pending = tenantConnections.get(Number(tenantId));
     tenantConnections.delete(Number(tenantId));
     if (!pending) return;
     const connection = await pending.catch(() => null);
     if (!connection) return;
     await Promise.allSettled([connection.mysqlPool.end(), connection.knex.destroy()]);
}

export { KnexConnectionTenant, primeTenancyConnector, releaseTenantConnection };
