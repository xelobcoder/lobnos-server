import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';

export const DEFAULT_PIN_ATTEMPT_LIMIT = 5;
export const MAX_PIN_ATTEMPT_LIMIT = 20;
export const isPinAttemptLimit = (value: unknown): value is number =>
     typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= MAX_PIN_ATTEMPT_LIMIT;

export class StaffPinSecurityError extends Error {
     constructor(message: string, public readonly statusCode: number) { super(message); }
}

export function pinAttemptLimit(settings: any): number {
     const limit = Number(settings?.pinAttemptLimit ?? DEFAULT_PIN_ATTEMPT_LIMIT);
     if (!isPinAttemptLimit(limit)) throw new StaffPinSecurityError('PIN security settings are unavailable', 503);
     return limit;
}

export class StaffPinSecurity {
     constructor(private readonly tenantId: number) {}

     private authorize(actor: AuthUser) {
          if (actor.tenantId !== this.tenantId || !roleAllowed(actor.role, ['admin', 'super_admin', 'super-admin'])) {
               throw new StaffPinSecurityError('Only an administrator may manage PIN security', 403);
          }
     }

     async policy() {
          const db = await KnexConnection(this.tenantId);
          return { pinAttemptLimit: pinAttemptLimit(await db('applicationsettings').where({ keyid: 1 }).first()) };
     }

     async updatePolicy(actor: AuthUser, limit: number, reason: string) {
          this.authorize(actor);
          if (!isPinAttemptLimit(limit)) throw new StaffPinSecurityError('pinAttemptLimit must be an integer from 1 to 20', 400);
          this.validateReason(reason);
          const db = await KnexConnection(this.tenantId);
          await db.transaction(async trx => {
               const settings = await trx('applicationsettings').where({ keyid: 1 }).forUpdate().first();
               if (!settings) throw new StaffPinSecurityError('Application settings must be initialized first', 409);
               await trx('applicationsettings').where({ keyid: 1 }).update({ pinAttemptLimit: limit });
               await trx('staff_pin_security_events').insert({
                    event_type: 'policy_updated', actor_employeeid: actor.employeeid,
                    previous_limit: pinAttemptLimit(settings), attempt_limit: limit, reason: reason.trim(),
               });
          });
          return { pinAttemptLimit: limit };
     }

     async list(actor: AuthUser, page: number, count: number) {
          this.authorize(actor);
          const db = await KnexConnection(this.tenantId);
          // Explicit projection: never return credentials or PIN hashes to this surface.
          return db('roles as r').leftJoin('staff_pin_security as s', 's.employeeid', 'r.employeeid')
               .select('r.employeeid', 'r.username', 'r.role', 's.failed_attempts', 's.locked_at')
               .orderBy('r.employeeid').limit(count).offset((page - 1) * count);
     }

     async reset(actor: AuthUser, employeeid: number, reason: string) {
          this.authorize(actor);
          this.validateReason(reason);
          const db = await KnexConnection(this.tenantId);
          await db.transaction(async trx => {
               // Same lock as verification, including first-time state creation.
               const employee = await trx('roles').where({ employeeid }).select('employeeid').forUpdate().first();
               if (!employee) throw new StaffPinSecurityError('Staff account not found', 404);
               const state = await trx('staff_pin_security').where({ employeeid }).first();
               if (!state?.locked_at) throw new StaffPinSecurityError('PIN attempts are not exhausted', 409);
               const settings = await trx('applicationsettings').where({ keyid: 1 }).first();
               await trx('staff_pin_security').where({ employeeid }).update({ failed_attempts: 0, locked_at: null });
               await trx('staff_pin_security_events').insert({
                    event_type: 'reset', actor_employeeid: actor.employeeid, target_employeeid: employeeid,
                    previous_attempts: state.failed_attempts, attempt_limit: pinAttemptLimit(settings), reason: reason.trim(),
               });
          });
          return { employeeid, failed_attempts: 0, locked_at: null };
     }

     private validateReason(reason: string) {
          if (typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 255) {
               throw new StaffPinSecurityError('A reason of 3 to 255 characters is required', 400);
          }
     }
}
