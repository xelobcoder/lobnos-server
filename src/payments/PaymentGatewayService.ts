import { createHash } from 'crypto';
import { callbackToken, callbackTokenMatches } from './PaymentGatewayConfig';
import {
     GatewayError, GatewayProvider, GatewayStatus, GatewayTransaction, IPaymentFulfilment, IPaymentGatewayAdapter,
     GatewayPurpose, IPaymentGatewayRepository, ListFilter, OPEN_STATUSES, TenantPaymentSide, canTransition,
} from './types';

export interface PaymentServiceSettings {
     publicBaseUrl: string;
     returnUrl: string;
     webhookSecret: string;
     transactionTtlMinutes: number;
}

const GATEWAY_PROVIDER_LIST: readonly string[] = ['paystack', 'hubtel', 'payswitch'];

export interface GatewayActor { tenantId: number; employeeId: number; }

/** An unanswered "initiated" checkout older than this with no provider record is treated as abandoned. */
const NOT_FOUND_GRACE_MS = 15 * 60 * 1000;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

export interface VerifyOutcome { transaction: GatewayTransaction; verified: boolean; }

/**
 * Provider-neutral payment orchestration. The only way a transaction reaches 'succeeded' is an API verification
 * against the provider that confirms status, amount and (when reported) currency. Webhooks, redirects and client
 * input merely trigger that verification. Fulfilment (recording the subscription payment) is delegated and is
 * applied at most once per transaction.
 */
export class PaymentGatewayService {
     constructor(
          private repo: IPaymentGatewayRepository,
          private adapters: Partial<Record<GatewayProvider, IPaymentGatewayAdapter>>,
          private fulfilment: IPaymentFulfilment,
          private settings: PaymentServiceSettings,
          private now: () => Date = () => new Date(),
          private tenantSide?: TenantPaymentSide,
     ) { }

     private adapter(provider: string): IPaymentGatewayAdapter {
          const adapter = this.adapters[provider as GatewayProvider];
          if (!adapter) throw new GatewayError('Unknown payment provider', 404);
          return adapter;
     }

     private tenantGateways() {
          if (!this.tenantSide) throw new GatewayError('Tenant payments are not enabled on this server', 503);
          return this.tenantSide;
     }

     private async tenantGateway(tenantId: number, provider: string) {
          if (!GATEWAY_PROVIDER_LIST.includes(provider as GatewayProvider)) throw new GatewayError('Unknown payment provider', 404);
          const gateway = await this.tenantGateways().resolver.resolve(tenantId, provider as GatewayProvider);
          if (!gateway) throw new GatewayError('This payment provider is not configured for this facility', 503);
          return gateway;
     }

     /** The adapter that holds the credentials for the merchant account that owns this transaction. */
     private async adapterFor(tx: GatewayTransaction): Promise<IPaymentGatewayAdapter> {
          if (tx.purpose !== 'patient_bill') return this.adapter(tx.provider);
          try {
               return (await this.tenantGateway(tx.tenant_id, tx.provider)).adapter;
          } catch (error) {
               // A disabled or removed tenant gateway must not strand a paid transaction; reconciliation retries it.
               if (error instanceof GatewayError) throw new GatewayError(error.message, error.statusCode, true);
               throw error;
          }
     }

     providers() {
          return (Object.keys(this.adapters) as GatewayProvider[]).map(provider => ({
               provider, configured: this.adapters[provider]!.isConfigured(), signedWebhooks: this.adapters[provider]!.signedWebhooks,
          }));
     }

     private urls(provider: GatewayProvider, reference: string, tenantId?: number) {
          const base = this.settings.publicBaseUrl;
          const token = callbackToken(this.settings.webhookSecret, reference);
          const scope = tenantId ? `/${tenantId}` : '';
          return {
               callbackUrl: `${base}/api/v1/payments/webhooks/${provider}${scope}?k=${token}`,
               returnUrl: `${base}/api/v1/payments/return/${provider}?ref=${encodeURIComponent(reference)}`,
          };
     }

     /** The URL a tenant registers in its provider dashboard (Paystack) so signed events reach this facility's account. */
     tenantWebhookUrl(provider: GatewayProvider, tenantId: number) {
          return `${this.settings.publicBaseUrl}/api/v1/payments/webhooks/${provider}/${tenantId}`;
     }

     async initiate(input: { provider: string; tenantId: number; periodStart: string; email: string }, actor: GatewayActor) {
          const adapter = this.adapter(input.provider);
          const quote = await this.fulfilment.quote(input.tenantId, input.periodStart);
          return this.openCheckout({
               adapter, purpose: 'facility_subscription', tenantId: input.tenantId, email: input.email, actor,
               openKey: `facility_subscription:${input.tenantId}:${quote.periodStart}`, periodStart: quote.periodStart, subjectId: null,
               amountMinor: quote.amountMinor, currency: quote.currency, alreadyPaidMessage: 'This period has already been paid',
               description: `PLS subscription ${quote.periodStart} to ${quote.periodEnd}`,
          });
     }

     /** A tenant collects a patient's bill into the tenant's own merchant account. */
     async initiateBill(input: { provider: string; tenantId: number; billingId: number; email: string; amountMinor?: number }, actor: GatewayActor) {
          const gateway = await this.tenantGateway(input.tenantId, input.provider);
          const quote = await this.tenantGateways().bills.quote(input.tenantId, input.billingId, input.amountMinor);
          return this.openCheckout({
               adapter: gateway.adapter, purpose: 'patient_bill', tenantId: input.tenantId, email: input.email, actor,
               openKey: `patient_bill:${input.tenantId}:${input.billingId}`, periodStart: null, subjectId: input.billingId,
               amountMinor: quote.amountMinor, currency: gateway.currency, alreadyPaidMessage: 'This payment has already been collected',
               description: quote.label,
          });
     }

     private async openCheckout(job: {
          adapter: IPaymentGatewayAdapter; purpose: GatewayPurpose; tenantId: number; email: string; actor: GatewayActor;
          openKey: string; periodStart: string | null; subjectId: number | null; amountMinor: number; currency: string;
          description: string; alreadyPaidMessage: string;
     }) {
          const { adapter } = job;
          if (!adapter.isConfigured() || !this.settings.publicBaseUrl.startsWith('https://') && !this.settings.publicBaseUrl.startsWith('http://')) {
               throw new GatewayError('This payment provider is not configured', 503);
          }
          if (!EMAIL.test(job.email)) throw new GatewayError('A valid payer email is required');
          const openKey = job.openKey;

          const existing = await this.repo.findOpenByKey(openKey);
          if (existing) {
               const stale = new Date(existing.expires_at).getTime() <= this.now().getTime();
               if (stale) await this.verifyAndApply(existing.reference, 'reconcile').catch(() => undefined);
               const current = (await this.repo.findByReference(existing.reference))!;
               if (OPEN_STATUSES.includes(current.status)) {
                    if (current.provider === adapter.provider && current.checkout_url && current.amount_minor === job.amountMinor) {
                         return { transaction: this.publicView(current), reused: true };
                    }
                    throw new GatewayError('A payment for this item is already in progress; wait for it to finish or expire', 409);
               }
               if (current.status === 'succeeded') throw new GatewayError(job.alreadyPaidMessage, 409);
          }

          const reference = adapter.generateReference();
          const expiresAt = new Date(this.now().getTime() + this.settings.transactionTtlMinutes * 60_000);
          const row = await this.repo.insert({
               reference, provider: adapter.provider, provider_reference: null, purpose: job.purpose,
               tenant_id: job.tenantId, period_start: job.periodStart, subject_id: job.subjectId, open_key: openKey,
               amount_minor: job.amountMinor, currency: job.currency, status: 'initiated', checkout_url: null,
               initiated_by_tenant_id: job.actor.tenantId, initiated_by_employee_id: job.actor.employeeId, expires_at: expiresAt,
          });
          await this.repo.appendEvent({ transaction_id: row.id, source: 'initiate', event_type: 'created', to_status: 'initiated' });
          try {
               const { callbackUrl, returnUrl } = this.urls(adapter.provider, reference, job.purpose === 'patient_bill' ? job.tenantId : undefined);
               const result = await adapter.initiate({
                    reference, amountMinor: job.amountMinor, currency: job.currency, email: job.email,
                    description: job.description, callbackUrl, returnUrl,
               });
               await this.repo.transition(reference, ['initiated'], 'pending', { checkout_url: result.checkoutUrl, provider_reference: result.providerReference });
               await this.repo.appendEvent({ transaction_id: row.id, source: 'initiate', event_type: 'checkout_created', from_status: 'initiated', to_status: 'pending' });
          } catch (error) {
               const transient = error instanceof GatewayError && error.transient;
               if (!transient) {
                    await this.repo.transition(reference, ['initiated'], 'failed', { review_reason: 'initiation rejected' });
                    await this.repo.appendEvent({ transaction_id: row.id, source: 'initiate', event_type: 'initiation_failed', from_status: 'initiated', to_status: 'failed' });
               } else {
                    // The provider may have created the checkout before the timeout; reconciliation resolves it.
                    await this.repo.appendEvent({ transaction_id: row.id, source: 'initiate', event_type: 'initiation_uncertain', detail: (error as Error).message });
               }
               throw error;
          }
          return { transaction: this.publicView((await this.repo.findByReference(reference))!), reused: false };
     }

     publicView(tx: GatewayTransaction) {
          return {
               reference: tx.reference, provider: tx.provider, tenantId: tx.tenant_id, periodStart: tx.period_start,
               purpose: tx.purpose, billingId: tx.purpose === 'patient_bill' ? tx.subject_id : null,
               amountMinor: tx.amount_minor, currency: tx.currency, status: tx.status, needsReview: tx.needs_review,
               reviewReason: tx.review_reason, checkoutUrl: OPEN_STATUSES.includes(tx.status) ? tx.checkout_url : null,
               fulfilled: !!tx.fulfilled_at, expiresAt: tx.expires_at, createdAt: tx.created_at,
          };
     }

     private async flagReview(tx: GatewayTransaction, reason: string, source: 'verify' | 'webhook' | 'return' | 'reconcile' | 'fulfil' | 'admin') {
          await this.repo.patch(tx.reference, { needs_review: true, review_reason: reason.slice(0, 255) });
          await this.repo.appendEvent({ transaction_id: tx.id, source, event_type: 'needs_review', detail: reason });
     }

     private async move(tx: GatewayTransaction, to: GatewayStatus, source: 'verify' | 'webhook' | 'return' | 'reconcile', patch: Partial<GatewayTransaction> = {}) {
          if (!canTransition(tx.status, to)) return false;
          const done = await this.repo.transition(tx.reference, [tx.status], to, { ...patch, last_verified_at: this.now() as any });
          if (done) await this.repo.appendEvent({ transaction_id: tx.id, source, event_type: 'status_changed', from_status: tx.status, to_status: to });
          return done;
     }

     /** Verifies with the provider and applies the result. `verified` is false when the provider could not be reached. */
     async verifyAndApply(reference: string, source: 'verify' | 'webhook' | 'return' | 'reconcile' = 'verify'): Promise<VerifyOutcome> {
          let tx = await this.repo.findByReference(reference);
          if (!tx) throw new GatewayError('Transaction not found', 404);
          if (tx.status === 'succeeded') {
               if (!tx.fulfilled_at && !tx.needs_review) await this.fulfil(tx);
               return { transaction: (await this.repo.findByReference(reference))!, verified: true };
          }
          if (['failed', 'cancelled', 'refunded', 'refund_pending'].includes(tx.status)) return { transaction: tx, verified: true };

          let result;
          try {
               const adapter = await this.adapterFor(tx);
               result = await adapter.verify({ reference: tx.reference, providerReference: tx.provider_reference });
          } catch (error) {
               const transient = error instanceof GatewayError ? error.transient : true;
               await this.repo.patch(tx.reference, { verify_attempts: tx.verify_attempts + 1 });
               await this.repo.appendEvent({ transaction_id: tx.id, source, event_type: 'verify_unavailable', detail: (error as Error).message });
               if (!transient) await this.flagReview(tx, 'provider verification rejected', source);
               return { transaction: tx, verified: false };
          }

          switch (result.status) {
               case 'succeeded': {
                    if (result.amountMinor === null) {
                         await this.flagReview(tx, 'provider did not state the paid amount; cannot confirm', source);
                         break;
                    }
                    if (result.amountMinor !== tx.amount_minor) {
                         await this.flagReview(tx, `amount mismatch: expected ${tx.amount_minor}, provider ${result.amountMinor}`, source);
                         break;
                    }
                    if (result.currency !== null && result.currency !== tx.currency) {
                         await this.flagReview(tx, `currency mismatch: expected ${tx.currency}, provider ${result.currency}`, source);
                         break;
                    }
                    const moved = await this.move(tx, 'succeeded', source);
                    tx = (await this.repo.findByReference(reference))!;
                    if (moved || (tx.status as GatewayStatus) === 'succeeded') await this.fulfil(tx);
                    break;
               }
               case 'failed':
               case 'cancelled':
                    await this.move(tx, result.status, source);
                    break;
               case 'refunded':
                    await this.flagReview(tx, 'provider reports a refund/reversal on an unsettled payment', source);
                    break;
               case 'not_found':
                    if (tx.status === 'initiated' && this.now().getTime() - new Date(tx.created_at).getTime() > NOT_FOUND_GRACE_MS) {
                         await this.move(tx, 'failed', source);
                    }
                    break;
               default:
                    if (OPEN_STATUSES.includes(tx.status) && new Date(tx.expires_at).getTime() <= this.now().getTime()) {
                         await this.move(tx, 'expired', source);
                    } else {
                         await this.repo.patch(tx.reference, { last_verified_at: this.now() as any });
                    }
          }
          return { transaction: (await this.repo.findByReference(reference))!, verified: true };
     }

     private async fulfil(tx: GatewayTransaction) {
          if (tx.fulfilled_at) return;
          try {
               const outcome = tx.purpose === 'patient_bill'
                    ? await this.tenantGateways().bills.fulfil(tx)
                    : await this.fulfilment.fulfil(tx);
               if (outcome.ok) {
                    if (await this.repo.markFulfilled(tx.reference, outcome.reference ?? tx.reference)) {
                         await this.repo.appendEvent({ transaction_id: tx.id, source: 'fulfil', event_type: 'fulfilled', detail: outcome.reference });
                    }
               } else {
                    await this.flagReview(tx, outcome.reason ?? 'fulfilment refused', 'fulfil');
               }
          } catch (error) {
               // Paid at the provider but PLS failed to apply it: stays succeeded+unfulfilled, retried by reconciliation.
               await this.repo.appendEvent({ transaction_id: tx.id, source: 'fulfil', event_type: 'fulfilment_error', detail: (error as Error).message });
          }
     }

     /** `tenantId` is present only on tenant merchant webhooks, where the signature must be checked with that tenant's secret. */
     async handleWebhook(provider: string, rawBody: Buffer, headers: Record<string, string | string[] | undefined>, token: unknown, tenantId?: number) {
          const adapter = tenantId ? (await this.tenantGateway(tenantId, provider)).adapter : this.adapter(provider);
          const parsed = adapter.authenticateWebhook(rawBody, headers);
          if (!adapter.signedWebhooks && !callbackTokenMatches(this.settings.webhookSecret, parsed.reference, token)) {
               throw new GatewayError('Invalid callback token', 401);
          }
          const tx = await this.repo.findByReference(parsed.reference);
          const scopeMatches = tx && (tenantId ? tx.purpose === 'patient_bill' && tx.tenant_id === tenantId : tx.purpose !== 'patient_bill');
          if (!tx || !scopeMatches || tx.provider !== adapter.provider) return { handled: false as const, reason: 'unknown_reference' };
          const outcome = await this.verifyAndApply(tx.reference, 'webhook');
          if (!outcome.verified) throw new GatewayError('Verification pending; retry later', 503, true);
          const hash = createHash('sha256').update(rawBody).digest('hex');
          const first = await this.repo.recordWebhookEvent(tx.id, parsed.eventType, hash);
          return { handled: true as const, duplicate: !first, status: outcome.transaction.status };
     }

     async handleReturn(provider: string, reference: string) {
          if (!GATEWAY_PROVIDER_LIST.includes(provider)) throw new GatewayError('Unknown payment provider', 404);
          const tx = reference ? await this.repo.findByReference(reference) : null;
          if (!tx || tx.provider !== provider) return null;
          const outcome = await this.verifyAndApply(tx.reference, 'return').catch(() => ({ transaction: tx, verified: false }));
          return outcome.transaction;
     }

     async reconcile(limit = 50, minAgeMs = 60_000) {
          const rows = await this.repo.listReconcilable(new Date(this.now().getTime() - minAgeMs), limit);
          const summary = { checked: 0, unavailable: 0, errors: 0 };
          for (const tx of rows) {
               try {
                    const outcome = await this.verifyAndApply(tx.reference, 'reconcile');
                    summary.checked += 1;
                    if (!outcome.verified) summary.unavailable += 1;
               } catch { summary.errors += 1; }
          }
          return summary;
     }

     async list(filter: ListFilter) {
          const { rows, total } = await this.repo.list(filter);
          return { items: rows.map(row => this.publicView(row)), total };
     }

     /** A scope hides transactions that belong to another tenant or purpose behind the same 404 as a missing one. */
     async get(reference: string, scope: { tenantId?: number; purpose?: GatewayPurpose } = {}) {
          const tx = await this.repo.findByReference(reference);
          if (!tx || (scope.tenantId && tx.tenant_id !== scope.tenantId) || (scope.purpose && tx.purpose !== scope.purpose)) {
               throw new GatewayError('Transaction not found', 404);
          }
          return { transaction: this.publicView(tx), providerReference: tx.provider_reference, verifyAttempts: tx.verify_attempts, events: await this.repo.events(tx.id) };
     }

     async verifyScoped(reference: string, scope: { tenantId?: number; purpose?: GatewayPurpose }) {
          await this.get(reference, scope);
          return this.verifyAndApply(reference, 'verify');
     }
}
