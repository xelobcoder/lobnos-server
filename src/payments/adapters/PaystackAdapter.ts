import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PaymentGatewayConfig } from '../PaymentGatewayConfig';
import {
     GatewayError, IPaymentGatewayAdapter, InitiateRequest, InitiateResult, ParsedWebhook, VerifyResult, VerifiedState,
} from '../types';
import { requestJson } from './http';

type Headers = Record<string, string | string[] | undefined>;

const header = (headers: Headers, name: string) => {
     const value = headers[name.toLowerCase()];
     return Array.isArray(value) ? value[0] : value;
};

/**
 * Paystack: Bearer secret key; amounts in the currency's minor unit; webhooks signed with HMAC-SHA512 of the raw
 * body (x-paystack-signature). Status values and endpoints follow Paystack's public API; confirm in the Paystack
 * sandbox before enabling in production.
 */
export class PaystackAdapter implements IPaymentGatewayAdapter {
     readonly provider = 'paystack' as const;
     readonly signedWebhooks = true;

     constructor(private config: PaymentGatewayConfig, private fetchImpl: typeof fetch = fetch) { }

     isConfigured() { return this.config.paystack.secretKey.length > 0; }

     generateReference() { return `PLS${randomBytes(12).toString('hex')}`; }

     private auth() { return { Authorization: `Bearer ${this.config.paystack.secretKey}` }; }

     async initiate(request: InitiateRequest): Promise<InitiateResult> {
          const { status, json } = await requestJson(`${this.config.paystack.baseUrl}/transaction/initialize`, {
               method: 'POST', headers: this.auth(), timeoutMs: this.config.requestTimeoutMs,
               body: {
                    email: request.email, amount: request.amountMinor, currency: request.currency,
                    reference: request.reference, callback_url: request.returnUrl,
                    metadata: { purpose: 'pls_subscription' },
               },
          }, this.fetchImpl);
          const url = json?.data?.authorization_url;
          if (status >= 400 || json?.status !== true || typeof url !== 'string') {
               throw new GatewayError('Paystack rejected the payment initiation', 502);
          }
          return { providerReference: typeof json.data.access_code === 'string' ? json.data.access_code : null, checkoutUrl: url };
     }

     async verify(transaction: { reference: string }): Promise<VerifyResult> {
          const { status, json } = await requestJson(
               `${this.config.paystack.baseUrl}/transaction/verify/${encodeURIComponent(transaction.reference)}`,
               { method: 'GET', headers: this.auth(), timeoutMs: this.config.requestTimeoutMs }, this.fetchImpl);
          if (status === 404) return { status: 'not_found', amountMinor: null, currency: null, providerReference: null };
          if (status >= 400 || json?.status !== true || !json.data) throw new GatewayError('Paystack verification failed', 502, true);
          const data = json.data;
          if (typeof data.reference === 'string' && data.reference !== transaction.reference) {
               throw new GatewayError('Paystack returned a different transaction reference', 502);
          }
          const map: Record<string, VerifiedState> = {
               success: 'succeeded', failed: 'failed', cancelled: 'cancelled', reversed: 'refunded',
               abandoned: 'pending', ongoing: 'pending', pending: 'pending', processing: 'pending', queued: 'pending',
          };
          return {
               status: map[String(data.status)] ?? 'pending',
               amountMinor: Number.isSafeInteger(data.amount) ? data.amount : null,
               currency: typeof data.currency === 'string' ? data.currency.toUpperCase() : null,
               providerReference: null,
          };
     }

     authenticateWebhook(rawBody: Buffer, headers: Headers): ParsedWebhook {
          const supplied = header(headers, 'x-paystack-signature');
          if (!this.isConfigured() || !supplied) throw new GatewayError('Invalid signature', 401);
          const expected = createHmac('sha512', this.config.paystack.secretKey).update(rawBody).digest('hex');
          const a = Buffer.from(expected);
          const b = Buffer.from(supplied.toLowerCase());
          if (a.length !== b.length || !timingSafeEqual(a, b)) throw new GatewayError('Invalid signature', 401);
          let body: any;
          try { body = JSON.parse(rawBody.toString('utf8')); } catch { throw new GatewayError('Malformed webhook body', 400); }
          const reference = body?.data?.reference ?? body?.data?.transaction_reference;
          if (typeof reference !== 'string' || !reference) throw new GatewayError('Webhook has no reference', 400);
          return { reference, eventType: String(body.event ?? 'unknown').slice(0, 60), eventId: body?.data?.id != null ? String(body.data.id) : null };
     }
}
