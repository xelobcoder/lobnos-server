import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
     registry: vi.fn(),
     mysql: vi.fn(),
     knex: vi.fn(),
     pools: [] as any[],
     instances: [] as any[],
}));
vi.mock("./TenantRegistry", () => ({
     TenantRegistry: class { requireTenant = mocks.registry; },
}));
vi.mock("mysql2/promise", () => ({ default: { createPool: mocks.mysql } }));
vi.mock("knex", () => ({ default: mocks.knex }));

function deferred<T>() {
     let resolve!: (value: T) => void;
     let reject!: (error: Error) => void;
     const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
     return { promise, resolve, reject };
}

let api: typeof import("./tenantConnections");
const settings = [
     "TENANT_DB_CACHE_MAX_ENTRIES", "TENANT_DB_IDLE_TIMEOUT_MS",
     "TENANT_DB_MYSQL_POOL_MAX", "TENANT_DB_KNEX_POOL_MAX", "TENANT_DB_CONNECTION_BUDGET",
];
async function configure(values: Record<string, string>) {
     vi.clearAllTimers();
     for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
     vi.resetModules();
     api = await import("./tenantConnections");
}
beforeEach(async () => {
     for (const name of settings) vi.stubEnv(name, undefined);
     vi.useFakeTimers();
     vi.resetModules();
     vi.clearAllMocks();
     mocks.pools.length = 0;
     mocks.instances.length = 0;
     mocks.registry.mockImplementation(async (id: number) => ({
          databaseName: `registered_${id}`, host: "registry-host", port: 3307,
     }));
     mocks.mysql.mockImplementation((config: any) => {
          const acquire = vi.fn(async () => ({
               release: vi.fn(), destroy: vi.fn(), query: vi.fn(async () => [[{ ok: true }], []]),
               execute: vi.fn(async () => [[{ ok: true }], []]),
               beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(),
          }));
          const pool = { config, getConnection: acquire, acquire, end: vi.fn(async () => undefined) };
          mocks.pools.push(pool);
          return pool;
     });
     mocks.knex.mockImplementation((config: any) => {
          const acquire = vi.fn(async () => ({}));
          const release = vi.fn(async () => undefined);
          const instance = {
               config, acquire, release,
               client: { acquireConnection: acquire, releaseConnection: release },
               destroy: vi.fn(async () => undefined),
          };
          mocks.instances.push(instance);
          return instance;
     });
     api = await import("./tenantConnections");
});
afterEach(() => {
     vi.clearAllTimers();
     vi.useRealTimers();
     vi.unstubAllEnvs();
});

describe("bounded tenant pool lifecycle", () => {
     it("coalesces registry lookups and lazily creates only the requested API's pool", async () => {
          const instances = await Promise.all(Array.from({ length: 10 }, () => api.KnexConnectionTenant(1)));
          expect(new Set(instances).size).toBe(1);
          expect(mocks.registry).toHaveBeenCalledTimes(1);
          expect(mocks.mysql).not.toHaveBeenCalled();
          expect(mocks.instances[0].config.pool).toMatchObject({ min: 0, max: 5 });
          const pools = await Promise.all([api.primeTenancyConnector(1), api.primeTenancyConnector(1)]);
          expect(pools[0]).toBe(pools[1]);
          expect(mocks.pools[0].config).toMatchObject({
               database: "registered_1", host: "registry-host", port: 3307, connectionLimit: 5,
          });
          await api.releaseTenantConnection(1);
     });

     it("validates IDs before any registry lookup and preserves lookup errors", async () => {
          for (const id of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
               await expect(api.KnexConnectionTenant(id)).rejects.toThrow("Invalid tenant ID");
          }
          expect(mocks.registry).not.toHaveBeenCalled();
          mocks.registry.mockRejectedValueOnce(new Error("Tenant not registered"));
          await expect(api.KnexConnectionTenant(1)).rejects.toThrow("Tenant not registered");
          await api.KnexConnectionTenant(1);
          expect(mocks.registry).toHaveBeenCalledTimes(2);
     });

     it("evicts idle entries, but retained Knex and mysql handles can acquire a fresh generation", async () => {
          const knex = await api.KnexConnectionTenant(1);
          const pool = await api.primeTenancyConnector(1);
          await vi.advanceTimersByTimeAsync(5 * 60_000);
          expect(mocks.instances[0].destroy).toHaveBeenCalledTimes(1);
          expect(mocks.pools[0].end).toHaveBeenCalledTimes(1);
          const raw = await knex.client.acquireConnection();
          await knex.client.releaseConnection(raw);
          const direct = await pool.getConnection();
          direct.release();
          expect(mocks.registry).toHaveBeenCalledTimes(2);
          expect(mocks.instances[1].release).toHaveBeenCalledWith(raw);
          expect(mocks.pools[1].acquire).toHaveBeenCalledTimes(1);
     });

     it("does not evict checked-out transactions and measures idle time from release", async () => {
          const knex = await api.KnexConnectionTenant(1);
          const pool = await api.primeTenancyConnector(1);
          const raw = await knex.client.acquireConnection();
          const direct = await pool.getConnection();
          await direct.beginTransaction();
          await vi.advanceTimersByTimeAsync(10 * 60_000);
          expect(mocks.pools[0].end).not.toHaveBeenCalled();
          expect(mocks.instances[0].destroy).not.toHaveBeenCalled();
          await direct.commit();
          direct.release();
          await knex.client.releaseConnection(raw);
          await vi.advanceTimersByTimeAsync(4 * 60_000);
          expect(mocks.pools[0].end).not.toHaveBeenCalled();
          await vi.advanceTimersByTimeAsync(60_000);
          expect(mocks.pools[0].end).toHaveBeenCalledTimes(1);
     });

     it("serializes concurrent release/acquisition and drains both APIs before replacement", async () => {
          const knex = await api.KnexConnectionTenant(1);
          const pool = await api.primeTenancyConnector(1);
          const raw = await knex.client.acquireConnection();
          const direct = await pool.getConnection();
          const ending = [api.releaseTenantConnection(1), api.releaseTenantConnection(1)];
          const next = api.KnexConnectionTenant(1);
          await vi.advanceTimersByTimeAsync(0);
          expect(mocks.registry).toHaveBeenCalledTimes(1);
          expect(mocks.pools[0].end).not.toHaveBeenCalled();
          direct.release();
          direct.release(); // Must not unpin a second checkout.
          await vi.advanceTimersByTimeAsync(0);
          expect(mocks.instances[0].destroy).not.toHaveBeenCalled();
          await knex.client.releaseConnection(raw);
          await Promise.all(ending);
          expect(await next).not.toBe(knex);
          expect(mocks.pools[0].end).toHaveBeenCalledTimes(1);
          expect(mocks.instances[0].destroy).toHaveBeenCalledTimes(1);
     });

     it("pins pending acquisitions and unpins failed ones", async () => {
          const knex = await api.KnexConnectionTenant(1);
          const acquiring = deferred<any>();
          mocks.instances[0].acquire.mockReturnValueOnce(acquiring.promise);
          const checkout = knex.client.acquireConnection();
          await vi.advanceTimersByTimeAsync(0);
          await vi.advanceTimersByTimeAsync(6 * 60_000);
          expect(mocks.instances[0].destroy).not.toHaveBeenCalled();
          const failure = expect(checkout).rejects.toThrow("connect failed");
          acquiring.reject(new Error("connect failed"));
          await failure;
          await vi.advanceTimersByTimeAsync(5 * 60_000);
          expect(mocks.instances[0].destroy).toHaveBeenCalledTimes(1);
     });

     it("tracks direct pool query/execute and propagates SQL errors without leaking a checkout", async () => {
          const pool = await api.primeTenancyConnector(1);
          await pool.query("SELECT ?", [1]);
          await pool.execute("SELECT ?", [2]);
          const sql = deferred<any>();
          const release = vi.fn();
          mocks.pools[0].acquire.mockResolvedValueOnce({
               query: () => sql.promise, release, destroy: vi.fn(),
          });
          const query = pool.query("SELECT ?", [3]);
          await vi.advanceTimersByTimeAsync(0);
          const ending = api.releaseTenantConnection(1);
          await vi.advanceTimersByTimeAsync(0);
          expect(mocks.pools[0].end).not.toHaveBeenCalled();
          const failure = expect(query).rejects.toThrow("SQL failed");
          sql.reject(new Error("SQL failed"));
          await failure;
          await ending;
          expect(release).toHaveBeenCalledTimes(1);
     });

     it("handles release during registry resolution without returning a closing generation", async () => {
          const lookup = deferred<any>();
          mocks.registry.mockReturnValueOnce(lookup.promise);
          const first = api.KnexConnectionTenant(1);
          const ending = api.releaseTenantConnection(1);
          const second = api.KnexConnectionTenant(1);
          lookup.resolve({ databaseName: "old_database" });
          await ending;
          expect(await first).toBe(await second);
          expect(mocks.registry).toHaveBeenCalledTimes(2);
          expect(mocks.instances[0].config.connection.database).toBe("registered_1");
     });

     it("keeps other tenants isolated during explicit release", async () => {
          const one = await api.KnexConnectionTenant(1);
          const two = await api.KnexConnectionTenant(2);
          await api.releaseTenantConnection(1);
          expect(await api.KnexConnectionTenant(2)).toBe(two);
          expect(mocks.instances[1].destroy).not.toHaveBeenCalled();
          expect(await api.KnexConnectionTenant(1)).not.toBe(one);
     });

     it("enforces the hard cap and evicts the least recently used idle entry", async () => {
          await configure({ TENANT_DB_CONNECTION_BUDGET: "1000" });
          for (let id = 1; id <= 100; id++) await api.KnexConnectionTenant(id);
          await vi.advanceTimersByTimeAsync(1);
          await api.KnexConnectionTenant(1);
          await api.KnexConnectionTenant(101);
          expect(mocks.instances[1].destroy).toHaveBeenCalledTimes(1);
          expect(mocks.instances[0].destroy).not.toHaveBeenCalled();
          expect(mocks.registry).toHaveBeenCalledTimes(101);
     });

     it("rejects new tenants when all slots are busy rather than exceeding the cap", async () => {
          await configure({ TENANT_DB_CONNECTION_BUDGET: "1000" });
          const checkouts: Array<[any, any]> = [];
          for (let id = 1; id <= 100; id++) {
               const knex = await api.KnexConnectionTenant(id);
               checkouts.push([knex, await knex.client.acquireConnection()]);
          }
          await expect(api.KnexConnectionTenant(101)).rejects.toThrow("capacity reached");
          expect(mocks.registry).toHaveBeenCalledTimes(100);
          for (const [knex, raw] of checkouts) await knex.client.releaseConnection(raw);
     });

     it("attempts both teardowns and surfaces explicit release failures", async () => {
          await api.KnexConnectionTenant(1);
          await api.primeTenancyConnector(1);
          mocks.pools[0].end.mockRejectedValueOnce(new Error("end failed"));
          await expect(api.releaseTenantConnection(1)).rejects.toThrow("end failed");
          expect(mocks.instances[0].destroy).toHaveBeenCalledTimes(1);
          await expect(api.KnexConnectionTenant(1)).rejects.toThrow("end failed");
          expect(mocks.registry).toHaveBeenCalledTimes(1);
     });

     it("reports frozen snapshots of allocations/checkouts including pending and closing work", async () => {
          const initial = api.getTenantConnectionStats();
          expect(initial).toMatchObject({
               entries: 0, activeCheckouts: 0, mysqlPools: 0, knexPools: 0,
               reservedConnections: 0, connectionBudget: 100,
          });
          expect(Object.isFrozen(initial)).toBe(true);
          const knex = await api.KnexConnectionTenant(1);
          await api.primeTenancyConnector(1);
          const acquiring = deferred<any>();
          mocks.instances[0].acquire.mockReturnValueOnce(acquiring.promise);
          const checkout = knex.client.acquireConnection();
          await vi.advanceTimersByTimeAsync(0);
          const ending = api.releaseTenantConnection(1);
          expect(api.getTenantConnectionStats()).toMatchObject({
               entries: 1, closingEntries: 1, activeCheckouts: 1,
               mysqlPools: 1, knexPools: 1, reservedConnections: 10,
          });
          const raw = {};
          acquiring.resolve(raw);
          await checkout;
          await knex.client.releaseConnection(raw);
          await ending;
          expect(api.getTenantConnectionStats()).toMatchObject({ entries: 0, reservedConnections: 0 });
          expect(initial.entries).toBe(0);
     });

     it("honors configured pool sizes, cache size and idle timeout without restricting tenant IDs", async () => {
          await configure({
               TENANT_DB_MYSQL_POOL_MAX: "2", TENANT_DB_KNEX_POOL_MAX: "3",
               TENANT_DB_CONNECTION_BUDGET: "8", TENANT_DB_CACHE_MAX_ENTRIES: "2",
               TENANT_DB_IDLE_TIMEOUT_MS: "30000",
          });
          await api.KnexConnectionTenant(Number.MAX_SAFE_INTEGER);
          await api.primeTenancyConnector(Number.MAX_SAFE_INTEGER);
          expect(mocks.instances[0].config.pool.max).toBe(3);
          expect(mocks.pools[0].config.connectionLimit).toBe(2);
          expect(api.getTenantConnectionStats()).toMatchObject({
               maxEntries: 2, reservedConnections: 5, connectionBudget: 8, idleTimeoutMs: 30000,
          });
          await vi.advanceTimersByTimeAsync(30000);
          expect(api.getTenantConnectionStats().entries).toBe(0);
     });

     it.each(["", "0", "-1", "1.5", "NaN", "Infinity", " 5", "9007199254740992"])(
          "rejects invalid environment value %j explicitly", async value => {
               await expect(configure({ TENANT_DB_CONNECTION_BUDGET: value }))
                    .rejects.toThrow("TENANT_DB_CONNECTION_BUDGET must be a positive integer");
          },
     );

     it("validates every cap, timer range and pool/budget compatibility", async () => {
          for (const name of settings) {
               await expect(configure({ [name]: "0" })).rejects.toThrow(name);
               vi.stubEnv(name, undefined);
          }
          await expect(configure({ TENANT_DB_IDLE_TIMEOUT_MS: "2147483648" }))
               .rejects.toThrow("TENANT_DB_IDLE_TIMEOUT_MS");
          vi.stubEnv("TENANT_DB_IDLE_TIMEOUT_MS", undefined);
          await expect(configure({ TENANT_DB_CONNECTION_BUDGET: "4" }))
               .rejects.toThrow("must fit within");
     });

     it("enforces the shared budget across concurrent mixed-driver requests", async () => {
          await configure({
               TENANT_DB_CONNECTION_BUDGET: "7",
               TENANT_DB_MYSQL_POOL_MAX: "2", TENANT_DB_KNEX_POOL_MAX: "3",
          });
          const knex = await api.KnexConnectionTenant(1);
          const raw = await knex.client.acquireConnection();
          const pool = await api.primeTenancyConnector(1);
          const direct = await pool.getConnection();
          const results = await Promise.allSettled([
               api.primeTenancyConnector(2), api.KnexConnectionTenant(3),
          ]);
          expect(results[0].status).toBe("fulfilled");
          expect(results[1].status).toBe("rejected");
          expect(api.getTenantConnectionStats()).toMatchObject({
               entries: 2, reservedConnections: 7, mysqlPools: 2, knexPools: 1,
          });
          expect(mocks.instances).toHaveLength(1);
          direct.release();
          await knex.client.releaseConnection(raw);
          // Budget pressure can evict an idle allocation, not reject a new valid identity.
          await api.KnexConnectionTenant(3);
          expect(api.getTenantConnectionStats().reservedConnections).toBeLessThanOrEqual(7);
     });

     it("can exhaust the budget on the second driver for the same tenant", async () => {
          await configure({ TENANT_DB_CONNECTION_BUDGET: "5" });
          await api.KnexConnectionTenant(1);
          await expect(api.primeTenancyConnector(1)).rejects.toThrow("budget capacity reached");
          expect(mocks.mysql).not.toHaveBeenCalled();
          expect(api.getTenantConnectionStats().reservedConnections).toBe(5);
     });

     it("limits default allocations to exactly 100 reserved connections, not 2000", async () => {
          const held: Array<[any, any]> = [];
          for (let id = 1; id <= 10; id++) {
               const knex = await api.KnexConnectionTenant(id);
               const pool = await api.primeTenancyConnector(id);
               held.push([knex, await knex.client.acquireConnection()]);
               const direct = await pool.getConnection();
               held.push([null, direct]);
          }
          expect(api.getTenantConnectionStats()).toMatchObject({
               entries: 10, mysqlPools: 10, knexPools: 10,
               reservedConnections: 100, activeCheckouts: 20,
          });
          await expect(api.KnexConnectionTenant(999999)).rejects.toThrow("budget capacity reached");
          expect(api.getTenantConnectionStats().reservedConnections).toBe(100);
          for (const [knex, connection] of held) {
               if (knex) await knex.client.releaseConnection(connection);
               else connection.release();
          }
     });

     it("does not reclaim reserved capacity until teardown completes or after teardown failure", async () => {
          await configure({ TENANT_DB_CONNECTION_BUDGET: "5" });
          await api.KnexConnectionTenant(1);
          const destroy = deferred<void>();
          mocks.instances[0].destroy.mockReturnValueOnce(destroy.promise);
          const ending = api.releaseTenantConnection(1);
          await vi.advanceTimersByTimeAsync(0);
          await expect(api.KnexConnectionTenant(2)).rejects.toThrow("budget capacity reached");
          expect(api.getTenantConnectionStats().reservedConnections).toBe(5);
          const failure = expect(ending).rejects.toThrow("destroy failed");
          destroy.reject(new Error("destroy failed"));
          await failure;
          await expect(api.KnexConnectionTenant(2)).rejects.toThrow("budget capacity reached");
          expect(api.getTenantConnectionStats()).toMatchObject({
               entries: 1, closingEntries: 1, reservedConnections: 5,
          });
     });

     it("drains a real Knex transaction before destroying its pool (fake MySQL transport)", async () => {
          // Exercise Knex/Tarn and transaction-client cloning, not just the mocked client.
          vi.useRealTimers();
          const realKnex = await vi.importActual<typeof import("knex")>("knex");
          mocks.knex.mockImplementationOnce(realKnex.default);
          const knex = await api.KnexConnectionTenant(1);
          const sql: string[] = [];
          const raw = {
               query: (query: any, bindings: any, callback?: Function) => {
                    sql.push(typeof query === "string" ? query : query.sql);
                    const done = typeof bindings === "function" ? bindings : callback;
                    done(null, [{ ok: true }], []);
               },
          };
          const destroy = vi.fn(async () => undefined);
          knex.client.acquireRawConnection = async () => raw;
          knex.client.destroyRawConnection = destroy;
          knex.client.validateConnection = () => true;
          const inside = deferred<void>();
          const proceed = deferred<void>();
          const transaction = knex.transaction(async trx => {
               await trx.raw("SELECT ?", [1]);
               inside.resolve();
               await proceed.promise;
               await trx.raw("SELECT ?", [2]);
          });
          await inside.promise;
          const ending = api.releaseTenantConnection(1);
          await new Promise(resolve => setTimeout(resolve, 10));
          expect(destroy).not.toHaveBeenCalled();
          proceed.resolve();
          await transaction;
          await ending;
          expect(sql).toContain("BEGIN;");
          expect(sql).toContain("COMMIT;");
          expect(destroy).toHaveBeenCalledTimes(1);
     });
});
