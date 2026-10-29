import {describe,it,expect} from 'vitest';
import {createHmac} from 'crypto';
import {canonicalMessagingPayload,verifyArkeselWebhook} from './ArkeselWebhook';
const secret='test-signing-key',now=1783425600000,timestamp=String(now/1000);
function headers(query:any){return {'x-arkesel-webhook-timestamp':timestamp,'x-arkesel-webhook-signature':'v1='+createHmac('sha256',secret).update(timestamp+'.'+canonicalMessagingPayload(query)).digest('hex')};}
describe('Arkesel SMS HMAC contract',()=>{
 it('matches PHP escaping, sorted nested objects and preserved arrays',()=>{expect(canonicalMessagingPayload({z:'é😀/',a:{z:'last',a:['b','a']}})).toBe('{"a":{"a":["b","a"],"z":"last"},"z":"\\u00e9\\ud83d\\ude00/"}');});
 it('accepts an official-compatible signed query and a second matching rotation signature',()=>{const q={sms_id:'abc123',status:'DELIVERED'},h=headers(q);expect(verifyArkeselWebhook(q,h,secret,now)).toBe(true);h['x-arkesel-webhook-signature']='v1='+'0'.repeat(64)+','+h['x-arkesel-webhook-signature'];expect(verifyArkeselWebhook(q,h,secret,now)).toBe(true);});
 it('verifies every query field and does not normalize strings before hashing',()=>{const q={sms_id:'abc123',status:'DELIVERED',extra:'é'},h=headers(q);expect(verifyArkeselWebhook({...q,extra:'changed'},h,secret,now)).toBe(false);expect(verifyArkeselWebhook({...q,status:'delivered'},h,secret,now)).toBe(false);});
 it.each([-301000,301000])('rejects stale or future signed requests (%s)',offset=>{const q={sms_id:'a',status:'DELIVERED'};expect(verifyArkeselWebhook(q,headers(q),secret,now+offset)).toBe(false);});
 it.each(['','v1=garbage','v1=aa','v2='+'a'.repeat(64)])('rejects malformed signatures %s',signature=>{expect(verifyArkeselWebhook({}, {...headers({}),'x-arkesel-webhook-signature':signature},secret,now)).toBe(false);});
 it('does not lose prototype-named keys during canonicalization',()=>{const q=JSON.parse('{"__proto__":{"x":"y"},"sms_id":"a"}');expect(canonicalMessagingPayload(q)).toContain('"__proto__"');});
});
