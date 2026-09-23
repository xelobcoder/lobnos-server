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
const AMOUNT_BOUND_PERMISSIONS: AuthorityPermission[] = ['expense.approve', 'expense.pay', 'purchase_order.pay'];
const EXPLICIT_DELEGATION_PERMISSIONS: AuthorityPermission[] = [
     'expense.pay',
     'expense.override_approval',
     'expense.override_sod',
     'accounting.daily_close.submit',
     'accounting.daily_close.manager_approve',
     'accounting.daily_close.finalize',
     'accounting.daily_close.view_audit',
     'accounting.financial_correction.execute',
];

export const ACCOUNTING_ROLES = ['admin', 'super_admin', 'super-admin', 'accountant'];

/** Roles that may hand out authority. Deliberately excludes accountant. */
export const OWNER_ONLY_ROLES = ['admin', 'super_admin', 'super-admin'];

export class AuthorityService implements IAuthorityService {
     constructor(private tenantId: number) { }

     private async connection() {
          return KnexConnection(this.tenantId);
     }

     async can(employeeid: number, permission: AuthorityPermission, amount?: number | null, branchid?: number | null): Promise<AuthorityDecision> {
          if (!employeeid) {
               return { allowed: false, reason: 'No employee identified on the request', delegationId: null, source: 'denied' };
          }

          const db = await this.connection();
          const delegations = await db('authority_delegations')
               .where({ employeeid, permission, is_active: true })
               .andWhere((builder: any) => builder.whereNull('expires_at').orWhere('expires_at', '>=', new Date()))
               .orderBy('id', 'desc')
               .limit(2);

          if (delegations.length > 1) {
               return { allowed: false, reason: 'Duplicate active authority grants require administrator correction', delegationId: null, source: 'denied' };
          }

          const delegation = delegations[0];

          if (!delegation) {
               const role = await resolveRole(this.tenantId, employeeid);
               if (OWNER_ROLES.includes(role) && !EXPLICIT_DELEGATION_PERMISSIONS.includes(permission)) {
                    return { allowed: true, reason: 'Granted by role', delegationId: null, source: 'role' };
               }
               return {
                    allowed: false,
                    reason: `You have not been delegated authority to ${describe(permission)}`,
                    delegationId: null,
                    source: 'denied',
               };
          }

          if (EXPLICIT_DELEGATION_PERMISSIONS.includes(permission) && (branchid === null || branchid === undefined || delegation.branchid === null)) {
               return { allowed: false, reason: 'This authority requires an explicit branch-scoped delegation', delegationId: delegation.id, source: 'denied' };
          }

          if (delegation.branchid !== null && branchid !== null && branchid !== undefined && Number(delegation.branchid) !== Number(branchid)) {
               return {
                    allowed: false,
                    reason: `Your delegated authority does not cover branch ${branchid}`,
                    delegationId: delegation.id,
                    source: 'denied',
               };
          }

          if (AMOUNT_BOUND_PERMISSIONS.includes(permission)) {
               const value = Number(amount);
               const min = delegation.min_amount === null ? null : Number(delegation.min_amount);
               const max = delegation.max_amount === null ? null : Number(delegation.max_amount);

               if (!Number.isFinite(value)) return { allowed: false, reason: 'A valid amount is required for this authority check', delegationId: delegation.id, source: 'denied' };
               if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max))) return { allowed: false, reason: 'This authority grant has invalid monetary limits', delegationId: delegation.id, source: 'denied' };

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
          this.validateLimits(input.minAmount, input.maxAmount);
          return db.transaction(async (trx) => {
               const active = await trx('authority_delegations').where({ employeeid: input.employeeid, permission: input.permission, is_active: true }).forUpdate();
               if (active.length > 1) throw new Error('Duplicate active authority grants require administrator correction');
               if (active.length === 1) await trx('authority_delegations').where({ id: active[0].id }).update({ is_active: false, revoked_by: input.grantedBy, revoked_at: new Date() });
               const [id] = await trx('authority_delegations').insert({
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
                    replaces_delegation_id: active[0]?.id ?? null,
               });
               return trx('authority_delegations').where({ id }).first();
          });
     }

     async revise(id: number, input: Pick<GrantDelegationInput, 'minAmount' | 'maxAmount' | 'branchid' | 'expiresAt' | 'notes' | 'grantedBy'>): Promise<AuthorityDelegation> {
          const db = await this.connection();
          this.validateLimits(input.minAmount, input.maxAmount);
          return db.transaction(async (trx) => {
               const current = await trx('authority_delegations').where({ id, is_active: true }).forUpdate().first();
               if (!current) throw new Error('Active authority delegation not found');
               await trx('authority_delegations').where({ id }).update({ is_active: false, revoked_by: input.grantedBy, revoked_at: new Date() });
               const [newId] = await trx('authority_delegations').insert({
                    employeeid: current.employeeid,
                    permission: current.permission,
                    min_amount: input.minAmount ?? null,
                    max_amount: input.maxAmount ?? null,
                    branchid: input.branchid ?? current.branchid ?? null,
                    is_active: true,
                    granted_by: input.grantedBy,
                    granted_at: new Date(),
                    expires_at: input.expiresAt ? new Date(input.expiresAt) : null,
                    notes: input.notes ?? null,
                    replaces_delegation_id: id,
               });
               return trx('authority_delegations').where({ id: newId }).first();
          });
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

     private validateLimits(minAmount?: number | null, maxAmount?: number | null): void {
          if (minAmount !== null && minAmount !== undefined && (!Number.isFinite(Number(minAmount)) || Number(minAmount) < 0)) throw new Error('Minimum amount must be a valid non-negative number');
          if (maxAmount !== null && maxAmount !== undefined && (!Number.isFinite(Number(maxAmount)) || Number(maxAmount) < 0)) throw new Error('Maximum amount must be a valid non-negative number');
          if (minAmount !== null && minAmount !== undefined && maxAmount !== null && maxAmount !== undefined && Number(minAmount) > Number(maxAmount)) throw new Error('The lower limit cannot exceed the upper limit');
     }
}

export async function ensureAuthorityTable(tenantId: number): Promise<void> {
     const knex = await KnexConnection(tenantId);
     if (!(await knex.schema.hasTable('authority_delegations'))) await knex.schema.createTable('authority_delegations', (table) => {
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
          table.integer('replaces_delegation_id').unsigned().nullable();
          table.index(['employeeid', 'permission', 'is_active'], 'idx_authority_lookup');
     });
     if (!(await knex.schema.hasColumn('authority_delegations', 'replaces_delegation_id'))) {
          await knex.schema.alterTable('authority_delegations', (table) => table.integer('replaces_delegation_id').unsigned().nullable());
     }
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
