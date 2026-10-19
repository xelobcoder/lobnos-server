import { randomInt } from 'crypto';
import { PaymentGatewayConfig } from '../PaymentGatewayConfig';
import {
     GatewayError, IPaymentGatewayAdapter, InitiateRequest, InitiateResult, ParsedWebhook, VerifyResult, VerifiedState,
} from '../types';
import { basicAuth, requestJson } from './http';

/**
 * PaySwitch (theTeller) hosted checkout. PaySwitch reports the outcome by redirecting the payer's browser, which
 * is never authoritative, so there is no webhook: the return route triggers the Transaction Status Check, and the
 * reconciliation worker covers payers who never return. Transaction ids must be 12 digits and amounts are
 * 12-digit zero-padded minor units. Mapped from PaySwitch's public documentation, which could not be fetched
 * during development: validate in the sandbox. If the status response omits the amount, the transaction can
 * never auto-complete and is flagged for review instead (amount confirmation is mandatory).
 */
export class PaySwitchAdapter implements IPaymentGatewayAdapter {
     readonly provider = 'payswitch' as const;
     readonly signedWebhooks = false;

     constructor(private config: PaymentGatewayConfig, private fetchImpl: typeof fetch = fetch) { }

     isConfigured() {
          const p = this.config.payswitch;
          return !!(p.apiUser && p.apiKey && p.merchantId);
     }

     generateReference() { return String(randomInt(0, 1_000_000_000_000)).padStart(12, '0'); }

     private auth() {
          return { Authorization: basicAuth(this.config.payswitch.apiUser, this.config.payswitch.apiKey), 'Merchant-Id': this.config.payswitch.merchantId };
     }

     async initiate(request: InitiateRequest): Promise<InitiateResult> {
          const { status, json } = await requestJson(`${this.config.payswitch.baseUrl}/checkout/initiate`, {
               method: 'POST', headers: this.auth(), timeoutMs: this.config.requestTimeoutMs,
               body: {
                    merchant_id: this.config.payswitch.merchantId, transaction_id: request.reference,
                    desc: request.description, amount: String(request.amountMinor).padStart(12, '0'),
                    email: request.email, redirect_url: request.returnUrl,
               },
          }, this.fetchImpl);
          if (status >= 400 || String(json?.status).toLowerCase() !== 'success' || typeof json?.checkout_url !== 'string') {
               throw new GatewayError('PaySwitch rejected the payment initiation', 502);
          }
          return { providerReference: typeof json.token === 'string' ? json.token : null, checkoutUrl: json.checkout_url };
     }

     async verify(transaction: { reference: string }): Promise<VerifyResult> {
          const { status, json } = await requestJson(
               `${this.config.payswitch.baseUrl}/v1.1/users/transactions/${encodeURIComponent(transaction.reference)}/status`,
               { method: 'GET', headers: this.auth(), timeoutMs: this.config.requestTimeoutMs }, this.fetchImpl);
          if (status === 404) return { status: 'not_found', amountMinor: null, currency: null, providerReference: null };
          if (status >= 400 || !json) throw new GatewayError('PaySwitch status check failed', 502, true);
          if (typeof json.transaction_id === 'string' && json.transaction_id !== transaction.reference) {
               throw new GatewayError('PaySwitch returned a different transaction id', 502);
          }
          const text = String(json.status ?? '').toLowerCase();
          const code = String(json.code ?? '');
          const map: Record<string, VerifiedState> = {
               approved: 'succeeded', success: 'succeeded', declined: 'failed', failed: 'failed', cancelled: 'cancelled',
               pending: 'pending', 'pending approval': 'pending',
          };
          const state: VerifiedState = code === '000' && !map[text] ? 'succeeded' : (map[text] ?? 'pending');
          const raw = json.amount;
          // Only the documented 12-digit minor-unit form is trusted; anything else leaves the amount unverifiable.
          const amountMinor = typeof raw === 'string' && /^\d{12}$/.test(raw) ? Number(raw) : null;
          return {
               status: state, amountMinor,
               currency: typeof json.currency === 'string' ? json.currency.toUpperCase() : null,
               providerReference: null,
          };
     }

     authenticateWebhook(): ParsedWebhook {
          throw new GatewayError('PaySwitch does not send webhooks', 404);
     }
}
