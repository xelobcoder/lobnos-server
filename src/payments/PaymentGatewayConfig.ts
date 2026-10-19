import { createHmac, timingSafeEqual } from 'crypto';

type Env = Record<string, string | undefined>;

export interface PaymentGatewayConfig {
     /** Public HTTPS origin of this server, used to build provider callback and return URLs. */
     publicBaseUrl: string;
     /** Optional frontend page the payer is sent back to after checkout. */
     returnUrl: string;
     /** Server secret used to derive callback tokens for providers that do not sign webhooks. */
     webhookSecret: string;
     paystack: { secretKey: string; baseUrl: string };
     hubtel: { clientId: string; clientSecret: string; merchantAccount: string; checkoutBaseUrl: string; statusBaseUrl: string };
     payswitch: { apiUser: string; apiKey: string; merchantId: string; baseUrl: string };
     requestTimeoutMs: number;
     transactionTtlMinutes: number;
}

const clean = (value: string | undefined) => (value ?? '').trim();
const trimSlash = (value: string) => value.replace(/\/+$/, '');

export function loadPaymentGatewayConfig(env: Env = process.env): PaymentGatewayConfig {
     const number = (value: string | undefined, fallback: number, min: number, max: number) => {
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
     };
     return {
          publicBaseUrl: trimSlash(clean(env.PAYMENT_PUBLIC_BASE_URL)),
          returnUrl: clean(env.PAYMENT_RETURN_URL),
          webhookSecret: clean(env.PAYMENT_WEBHOOK_SECRET),
          paystack: {
               secretKey: clean(env.PAYSTACK_SECRET_KEY),
               baseUrl: trimSlash(clean(env.PAYSTACK_BASE_URL) || 'https://api.paystack.co'),
          },
          hubtel: {
               clientId: clean(env.HUBTEL_CLIENT_ID),
               clientSecret: clean(env.HUBTEL_CLIENT_SECRET),
               merchantAccount: clean(env.HUBTEL_MERCHANT_ACCOUNT),
               checkoutBaseUrl: trimSlash(clean(env.HUBTEL_CHECKOUT_BASE_URL) || 'https://payproxyapi.hubtel.com'),
               statusBaseUrl: trimSlash(clean(env.HUBTEL_STATUS_BASE_URL) || 'https://api-txnstatus.hubtel.com'),
          },
          payswitch: {
               apiUser: clean(env.PAYSWITCH_API_USER),
               apiKey: clean(env.PAYSWITCH_API_KEY),
               merchantId: clean(env.PAYSWITCH_MERCHANT_ID),
               baseUrl: trimSlash(clean(env.PAYSWITCH_BASE_URL) || 'https://prod.theteller.net'),
          },
          requestTimeoutMs: number(env.PAYMENT_REQUEST_TIMEOUT_MS, 15_000, 1_000, 60_000),
          transactionTtlMinutes: number(env.PAYMENT_TRANSACTION_TTL_MINUTES, 60, 5, 24 * 60),
     };
}

/** Callback token for providers without webhook signatures: HMAC of the PLS reference under a server secret. */
export function callbackToken(secret: string, reference: string): string {
     return createHmac('sha256', secret).update(`callback:${reference}`).digest('hex').slice(0, 32);
}

export function callbackTokenMatches(secret: string, reference: string, supplied: unknown): boolean {
     if (!secret || typeof supplied !== 'string') return false;
     const expected = Buffer.from(callbackToken(secret, reference));
     const actual = Buffer.from(supplied);
     return actual.length === expected.length && timingSafeEqual(actual, expected);
}
