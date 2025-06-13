import knex, { Knex } from "knex";
import mysql, { Pool } from "mysql2/promise";
import { configuration } from "../../hooks/configuration";

interface TenantDBConfig {
     host: string;
     user: string;
     password: string;
     database: string;
     port: number;
     connectionLimit: number;
     waitForConnections: boolean;
    idleTimeout: number;
     enableKeepAlive?: boolean;
     keepAliveInitialDelay?: number;
}

const tenantConnections: Record<string, {
     mysqlPool: Pool;
     knex: Knex;
     lastUsed: number;
}> = {};

const CONNECTION_TIMEOUT = 2000; 

async function initializeTenantConnection(tenantId: number) {
     const tenantKey = String(tenantId);

     if (tenantConnections[tenantKey] &&
          Date.now() - tenantConnections[tenantKey].lastUsed < CONNECTION_TIMEOUT) {
          return tenantConnections[tenantKey];
     }

     const config: TenantDBConfig = {
          host: process.env.DB_HOST!,
          user: process.env.DB_USERNAME!,
          password: process.env.DB_PASSWORD!,
          database: configuration.tenancyNaming(tenantId.toString()),
          port: Number(process.env.DB_PORT!),
          connectionLimit: 10,
          waitForConnections: true,
     idleTimeout: 3000,
     };

     const pool = mysql.createPool({
          ...config,
          idleTimeout: 1000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
     });

     const knexInstance = knex({
          client: "mysql2",
          connection: config,
          pool: {
               min: 2,
               max: 20,
               idleTimeoutMillis: 1000,
               reapIntervalMillis: 1000,
               afterCreate: (conn: any, done: Function) => {
                    conn.query('SET SESSION wait_timeout=3;', (err: any) => done(err, conn));
               }
          },
     });

     if (tenantConnections[tenantKey]) {
          await tenantConnections[tenantKey].mysqlPool.end();
          await tenantConnections[tenantKey].knex.destroy();
     }

     tenantConnections[tenantKey] = {
          mysqlPool: pool,
          knex: knexInstance,
          lastUsed: Date.now()
     };

     return tenantConnections[tenantKey];
}

async function primeTenancyConnector(tenantId: number): Promise<Pool> {
     const connection = await initializeTenantConnection(tenantId);
     connection.lastUsed = Date.now();
     return connection.mysqlPool;
}

async function KnexConnectionTenant(tenantId: number): Promise<Knex> {
     const connection = await initializeTenantConnection(tenantId);
     connection.lastUsed = Date.now();
     return connection.knex;
}

export { KnexConnectionTenant, primeTenancyConnector };