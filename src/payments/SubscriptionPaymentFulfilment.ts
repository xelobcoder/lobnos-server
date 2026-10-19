import { FacilityError } from '../models/Tenancy/FacilityInput';
import { FacilityManagementService } from '../models/Tenancy/FacilityManagementService';
import { FulfilmentOutcome, GatewayTransaction, IPaymentFulfilment, PayableQuote } from './types';

type SubscriptionApi = Pick<FacilityManagementService, 'quoteSubscriptionPeriod' | 'recordPayment' | 'findActivePaymentByReference'>;

/**
 * Applies a verified gateway payment to the facility subscription. Idempotent: the PLS reference is stored on the
 * subscription payment, so a retry after a crash finds the existing record instead of creating another.
 */
export class SubscriptionPaymentFulfilment implements IPaymentFulfilment {
     constructor(private subscriptions: SubscriptionApi, private today: () => string = () => new Date().toISOString().slice(0, 10)) { }

     quote(tenantId: number, periodStart: string): Promise<PayableQuote> {
          return this.subscriptions.quoteSubscriptionPeriod(tenantId, periodStart);
     }

     async fulfil(tx: GatewayTransaction): Promise<FulfilmentOutcome> {
          const already = await this.subscriptions.findActivePaymentByReference(tx.tenant_id, tx.reference);
          if (already) return { ok: true, reference: `payment:${already.id}` };
          try {
               const result: any = await this.subscriptions.recordPayment(tx.tenant_id, {
                    periodStart: tx.period_start, paidAt: this.today(), reference: tx.reference,
                    notes: `Online payment via ${tx.provider}`,
               }, { tenantId: tx.initiated_by_tenant_id, employeeId: tx.initiated_by_employee_id });
               return { ok: true, reference: `payment:${result?.payment?.id ?? tx.reference}` };
          } catch (error) {
               if (error instanceof FacilityError && error.statusCode === 409) {
                    const raced = await this.subscriptions.findActivePaymentByReference(tx.tenant_id, tx.reference);
                    if (raced) return { ok: true, reference: `payment:${raced.id}` };
                    return { ok: false, reason: `paid at provider but PLS cannot apply it: ${error.message}` };
               }
               throw error;
          }
     }
}
