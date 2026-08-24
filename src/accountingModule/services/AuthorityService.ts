import KnexConnection from '../../database/KnexConnections';
import RolesRepository from '../../models/settings/users/RolesRepository';
import {
     AuthorityDecision,
     AuthorityDelegation,
     AuthorityPermission,
     GrantDelegationInput,
     IAuthorityService,
} from '../interfaces/IAuthorityService';

const OWNER_ROLES = ['admin', 'super_admin', 'super-admin'];
const AMOUNT_BOUND_PERMISSIONS: AuthorityPermission[] = ['expense.pay', 'purchase_order.pay'];

export const ACCOUNTING_ROLES = ['admin', 'super_admin', 'super-admin', 'accountant'];

/** Roles that may hand out authority. Deliberately excludes accountant. */
export const OWNER_ONLY_ROLES = ['admin', 'super_admin', 'super-admin'];

export class AuthorityService implements IAuthorityService {
     constructor(private tenantId: number) { }

     private async connection() {
          await ensureAuthorityTable(this.tenantId);
          return KnexConnection(this.tenantId);
     }

     async can(employeeid: number, permission: AuthorityPermission, amount?: number | null): Promise<AuthorityDecision> {
          if (!employeeid) {
               return { allowed: false, reason: 'No employee identified on the request', delegationId: null, source: 'denied' };
          }

          const role = await resolveRole(this.tenantId, employeeid);
          if (OWNER_ROLES.includes(role)) {
               return { allowed: true, reason: 'Granted by role', delegationId: null, source: 'role' };
          }

          const db = await this.connection();
          const delegation = await db('authority_delegations')
               .where({ employeeid, permission, is_active: true })
               .andWhere((builder: any) => builder.whereNull('expires_at').orWhere('expires_at', '>=', new Date()))
               .first();

          if (!delegation) {
               return {
                    allowed: false,
                    reason: `You have not been delegated authority to ${describe(permission)}`,
                    delegationId: null,
                    source: 'denied',
               };
          }

          if (AMOUNT_BOUND_PERMISSIONS.includes(permission)) {
               const value = Number(amount || 0);
               const min = delegation.min_amount === null ? null : Number(delegation.min_amount);
               const max = delegation.max_amount === null ? null : Number(delegation.max_amount);

               if (min !== null && value < min) {
                    return {
                         allowed: false,
                         reason: `Your delegated authority starts at ${min.toFixed(2)}; this payment is ${value.toFixed(2)}`,
                         delegationId: delegation.id,
                         source: 'denied',
                    };
               }

               if (max !== null && value > max) {
                    return {
                         allowed: false,
                         reason: `Your delegated authority is capped at ${max.toFixed(2)}; this payment is ${value.toFixed(2)}`,
                         delegationId: delegation.id,
                         source: 'denied',
                    };
               }
          }

          return { allowed: true, reason: 'Granted by delegation', delegationId: delegation.id, source: 'delegation' };
     }

     async grant(input: GrantDelegationInput): Promise<AuthorityDelegation> {
          const db = await this.connection();

          await db('authority_delegations')
               .where({ employeeid: input.employeeid, permission: input.permission, is_active: true })
               .update({ is_active: false, revoked_by: input.grantedBy, revoked_at: new Date() });

          const [id] = await db('authority_delegations').insert({
               employeeid: input.employeeid,
               permission: input.permission,
               min_amount: input.minAmount ?? null,
               max_amount: input.maxAmount ?? null,
               branchid: input.branchid ?? null,
               is_active: true,
               granted_by: input.grantedBy,
               granted_at: new Date(),
               expires_at: input.expiresAt ? new Date(input.expiresAt) : null,
               notes: input.notes ?? null,
          });

          return db('authority_delegations').where({ id }).first();
     }

     async revoke(id: number, revokedBy: number): Promise<void> {
          const db = await this.connection();
          await db('authority_delegations')
               .where({ id })
               .update({ is_active: false, revoked_by: revokedBy, revoked_at: new Date() });
     }

     async listForEmployee(employeeid: number): Promise<AuthorityDelegation[]> {
          const db = await this.connection();
          return db('authority_delegations').where({ employeeid }).orderBy('id', 'desc');
     }

     async list(filters: { permission?: AuthorityPermission; activeOnly?: boolean } = {}): Promise<AuthorityDelegation[]> {
          const db = await this.connection();
          const query = db('authority_delegations as d')
               .leftJoin('roles as r', 'd.employeeid', 'r.employeeid')
               .select('d.*', 'r.username', 'r.role')
               .orderBy('d.id', 'desc');

          if (filters.permission) query.where('d.permission', filters.permission);
          if (filters.activeOnly !== false) query.where('d.is_active', true);

          return query;
     }
}

export async function ensureAuthorityTable(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);
     if (await knex.schema.hasTable('authority_delegations')) return;

     await knex.schema.createTable('authority_delegations', (table) => {
          table.increments('id').primary().unsigned();
          table.integer('employeeid').unsigned().notNullable();
          table.string('permission', 60).notNullable();
          table.decimal('min_amount', 14, 2).nullable();
          table.decimal('max_amount', 14, 2).nullable();
          table.integer('branchid').unsigned().nullable();
          table.boolean('is_active').notNullable().defaultTo(true);
          table.integer('granted_by').unsigned().nullable();
          table.datetime('granted_at').notNullable().defaultTo(knex.fn.now());
          table.integer('revoked_by').unsigned().nullable();
          table.datetime('revoked_at').nullable();
          table.datetime('expires_at').nullable();
          table.string('notes', 255).nullable();
          table.index(['employeeid', 'permission', 'is_active'], 'idx_authority_lookup');
     });
}

async function resolveRole(tenantId: number, employeeid: number): Promise<string> {
     try {
          const row = await new RolesRepository(tenantId).getRoleById(employeeid);
          return row?.role ? String(row.role).toLowerCase().trim() : '';
     } catch {
          return '';
     }
}

function describe(permission: AuthorityPermission): string {
     return permission.replace(/\./g, ' ').replace(/_/g, ' ');
}
