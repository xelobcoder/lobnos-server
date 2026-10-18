import KnexConnection from '../../database/KnexConnections';
import bcrypt from 'bcrypt';
import { pinAttemptLimit } from '../../models/security/StaffPinSecurity';
import { AuthUser } from '../../middleware/authority';
import {
     FinancialPinContext,
     FinancialPinVerificationResult,
     IFinancialPinVerificationService,
} from '../interfaces/IFinancialPinVerificationService';

export class FinancialPinError extends Error {
     constructor(message: string, public readonly code: 'INVALID_PIN' | 'PIN_RATE_LIMITED' | 'PIN_AUDIT_FAILED') {
          super(message);
          this.name = 'FinancialPinError';
     }
}

export class FinancialPinVerificationService implements IFinancialPinVerificationService {
     constructor(private readonly tenantId: number) { }

     async verify(actor: AuthUser, pin: string, context: FinancialPinContext): Promise<FinancialPinVerificationResult> {
          try {
               return await this.verifyAndRecord(actor, pin, context);
          } catch (error) {
               if (error instanceof FinancialPinError) throw error;
               throw new FinancialPinError('Unable to validate PIN', 'PIN_AUDIT_FAILED');
          }
     }

     private async verifyAndRecord(actor: AuthUser, pin: string, context: FinancialPinContext): Promise<FinancialPinVerificationResult> {
          if (actor.tenantId !== this.tenantId) throw new FinancialPinError('Unable to validate PIN', 'INVALID_PIN');
          // Deliberately independent of financial transactions: rejected actions must not roll
          // back failed attempts or their audit records.
          const connection = await KnexConnection(this.tenantId);
          const normalizedPin = String(pin || '').trim();
          const outcome = await connection.transaction(async trx => {
               const employee = await trx('roles').where({ employeeid: actor.employeeid })
                    .select('employeeid', 'pin', 'pin_hash').forUpdate().first();
               if (!employee) return 'invalid' as const;
               const limit = pinAttemptLimit(await trx('applicationsettings').where({ keyid: 1 }).first());
               let state = await trx('staff_pin_security').where({ employeeid: actor.employeeid }).first();
               if (!state) {
                    state = { failed_attempts: 0, locked_at: null };
                    await trx('staff_pin_security').insert({ employeeid: actor.employeeid, ...state });
               }
               if (state.locked_at || Number(state.failed_attempts) >= limit) {
                    await trx('staff_pin_security').where({ employeeid: actor.employeeid }).update({ locked_at: state.locked_at || new Date() });
                    await this.record(trx, actor, context, 'rate_limited', 'too_many_failures');
                    return 'locked' as const;
               }
               const validFormat = /^\d{4}$/.test(normalizedPin);
               const valid = validFormat && (employee.pin_hash
                    ? await bcrypt.compare(normalizedPin, employee.pin_hash)
                    : employee.pin != null && String(employee.pin) === normalizedPin);
               if (!valid) {
                    const failedAttempts = Number(state.failed_attempts) + 1;
                    const locked = failedAttempts >= limit;
                    await trx('staff_pin_security').where({ employeeid: actor.employeeid }).update({
                         failed_attempts: failedAttempts, locked_at: locked ? new Date() : null,
                    });
                    await this.record(trx, actor, context, 'failure', validFormat ? 'mismatch' : 'invalid_format');
                    return locked ? 'locked' as const : 'invalid' as const;
               }
               if (!employee.pin_hash) {
                    await trx('roles').where({ employeeid: actor.employeeid }).update({
                         pin_hash: await bcrypt.hash(normalizedPin, 10), pin: null,
                    });
               }
               await trx('staff_pin_security').where({ employeeid: actor.employeeid }).update({ failed_attempts: 0, locked_at: null });
               const verifiedAt = new Date();
               await this.record(trx, actor, context, 'success', null, verifiedAt);
               return verifiedAt;
          });
          // Throw only AFTER commit, otherwise the counter and audit would be rolled back.
          if (outcome === 'locked') throw new FinancialPinError('PIN attempts exhausted. Contact an administrator to reset your attempts.', 'PIN_RATE_LIMITED');
          if (outcome === 'invalid') throw new FinancialPinError('Invalid pin', 'INVALID_PIN');
          return { valid: true, verifiedAt: outcome };
     }

     private async record(connection: any, actor: AuthUser, context: FinancialPinContext, result: 'success' | 'failure' | 'rate_limited' | 'error', failureCategory: string | null, attemptedAt = new Date()): Promise<void> {
          try {
               await connection('financial_authorization_attempts').insert({
                    actor_employeeid: actor.employeeid,
                    branchid: actor.branch,
                    purpose: context.purpose.slice(0, 60),
                    resource_type: context.resourceType?.slice(0, 40) || null,
                    resource_id: context.resourceId?.slice(0, 80) || null,
                    result,
                    failure_category: failureCategory,
                    ip_address: context.ipAddress?.slice(0, 45) || null,
                    user_agent: context.userAgent?.slice(0, 512) || null,
                    request_id: context.requestId?.slice(0, 64) || null,
                    attempted_at: attemptedAt,
               });
          } catch {
               throw new FinancialPinError('Unable to record PIN authorization attempt', 'PIN_AUDIT_FAILED');
          }
     }
}
