import type { Knex } from 'knex';

export const TENANT_BOOTSTRAP_STATE_TABLE = 'pls_tenant_bootstrap_state';
/** Increment when a tenant schema or data bootstrap changes. */
export const TENANT_BOOTSTRAP_STATE_VERSION = 1;

export function tenantStartupMigrationEnabled(value = process.env.TENANT_STARTUP_MIGRATION): boolean {
     if (value === undefined || value.trim() === '') return false;
     if (value.trim().toLowerCase() === 'true') return true;
     if (value.trim().toLowerCase() === 'false') return false;
     throw new Error('TENANT_STARTUP_MIGRATION must be set to true or false');
}

async function ensureStateTable(db: Knex): Promise<void> {
     if (await db.schema.hasTable(TENANT_BOOTSTRAP_STATE_TABLE)) return;
     try {
          await db.schema.createTable(TENANT_BOOTSTRAP_STATE_TABLE, table => {
               table.tinyint('id').unsigned().primary();
               table.integer('version').unsigned().notNullable();
               table.timestamp('completed_at').notNullable().defaultTo(db.fn.now());
          });
     } catch (error: any) {
          if (error?.code !== 'ER_TABLE_EXISTS_ERROR') throw error;
     }
}

export async function hasCurrentTenantBootstrap(db: Knex): Promise<boolean> {
     if (!(await db.schema.hasTable(TENANT_BOOTSTRAP_STATE_TABLE))) return false;
     const state = await db(TENANT_BOOTSTRAP_STATE_TABLE).where({ id: 1 }).first('version');
     const version = Number(state?.version ?? 0);
     if (version > TENANT_BOOTSTRAP_STATE_VERSION) {
          throw new Error(`Tenant schema version ${version} is newer than this application supports`);
     }
     return version === TENANT_BOOTSTRAP_STATE_VERSION;
}

export async function recordTenantBootstrapCompletion(db: Knex): Promise<void> {
     await ensureStateTable(db);
     await db(TENANT_BOOTSTRAP_STATE_TABLE).insert({
          id: 1,
          version: TENANT_BOOTSTRAP_STATE_VERSION,
          completed_at: db.fn.now(),
     }).onConflict('id').merge({
          version: TENANT_BOOTSTRAP_STATE_VERSION,
          completed_at: db.fn.now(),
     });
}
