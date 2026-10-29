import { createHash, createHmac, timingSafeEqual } from 'crypto';
export function canonicalMessagingPayload(value: unknown): string {
 function sorted(input: any): any {
  if (Array.isArray(input)) return input.map(sorted);
  if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map(k=>[k,sorted(input[k])]));
  if (typeof input !== 'string' && input !== null && typeof input !== 'boolean' && typeof input !== 'number') throw new Error('Invalid callback payload');
  return input;
 }
 return JSON.stringify(sorted(value)).replace(/[^\x00-\x7f]/g, c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
}
export function verifyArkeselWebhook(query: unknown, headers: Record<string, unknown>, secret: string, now = Date.now()) {
 const timestamp = headers['x-arkesel-webhook-timestamp'], signatures = headers['x-arkesel-webhook-signature'];
 if (!secret || typeof timestamp !== 'string' || !/^\d{1,12}$/.test(timestamp) || typeof signatures !== 'string' || signatures.length > 512) return false;
 if (!Number.isSafeInteger(Number(timestamp)) || Math.abs(now/1000-Number(timestamp)) > 300) return false;
 try {
  const expected = createHmac('sha256',secret).update(timestamp+'.'+canonicalMessagingPayload(query)).digest();
  return signatures.split(',').some(part=>{const match=part.trim().match(/^v1=([a-fA-F0-9]{64})$/);return !!match && timingSafeEqual(expected as any,Buffer.from(match[1],'hex') as any);});
 } catch { return false; }
}
export function callbackPayloadHash(query: unknown) { return createHash('sha256').update(canonicalMessagingPayload(query)).digest('hex'); }
