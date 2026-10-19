import { randomBytes } from 'crypto';
import { PaymentGatewayConfig } from '../PaymentGatewayConfig';
import {
     GatewayError, IPaymentGatewayAdapter, InitiateRequest, InitiateResult, ParsedWebhook, VerifyResult, VerifiedState,
} from '../types';
import { basicAuth, majorToMinor, minorToMajor, requestJson } from './http';

/**
 * Hubtel Online Checkout. Hubtel callbacks are not signed, so PLS (a) puts a PLS-issued token in the callback URL
 * and (b) never treats a callback as proof: the Transaction Status Check API is always called before success.
 * Endpoint paths and field names are mapped from Hubtel's public checkout documentation, which could not be
 * fetched during development: validate every mapping, and the required server IP allow-listing for the status
 * API, in Hubtel's sandbox before production use. Hubtel limits clientReference length, so references are short.
 */
export class HubtelAdapter implements IPaymentGatewayAdapter {
     readonly provider = 'hubtel' as const;
     readonly signedWebhooks = false;

     constructor(private config: PaymentGatewayConfig, private fetchImpl: typeof fetch = fetch) { }

     isConfigured() {
          const h = this.config.hubtel;
          return !!(h.clientId && h.clientSecret && h.merchantAccount && this.config.webhookSecret);
     }

     generateReference() { return `PLS${randomBytes(12).toString('hex')}`; }

     private auth() { return { Authorization: basicAuth(this.config.hubtel.clientId, this.config.hubtel.clientSecret) }; }

     async initiate(request: InitiateRequest): Promise<InitiateResult> {
          const { status, json } = await requestJson(`${this.config.hubtel.checkoutBaseUrl}/items/initiate`, {
               method: 'POST', headers: this.auth(), timeoutMs: this.config.requestTimeoutMs,
               body: {
                    totalAmount: Number(minorToMajor(request.amountMinor)), description: request.description,
                    callbackUrl: request.callbackUrl, returnUrl: request.returnUrl, cancellationUrl: request.returnUrl,
                    merchantAccountNumber: this.config.hubtel.merchantAccount, clientReference: request.reference,
               },
          }, this.fetchImpl);
          const data = json?.data;
          if (status >= 400 || json?.responseCode !== '0000' || typeof data?.checkoutUrl !== 'string') {
               throw new GatewayError('Hubtel rejected the payment initiation', 502);
          }
          return { providerReference: typeof data.checkoutId === 'string' ? data.checkoutId : null, checkoutUrl: data.checkoutUrl };
     }

     async verify(transaction: { reference: string }): Promise<VerifyResult> {
          const url = `${this.config.hubtel.statusBaseUrl}/transactions/${encodeURIComponent(this.config.hubtel.merchantAccount)}/status`
               + `?clientReference=${encodeURIComponent(transaction.reference)}`;
          const { status, json } = await requestJson(url, { method: 'GET', headers: this.auth(), timeoutMs: this.config.requestTimeoutMs }, this.fetchImpl);
          if (status === 404) return { status: 'not_found', amountMinor: null, currency: null, providerReference: null };
          if (status >= 400 || !json?.data) throw new GatewayError('Hubtel status check failed', 502, true);
          const data = json.data;
          if (typeof data.clientReference === 'string' && data.clientReference !== transaction.reference) {
               throw new GatewayError('Hubtel returned a different client reference', 502);
          }
          const map: Record<string, VerifiedState> = { paid: 'succeeded', unpaid: 'pending', refunded: 'refunded' };
          return {
               status: map[String(data.status).toLowerCase()] ?? 'pending',
               amountMinor: majorToMinor(data.amount),
               currency: typeof data.currencyCode === 'string' ? data.currencyCode.toUpperCase() : null,
               providerReference: null,
          };
     }

     authenticateWebhook(rawBody: Buffer): ParsedWebhook {
          let body: any;
          try { body = JSON.parse(rawBody.toString('utf8')); } catch { throw new GatewayError('Malformed webhook body', 400); }
          const data = body?.Data ?? body?.data;
          const reference = data?.ClientReference ?? data?.clientReference;
          if (typeof reference !== 'string' || !reference) throw new GatewayError('Webhook has no reference', 400);
          return { reference, eventType: 'checkout_callback', eventId: null };
     }
}
