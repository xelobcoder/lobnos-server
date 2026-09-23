import { AuthUser } from '../../middleware/authority';

export interface FinancialPinContext {
     purpose: string;
     resourceType?: string | null;
     resourceId?: string | null;
     ipAddress?: string | null;
     userAgent?: string | null;
     requestId?: string | null;
}

export interface FinancialPinVerificationResult {
     valid: true;
     verifiedAt: Date;
}

export interface IFinancialPinVerificationService {
     /**
      * Verifies the authenticated employee's bcrypt PIN and appends a security audit attempt.
      * The submitted PIN is never persisted. Five failures by actor or IP within 15 minutes
      * temporarily block further attempts.
      */
     verify(actor: AuthUser, pin: string, context: FinancialPinContext): Promise<FinancialPinVerificationResult>;
}
