# Tenant database connection pools

Tenant mysql2 and Knex pools are created on demand, retained while active, and
closed after the configured idle timeout. Pool allocations reserve their full
configured maximum against a per-process budget; closing pools remain reserved
until teardown succeeds.

| Environment variable | Default | Purpose |
| --- | ---: | --- |
| `TENANT_DB_CONNECTION_BUDGET` | `100` | Maximum reserved connections across tenant mysql2 and Knex pools in this process |
| `TENANT_DB_CACHE_MAX_ENTRIES` | `100` | Maximum tenant registry/pool entries retained in this process |
| `TENANT_DB_MYSQL_POOL_MAX` | `5` | Maximum connections in each tenant mysql2 pool |
| `TENANT_DB_KNEX_POOL_MAX` | `5` | Maximum connections in each tenant Knex pool |
| `TENANT_DB_IDLE_TIMEOUT_MS` | `300000` | Idle time before an unused tenant's pools are closed |

Values must be positive integers. Pool maxima must each fit within the
connection budget. The maximum reserved capacity is bounded by both the
connection budget and the entry limit multiplied by the sum of the per-tenant
pool maxima.

When capacity is fully occupied by active tenants or pools that cannot yet be
closed, new tenant pool acquisition fails explicitly with a retryable capacity
error. Idle entries are evicted before rejecting acquisition.

`getTenantConnectionStats()` in
[`tenantConnections.ts`](../src/models/Tenancy/tenantConnections.ts) returns a
credential-free snapshot of entries, active checkouts, allocated pools, and
reserved capacity. Reserved capacity is a configured upper bound, not a live
socket count.

The budget applies only to tenant pools managed by this module in one process.
Control/registry and single-tenant pools, other services, and additional server
processes require separate headroom in database connection sizing.
