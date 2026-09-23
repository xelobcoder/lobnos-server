import KnexConnection from '../../database/KnexConnections';
import RolesRepository from '../../models/settings/users/RolesRepository';
import { AuthUser } from '../../middleware/authority';
import {
     FinancialPinContext,
     FinancialPinVerificationResult,
     IFinancialPinVerificationService,
} from '../interfaces/IFinancialPinVerificationService';

const FAILURE_LIMIT = 5;
const WINDOW_MINUTES = 15;

export class FinancialPinError extends Error {
     constructor(message: string, public readonly code: 'INVALID_PIN' | 'PIN_RATE_LIMITED' | 'PIN_AUDIT_FAILED') {
          super(message);
          this.name = 'FinancialPinError';
     }
}

export class FinancialPinVerificationService implements IFinancialPinVerificationService {
     constructor(private readonly tenantId: number, private readonly connectionOverride?: any) { }

     async verify(actor: AuthUser, pin: string, context: FinancialPinContext): Promise<FinancialPinVerificationResult> {
          const connection = this.connectionOverride || await KnexConnection(this.tenantId);
          const normalizedPin = String(pin || '').trim();
          const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
          const failures = await connection('financial_authorization_attempts')
               .where('attempted_at', '>=', since)
               .whereIn('result', ['failure', 'rate_limited'])
               .andWhere((builder: any) => {
                    builder.where('actor_employeeid', actor.employeeid);
                    if (context.ipAddress) builder.orWhere('ip_address', context.ipAddress);
               })
               .count('* as count')
               .first();

          if (Number(failures?.count || 0) >= FAILURE_LIMIT) {
               await this.record(connection, actor, context, 'rate_limited', 'too_many_failures');
               throw new FinancialPinError('Too many failed PIN attempts. Try again later.', 'PIN_RATE_LIMITED');
          }

          if (!/^\d{4}$/.test(normalizedPin)) {
               await this.record(connection, actor, context, 'failure', 'invalid_format');
               throw new FinancialPinError('Invalid pin', 'INVALID_PIN');
          }

          const valid = await new RolesRepository(this.tenantId).validatePin(actor.employeeid, normalizedPin);
          if (!valid) {
               await this.record(connection, actor, context, 'failure', 'mismatch');
               throw new FinancialPinError('Invalid pin', 'INVALID_PIN');
          }

          const verifiedAt = new Date();
          await this.record(connection, actor, context, 'success', null, verifiedAt);
          return { valid: true, verifiedAt };
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
