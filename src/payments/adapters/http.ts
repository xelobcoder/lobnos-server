import { GatewayError } from '../types';

export interface HttpOptions {
     method: 'GET' | 'POST';
     headers: Record<string, string>;
     body?: unknown;
     timeoutMs: number;
}

export interface HttpResult { status: number; json: any; }

/**
 * JSON request with a hard timeout. Network failures, timeouts, 429 and 5xx are transient (caller keeps the
 * transaction open for retry). Error messages never include request headers, bodies or credentials.
 */
export async function requestJson(url: string, options: HttpOptions, fetchImpl: typeof fetch = fetch): Promise<HttpResult> {
     const controller = new AbortController();
     const timer = setTimeout(() => controller.abort(), options.timeoutMs);
     let response: Response;
     try {
          response = await fetchImpl(url, {
               method: options.method,
               headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
               body: options.body === undefined ? undefined : JSON.stringify(options.body),
               signal: controller.signal,
          });
     } catch (error: any) {
          throw new GatewayError(error?.name === 'AbortError' ? 'Payment provider timed out' : 'Payment provider unreachable', 503, true);
     } finally {
          clearTimeout(timer);
     }
     let json: any = null;
     try { json = await response.json(); } catch { json = null; }
     if (response.status === 429 || response.status >= 500) throw new GatewayError(`Payment provider unavailable (HTTP ${response.status})`, 503, true);
     return { status: response.status, json };
}

export const basicAuth = (user: string, secret: string) => `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`;

/** Decimal major units from a provider -> integer minor units without float drift. */
export function majorToMinor(value: unknown): number | null {
     if (typeof value !== 'number' && typeof value !== 'string') return null;
     const text = String(value).trim();
     if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
     const [whole, fraction = ''] = text.split('.');
     return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export const minorToMajor = (minor: number) => `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
