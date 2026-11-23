import { UNICODE_CI_PROTOCOL_ID } from '../../database/legacy-upgrade/SchemaCollationPolicy';
import { databaseTlsOptions } from '../../database/tls';
import knex, { Knex } from "knex";
import mysql, { Pool, PoolConnection } from "mysql2/promise";
import { TenantRegistry } from "./TenantRegistry";

interface TenantConnection {
     pending: Promise<void>;
     config?: {
          host: string;
          port: number;
          user: string;
          password: string;
          database: string;
          charsetNumber?: number;
          ssl?: import("mysql2").SslOptions;
     };
     mysqlPool?: Pool;
     knex?: Knex;
     mysqlAcquire?: () => Promise<PoolConnection>;
     mysqlEnd?: () => Promise<void>;
     knexAcquire?: () => Promise<any>;
     knexRelease?: (connection: any) => Promise<any>;
     active: number;
     lastUsed: number;
     drained?: () => void;
     closing?: Promise<void>;
}

function positiveSetting(name: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
     const raw = process.env[name];
     if (raw === undefined) return fallback;
     const value = Number(raw);
     if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
          throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
     }
     return value;
}

// Read once at startup; invalid deployment settings fail explicitly, not silently.
// Budget covers this module's tenant pools per process, not registry/control,
// single-tenant, provisioning connections, or pools in other worker processes.
const MAX_TENANTS = positiveSetting("TENANT_DB_CACHE_MAX_ENTRIES", 100);
const IDLE_MS = positiveSetting("TENANT_DB_IDLE_TIMEOUT_MS", 5 * 60_000, 2147483647);
const MYSQL_MAX = positiveSetting("TENANT_DB_MYSQL_POOL_MAX", 5);
const KNEX_MAX = positiveSetting("TENANT_DB_KNEX_POOL_MAX", 5);
const CONNECTION_BUDGET = positiveSetting("TENANT_DB_CONNECTION_BUDGET", 100);
const LEGACY_SCHEMA_UPGRADE = process.env.PLS_LEGACY_SCHEMA_UPGRADE === "true" ||
     process.env.TENANT_STARTUP_MIGRATION?.trim().toLowerCase() === "true";
if (MYSQL_MAX > CONNECTION_BUDGET || KNEX_MAX > CONNECTION_BUDGET) {
     throw new Error("Each tenant DB pool maximum must fit within TENANT_DB_CONNECTION_BUDGET");
}
const tenantConnections = new Map<number, TenantConnection>();
const knexReleases = new WeakMap<object, () => Promise<any>>();

/** Detached, frozen aggregate snapshot; no tenant identities or credentials are exposed.
 * Active checkouts includes acquisitions waiting on a driver. Reserved connections is
 * pool capacity, not an observed count of live sockets. Closing pools still count.
 */
function getTenantConnectionStats() {
     let mysqlPools = 0, knexPools = 0, activeCheckouts = 0, closingEntries = 0;
     for (const entry of tenantConnections.values()) {
          if (entry.mysqlPool) mysqlPools++;
          if (entry.knex) knexPools++;
          activeCheckouts += entry.active;
          if (entry.closing) closingEntries++;
     }
     return Object.freeze({
          entries: tenantConnections.size, closingEntries, activeCheckouts,
          mysqlPools, knexPools,
          reservedConnections: mysqlPools * MYSQL_MAX + knexPools * KNEX_MAX,
          connectionBudget: CONNECTION_BUDGET,
          maxEntries: MAX_TENANTS, mysqlPoolMax: MYSQL_MAX, knexPoolMax: KNEX_MAX,
          idleTimeoutMs: IDLE_MS,
     });
}

function tenantKey(tenantId: number): number {
     const id = Number(tenantId);
     if (!Number.isSafeInteger(id) || id <= 0) {
          throw new Error("Invalid tenant ID");
     }
     return id;
}

function finish(connection: TenantConnection): void {
     connection.active--;
     connection.lastUsed = Date.now();
     if (connection.active === 0) connection.drained?.();
}

function closeTenant(id: number, connection: TenantConnection): Promise<void> {
     if (connection.closing) return connection.closing;
     // Keep the entry in the map until teardown finishes: no replacement pool can overlap it.
     connection.closing = (async () => {
          await connection.pending.catch(() => undefined);
          if (connection.active > 0) {
               await new Promise<void>(resolve => { connection.drained = resolve; });
          }
          const results = await Promise.allSettled([
               Promise.resolve().then(() => connection.mysqlEnd?.()),
               Promise.resolve().then(() => connection.knex?.destroy()),
          ]);
          const failure = results.find(result => result.status === "rejected");
          if (failure?.status === "rejected") throw failure.reason;
     })().then(() => {
          if (tenantConnections.get(id) === connection) tenantConnections.delete(id);
     });
     // On teardown failure retain the rejected closing entry (fail closed). Replacing it
     // could leak a still-live pool and violate the process-wide capacity bound.
     return connection.closing;
}

/** One lazy pool per API per tenant, resolved only from the master registry. */
async function getTenantConnection(id: number, kind: "mysql" | "knex"): Promise<TenantConnection> {
     while (true) {
          let connection = tenantConnections.get(id);
          if (connection?.closing) {
               await connection.closing;
               continue;
          }
          if (!connection) {
               if (tenantConnections.size >= MAX_TENANTS) {
                    const victim = [...tenantConnections.entries()]
                         .filter(([, entry]) => entry.config && !entry.closing && entry.active === 0)
                         .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
                    if (!victim) throw new Error("Tenant connection capacity reached; retry later");
                    await closeTenant(...victim);
                    continue;
               }
               connection = { pending: undefined!, active: 0, lastUsed: Date.now() };
               const entry = connection;
               entry.pending = new TenantRegistry().requireTenant(id).then(tenant => {
                    entry.config = {
                         host: tenant.host || process.env.DB_HOST!,
                         port: tenant.port || Number(process.env.DB_PORT!),
                         user: process.env.DB_USERNAME!,
                         password: process.env.DB_PASSWORD!,
                         database: tenant.databaseName,
                         charsetNumber: UNICODE_CI_PROTOCOL_ID,
                         ...databaseTlsOptions(tenant.host || process.env.DB_HOST!),
                    };
               }).catch(error => {
                    // A failed old generation must never delete a replacement.
                    if (!entry.closing && tenantConnections.get(id) === entry) tenantConnections.delete(id);
                    throw error;
               });
               tenantConnections.set(id, entry);
          }
          await connection.pending;
          // Release/eviction can start while registry resolution is pending.
          if (connection.closing || tenantConnections.get(id) !== connection) continue;
          const allocated = kind === "mysql" ? connection.mysqlPool : connection.knex;
          if (!allocated) {
               const required = kind === "mysql" ? MYSQL_MAX : KNEX_MAX;
               if (getTenantConnectionStats().reservedConnections > CONNECTION_BUDGET - required) {
                    const victim = [...tenantConnections.entries()]
                         .filter(([otherId, entry]) => otherId !== id && !entry.closing &&
                              entry.active === 0 && (entry.mysqlPool || entry.knex))
                         .sort((a, b) => a[1].lastUsed - b[1].lastUsed)[0];
                    if (!victim) {
                         // Do not accumulate empty entries from rejected budget requests.
                         if (!connection.mysqlPool && !connection.knex && connection.active === 0) {
                              tenantConnections.delete(id);
                         }
                         throw new Error("Tenant connection budget capacity reached; retry later");
                    }
                    await closeTenant(...victim);
                    continue;
               }
               // Reserve/allocate synchronously: concurrent requests cannot oversubscribe.
               if (kind === "mysql") mysqlFor(id, connection);
               else knexFor(id, connection);
          }
          connection.lastUsed = Date.now();
          return connection;
     }
}

function mysqlFor(id: number, entry: TenantConnection): Pool {
     if (entry.mysqlPool) return entry.mysqlPool;
     const pool = mysql.createPool({
          ...entry.config,
          connectionLimit: MYSQL_MAX,
          maxIdle: MYSQL_MAX,
          idleTimeout: 30000,
          waitForConnections: true,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
     });
     entry.mysqlPool = pool;
     entry.mysqlAcquire = pool.getConnection.bind(pool);
     entry.mysqlEnd = pool.end.bind(pool);
     // Retained pool handles resolve the current generation instead of using an ended pool.
     pool.getConnection = async () => {
          const current = await getTenantConnection(id, "mysql");
          // No await between the closing check and pinning this entry.
          if (current.closing) return (await primeTenancyConnector(id)).getConnection();
          current.active++;
          try {
               mysqlFor(id, current);
               const connection = await current.mysqlAcquire!();
               let released = false;
               for (const method of ["release", "destroy"] as const) {
                    const original = connection[method].bind(connection);
                    connection[method] = () => {
                         if (released) return;
                         released = true;
                         try { original(); } finally { finish(current); }
                    };
               }
               return connection;
          } catch (error) {
               finish(current);
               throw error;
          }
     };
     // Pool-level queries must be pinned too (mysql2's implementation bypasses getConnection).
     for (const method of ["query", "execute"] as const) {
          (pool as any)[method] = async (...args: any[]) => {
               const connection = await pool.getConnection();
               try { return await (connection[method] as any)(...args); }
               finally { connection.release(); }
          };
     }
     return pool;
}

function knexFor(id: number, entry: TenantConnection): Knex {
     if (entry.knex) return entry.knex;
     const instance = knex({
          client: "mysql2",
          connection: entry.config,
          pool: {
               min: 0, max: KNEX_MAX, idleTimeoutMillis: 30000,
               afterCreate: (conn: any, done: Function) => {
                    const mode = LEGACY_SCHEMA_UPGRADE
                         ? "SET SESSION sql_mode = (SELECT REPLACE(REPLACE(REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''), 'NO_ZERO_DATE', ''), 'NO_ZERO_IN_DATE', ''))"
                         : "SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))";
                    conn.query(mode,
                         (err: any) => done(err, conn));
               },
          },
     });
     entry.knex = instance;
     entry.knexAcquire = instance.client.acquireConnection.bind(instance.client);
     entry.knexRelease = instance.client.releaseConnection.bind(instance.client);
     // Repositories retain Knex instances. Route future checkouts to the current generation,
     // but always return a checked-out connection to the exact pool that supplied it.
     instance.client.acquireConnection = async () => {
          const current = await getTenantConnection(id, "knex");
          if (current.closing) return (await KnexConnectionTenant(id)).client.acquireConnection();
          current.active++;
          try {
               knexFor(id, current);
               const connection = await current.knexAcquire!();
               knexReleases.set(connection, async () => {
                    try { return await current.knexRelease!(connection); }
                    finally { finish(current); }
               });
               return connection;
          } catch (error) {
               finish(current);
               throw error;
          }
     };
     instance.client.releaseConnection = async (connection: object) => {
          const release = knexReleases.get(connection);
          if (!release) throw new Error("Tenant connection is not checked out");
          knexReleases.delete(connection);
          return release();
     };
     return instance;
}

async function primeTenancyConnector(tenantId: number): Promise<Pool> {
     const id = tenantKey(tenantId);
     const entry = await getTenantConnection(id, "mysql");
     if (entry.closing) return primeTenancyConnector(id);
     return mysqlFor(id, entry);
}

async function KnexConnectionTenant(tenantId: number): Promise<Knex> {
     const id = tenantKey(tenantId);
     const entry = await getTenantConnection(id, "knex");
     if (entry.closing) return KnexConnectionTenant(id);
     return knexFor(id, entry);
}

/** Drain checkouts/transactions before closing; acquisitions wait for the next generation. */
async function releaseTenantConnection(tenantId: number): Promise<void> {
     const id = tenantKey(tenantId);
     const connection = tenantConnections.get(id);
     if (connection) await closeTenant(id, connection);
}

// One process-wide, unreferenced sweep, not one timer per tenant.
setInterval(() => {
     const cutoff = Date.now() - IDLE_MS;
     for (const [id, entry] of tenantConnections) {
          if (entry.config && !entry.closing && entry.active === 0 && entry.lastUsed <= cutoff) {
               void closeTenant(id, entry).catch(error => {
                    console.error(`Failed to close idle tenant connection ${id}`, error);
               });
          }
     }
}, 30000).unref();

export { KnexConnectionTenant, primeTenancyConnector, releaseTenantConnection, getTenantConnectionStats };
