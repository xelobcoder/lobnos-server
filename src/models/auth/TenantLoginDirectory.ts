import { Knex } from 'knex';
import { systemConfigConnection } from '../../database/connection';
import logger from '../../hooks/logger';

export type LoginEntityType = 'staff' | 'patient' | 'clinician';

export interface TenantLoginDirectoryEntry {
     loginUsername: string;
     email?: string | null;
     entityType: LoginEntityType;
     entityId: number;
     isActive?: boolean;
}

export type TenantResolution =
     | { status: 'resolved'; tenantId: number; source: 'directory-username' | 'directory-email' | 'username-pattern' }
     | { status: 'ambiguous' }
     | { status: 'not-found' };

export const TENANT_LOGIN_DIRECTORY_TABLE = 'tenant_login_directory';

const ENTITY_CODES: Record<LoginEntityType, string> = { staff: 'S', patient: 'P', clinician: 'C' };
const TENANT_USERNAME_PATTERN = /-T(\d+)-([SPC])(\d+)$/i;
const CHUNK_SIZE = 500;

/**
 * Decodes the tenant embedded in a generated login username, e.g. `PLSRG-T3-S0012` -> tenant 3, staff 12.
 * Returns null for legacy usernames that do not carry a tenant segment.
 */
export function parseTenantLoginUsername(loginUsername: string): { tenantId: number; entityType: LoginEntityType; entityId: number } | null {
     const match = String(loginUsername || '').trim().match(TENANT_USERNAME_PATTERN);
     if (!match) return null;
     const tenantId = Number(match[1]);
     const entityId = Number(match[3]);
     if (!Number.isSafeInteger(tenantId) || tenantId <= 0 || !Number.isSafeInteger(entityId)) return null;
     const code = match[2].toUpperCase();
     const entityType = (Object.keys(ENTITY_CODES) as LoginEntityType[]).find((type) => ENTITY_CODES[type] === code)!;
     return { tenantId, entityType, entityId };
}

let schemaReady: Promise<void> | null = null;

export function ensureTenantLoginDirectorySchema(connection: Knex = systemConfigConnection): Promise<void> {
     if (!schemaReady) {
          schemaReady = (async () => {
               if (await connection.schema.hasTable(TENANT_LOGIN_DIRECTORY_TABLE)) return;
               await connection.schema.createTable(TENANT_LOGIN_DIRECTORY_TABLE, (table) => {
                    table.increments('id').unsigned().primary();
                    table.string('login_username', 64).notNullable();
                    table.string('email', 255).nullable();
                    table.enu('entity_type', ['staff', 'patient', 'clinician']).notNullable();
                    table.integer('entity_id').unsigned().notNullable();
                    table.integer('tenant_id').unsigned().notNullable();
                    table.boolean('is_active').notNullable().defaultTo(true);
                    table.timestamp('last_login_at').nullable();
                    table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
                    table.timestamp('updated_at').notNullable().defaultTo(connection.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
                    table.unique(['login_username'], { indexName: 'uq_tenant_login_directory_login_username' });
                    table.unique(['tenant_id', 'entity_type', 'entity_id'], { indexName: 'uq_tenant_login_directory_entity' });
                    table.index(['email', 'entity_type'], 'idx_tenant_login_directory_email');
               });
               logger.info(`[TenantLoginDirectory] Created ${TENANT_LOGIN_DIRECTORY_TABLE}`);
          })().catch((error) => {
               schemaReady = null;
               throw error;
          });
     }
     return schemaReady;
}

/**
 * Fire-and-forget publication of a new login. When called inside a transaction the entry is only
 * published after a successful commit, so rolled-back accounts never reach the directory.
 */
export function publishLoginToDirectory(tenantId: number, entry: TenantLoginDirectoryEntry, db?: Knex | Knex.Transaction): void {
     const publish = () => new TenantLoginDirectory().register(tenantId, entry)
          .then((registered) => {
               if (!registered) logger.warn(`[TenantLoginDirectory] Username "${entry.loginUsername}" is already used by another account`);
          })
          .catch((error) => logger.error('[TenantLoginDirectory] Failed to publish login:', error));

     const executionPromise = (db as Knex.Transaction | undefined)?.isTransaction ? (db as Knex.Transaction).executionPromise : undefined;
     if (executionPromise) {
          executionPromise.then(publish, () => undefined);
     } else {
          publish();
     }
}

/**
 * Platform-wide directory that maps every login username (and email) to the tenant that owns it,
 * so users can sign in with only a username and password.
 */
export class TenantLoginDirectory {
     constructor(private connection: Knex = systemConfigConnection) { }

     private table() {
          return this.connection(TENANT_LOGIN_DIRECTORY_TABLE);
     }

     async resolveTenant(identifier: string, entityType: LoginEntityType): Promise<TenantResolution> {
          const value = String(identifier || '').trim();
          if (!value) return { status: 'not-found' };

          await ensureTenantLoginDirectorySchema(this.connection);

          const byUsername = await this.table()
               .select('tenant_id')
               .where({ login_username: value, entity_type: entityType, is_active: true })
               .first();
          if (byUsername) return { status: 'resolved', tenantId: Number(byUsername.tenant_id), source: 'directory-username' };

          if (value.includes('@')) {
               const tenants = await this.table()
                    .distinct('tenant_id')
                    .where({ email: value, entity_type: entityType, is_active: true });
               if (tenants.length > 1) return { status: 'ambiguous' };
               if (tenants.length === 1) return { status: 'resolved', tenantId: Number(tenants[0].tenant_id), source: 'directory-email' };
          }

          const parsed = parseTenantLoginUsername(value);
          if (parsed && parsed.entityType === entityType) {
               return { status: 'resolved', tenantId: parsed.tenantId, source: 'username-pattern' };
          }

          return { status: 'not-found' };
     }

     /** Registers or refreshes a single account. Returns false when the username belongs to another account. */
     async register(tenantId: number, entry: TenantLoginDirectoryEntry): Promise<boolean> {
          const { conflicts } = await this.syncTenant(tenantId, [entry]);
          return conflicts.length === 0;
     }

     async recordLogin(tenantId: number, entry: TenantLoginDirectoryEntry): Promise<void> {
          if (!(await this.register(tenantId, entry))) return;
          await this.table()
               .where({ tenant_id: tenantId, entity_type: entry.entityType, entity_id: entry.entityId })
               .update({ last_login_at: this.connection.fn.now() });
     }

     /**
      * Upserts the given accounts of one tenant. Entries whose username is already owned by a different
      * account (another tenant or another entity) are returned as conflicts and left untouched.
      */
     async syncTenant(tenantId: number, entries: TenantLoginDirectoryEntry[]): Promise<{ conflicts: TenantLoginDirectoryEntry[] }> {
          await ensureTenantLoginDirectorySchema(this.connection);

          const valid = entries
               .map((entry) => ({ ...entry, loginUsername: String(entry.loginUsername || '').trim() }))
               .filter((entry) => entry.loginUsername && Number.isSafeInteger(Number(entry.entityId)));
          const conflicts: TenantLoginDirectoryEntry[] = [];
          if (valid.length === 0) return { conflicts };

          const entityKey = (type: string, id: number | string) => `${type}:${Number(id)}`;
          const existingRows = await this.table()
               .select('id', 'login_username', 'email', 'entity_type', 'entity_id', 'is_active')
               .where({ tenant_id: tenantId });
          const existingByEntity = new Map<string, any>(existingRows.map((row: any) => [entityKey(row.entity_type, row.entity_id), row]));

          const ownersByUsername = new Map<string, any>();
          for (let index = 0; index < valid.length; index += CHUNK_SIZE) {
               const usernames = valid.slice(index, index + CHUNK_SIZE).map((entry) => entry.loginUsername);
               const owners = await this.table()
                    .select('login_username', 'tenant_id', 'entity_type', 'entity_id')
                    .whereIn('login_username', usernames);
               for (const owner of owners) ownersByUsername.set(String(owner.login_username).toLowerCase(), owner);
          }

          const inserts: any[] = [];
          const seenUsernames = new Set<string>();
          for (const entry of valid) {
               const usernameKey = entry.loginUsername.toLowerCase();
               const owner = ownersByUsername.get(usernameKey);
               const ownedByOther = owner && (
                    Number(owner.tenant_id) !== tenantId ||
                    owner.entity_type !== entry.entityType ||
                    Number(owner.entity_id) !== Number(entry.entityId)
               );
               if (ownedByOther || seenUsernames.has(usernameKey)) {
                    conflicts.push(entry);
                    continue;
               }
               seenUsernames.add(usernameKey);

               const row = {
                    login_username: entry.loginUsername,
                    email: entry.email ? String(entry.email).trim() || null : null,
                    entity_type: entry.entityType,
                    entity_id: Number(entry.entityId),
                    tenant_id: tenantId,
                    is_active: entry.isActive === false ? 0 : 1,
               };
               const existing = existingByEntity.get(entityKey(entry.entityType, entry.entityId));
               if (!existing) {
                    inserts.push(row);
               } else if (
                    existing.login_username !== row.login_username ||
                    (existing.email || null) !== row.email ||
                    Number(existing.is_active) !== row.is_active
               ) {
                    await this.table().where({ id: existing.id }).update({
                         login_username: row.login_username,
                         email: row.email,
                         is_active: row.is_active,
                    });
               }
          }

          for (let index = 0; index < inserts.length; index += CHUNK_SIZE) {
               await this.table().insert(inserts.slice(index, index + CHUNK_SIZE)).onConflict().ignore();
          }

          return { conflicts };
     }
}
