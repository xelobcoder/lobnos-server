export const GATEWAY_PROVIDERS = ['paystack', 'hubtel', 'payswitch'] as const;
export type GatewayProvider = typeof GATEWAY_PROVIDERS[number];

export type GatewayStatus =
     'initiated' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'refund_pending' | 'refunded';

export const OPEN_STATUSES: GatewayStatus[] = ['initiated', 'pending'];

/**
 * Forward-only lifecycle. 'expired' is a local deadline, so a provider-confirmed payment that arrives late can
 * still move expired -> succeeded. failed/cancelled are provider-confirmed and never flip silently: a later
 * "paid" report on those is flagged for manual review instead.
 */
export const ALLOWED_TRANSITIONS: Record<GatewayStatus, GatewayStatus[]> = {
     initiated: ['pending', 'succeeded', 'failed', 'cancelled', 'expired'],
     pending: ['succeeded', 'failed', 'cancelled', 'expired'],
     expired: ['succeeded'],
     failed: [],
     cancelled: [],
     succeeded: ['refund_pending', 'refunded'],
     refund_pending: ['refunded'],
     refunded: [],
};

export const canTransition = (from: GatewayStatus, to: GatewayStatus) => ALLOWED_TRANSITIONS[from]?.includes(to) === true;

export type GatewayPurpose = 'facility_subscription' | 'patient_bill';

export interface GatewayTransaction {
     id: number;
     reference: string;
     provider: GatewayProvider;
     provider_reference: string | null;
     purpose: GatewayPurpose;
     tenant_id: number;
     period_start: string | null;
     /** The payable item for tenant-collected purposes (the billing id for 'patient_bill'). */
     subject_id: number | null;
     /** Unique while the transaction is open so only one checkout per payable item can be in flight. */
     open_key: string | null;
     amount_minor: number;
     currency: string;
     status: GatewayStatus;
     needs_review: boolean;
     review_reason: string | null;
     checkout_url: string | null;
     initiated_by_tenant_id: number;
     initiated_by_employee_id: number;
     fulfilled_at: Date | string | null;
     fulfilment_ref: string | null;
     verify_attempts: number;
     last_verified_at: Date | string | null;
     expires_at: Date | string;
     created_at: Date | string;
     updated_at: Date | string;
}

export interface GatewayEvent {
     id?: number;
     transaction_id: number;
     source: 'initiate' | 'webhook' | 'return' | 'verify' | 'reconcile' | 'fulfil' | 'admin';
     event_type: string;
     event_hash?: string | null;
     from_status?: GatewayStatus | null;
     to_status?: GatewayStatus | null;
     detail?: string | null;
     created_at?: Date | string;
}

export interface InitiateRequest {
     reference: string;
     amountMinor: number;
     currency: string;
     email: string;
     description: string;
     returnUrl: string;
     callbackUrl: string;
}

export interface InitiateResult { providerReference: string | null; checkoutUrl: string; }

export type VerifiedState = 'succeeded' | 'pending' | 'failed' | 'cancelled' | 'refunded' | 'not_found';

export interface VerifyResult {
     status: VerifiedState;
     /** Minor units as reported by the provider; null when the provider response does not state an amount. */
     amountMinor: number | null;
     currency: string | null;
     providerReference: string | null;
}

export interface ParsedWebhook {
     reference: string;
     eventType: string;
     eventId: string | null;
}

export interface IPaymentGatewayAdapter {
     readonly provider: GatewayProvider;
     /** True when the provider signs webhooks. Unsigned providers get a PLS-issued URL token and always API verification. */
     readonly signedWebhooks: boolean;
     isConfigured(): boolean;
     generateReference(): string;
     initiate(request: InitiateRequest): Promise<InitiateResult>;
     verify(transaction: { reference: string; providerReference: string | null }): Promise<VerifyResult>;
     /** Throws GatewayError(401) when authenticity cannot be established. The result is never trusted as proof of payment. */
     authenticateWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): ParsedWebhook;
}

export class GatewayError extends Error {
     constructor(message: string, public readonly statusCode = 400, public readonly transient = false) {
          super(message);
          this.name = 'GatewayError';
     }
}

export interface PayableQuote {
     amountMinor: number;
     currency: string;
     periodStart: string;
     periodEnd: string;
}

export interface FulfilmentOutcome {
     ok: boolean;
     reference?: string;
     /** When ok is false: the transaction is paid at the provider but PLS could not apply it; an administrator must act. */
     reason?: string;
}

export interface IPaymentFulfilment {
     quote(tenantId: number, periodStart: string): Promise<PayableQuote>;
     fulfil(transaction: GatewayTransaction): Promise<FulfilmentOutcome>;
}

export interface ListFilter {
     status?: GatewayStatus; tenantId?: number; needsReview?: boolean; purpose?: GatewayPurpose; page: number; pageSize: number;
}

export type NewGatewayTransaction = Pick<GatewayTransaction,
     'reference' | 'provider' | 'provider_reference' | 'purpose' | 'tenant_id' | 'period_start' | 'open_key' | 'amount_minor' |
     'currency' | 'status' | 'checkout_url' | 'initiated_by_tenant_id' | 'initiated_by_employee_id' | 'expires_at'> & { subject_id?: number | null };

/** A tenant's own merchant account for one provider. The adapter carries only that tenant's credentials. */
export interface TenantGateway { adapter: IPaymentGatewayAdapter; currency: string; }

export interface ITenantGatewayResolver {
     /** Null when the tenant has not configured and enabled this provider; never falls back to platform credentials. */
     resolve(tenantId: number, provider: GatewayProvider): Promise<TenantGateway | null>;
}

export interface BillQuote { amountMinor: number; outstandingMinor: number; label: string; }

/** Applies verified gateway money to a tenant's patient bill. Provider logic never reaches this layer. */
export interface IBillPaymentFulfilment {
     quote(tenantId: number, billingId: number, requestedMinor?: number): Promise<BillQuote>;
     fulfil(transaction: GatewayTransaction): Promise<FulfilmentOutcome>;
}

export interface TenantPaymentSide { resolver: ITenantGatewayResolver; bills: IBillPaymentFulfilment; }

export interface IPaymentGatewayRepository {
     ensureSchema(): Promise<void>;
     /** Throws GatewayError(409) when another open transaction already holds the same open_key. */
     insert(values: NewGatewayTransaction): Promise<GatewayTransaction>;
     findByReference(reference: string): Promise<GatewayTransaction | null>;
     findOpenByKey(openKey: string): Promise<GatewayTransaction | null>;
     /** Compare-and-set: applies only while the current status is one of `from`. Returns false if another worker moved it. */
     transition(reference: string, from: GatewayStatus[], to: GatewayStatus, patch?: Partial<GatewayTransaction>): Promise<boolean>;
     patch(reference: string, patch: Partial<GatewayTransaction>): Promise<void>;
     markFulfilled(reference: string, fulfilmentRef: string): Promise<boolean>;
     appendEvent(event: GatewayEvent): Promise<void>;
     /** Returns false when this exact delivery was already processed. */
     recordWebhookEvent(transactionId: number, eventType: string, eventHash: string): Promise<boolean>;
     listReconcilable(olderThan: Date, limit: number): Promise<GatewayTransaction[]>;
     list(filter: ListFilter): Promise<{ rows: GatewayTransaction[]; total: number }>;
     events(transactionId: number): Promise<GatewayEvent[]>;
}
