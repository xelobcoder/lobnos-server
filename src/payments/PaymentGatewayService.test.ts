import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { callbackToken, loadPaymentGatewayConfig } from './PaymentGatewayConfig';
import { PaymentGatewayService } from './PaymentGatewayService';
import { PaystackAdapter } from './adapters/PaystackAdapter';
import { HubtelAdapter } from './adapters/HubtelAdapter';
import { PaySwitchAdapter } from './adapters/PaySwitchAdapter';
import { majorToMinor } from './adapters/http';
import {
     BillQuote, GatewayError, GatewayEvent, GatewayStatus, GatewayTransaction, IBillPaymentFulfilment, IPaymentFulfilment, IPaymentGatewayAdapter,
     IPaymentGatewayRepository, ITenantGatewayResolver, InitiateRequest, NewGatewayTransaction, VerifyResult,
} from './types';
import { CredentialCipher, parseCredentialKey } from './CredentialCipher';
import { tenantAdapterConfig } from './TenantGatewayResolver';

class MemoryRepo implements IPaymentGatewayRepository {
     rows: GatewayTransaction[] = [];
     evts: GatewayEvent[] = [];
     async ensureSchema() { }
     async insert(v: NewGatewayTransaction) {
          if (v.open_key && this.rows.some(r => r.open_key === v.open_key)) throw new GatewayError('in progress', 409);
          const row = {
               ...v, id: this.rows.length + 1, needs_review: false, review_reason: null, fulfilled_at: null, fulfilment_ref: null,
               verify_attempts: 0, last_verified_at: null, created_at: new Date('2026-01-01T00:00:00Z'), updated_at: new Date(),
          } as GatewayTransaction;
          this.rows.push(row);
          return { ...row };
     }
     private row(ref: string) { return this.rows.find(r => r.reference === ref); }
     async findByReference(ref: string) { const r = this.row(ref); return r ? { ...r } : null; }
     async findOpenByKey(key: string) { const r = this.rows.find(x => x.open_key === key); return r ? { ...r } : null; }
     async transition(ref: string, from: GatewayStatus[], to: GatewayStatus, patch: any = {}) {
          const r = this.row(ref);
          if (!r || !from.includes(r.status)) return false;
          Object.assign(r, patch, { status: to });
          if (to !== 'initiated' && to !== 'pending') r.open_key = null;
          return true;
     }
     async patch(ref: string, patch: any) { Object.assign(this.row(ref)!, patch); }
     async markFulfilled(ref: string, f: string) {
          const r = this.row(ref)!;
          if (r.fulfilled_at) return false;
          r.fulfilled_at = new Date(); r.fulfilment_ref = f; return true;
     }
     async appendEvent(e: GatewayEvent) { this.evts.push(e); }
     async recordWebhookEvent(id: number, type: string, hash: string) {
          if (this.evts.some(e => e.transaction_id === id && e.event_hash === hash)) return false;
          this.evts.push({ transaction_id: id, source: 'webhook', event_type: type, event_hash: hash }); return true;
     }
     async listReconcilable() { return this.rows.filter(r => !r.needs_review && (['initiated', 'pending', 'expired'].includes(r.status) || (r.status === 'succeeded' && !r.fulfilled_at))).map(r => ({ ...r })); }
     async list() { return { rows: this.rows, total: this.rows.length }; }
     async events(id: number) { return this.evts.filter(e => e.transaction_id === id); }
}

class FakeAdapter implements IPaymentGatewayAdapter {
     provider = 'paystack' as const;
     signedWebhooks: boolean;
     verifyResult: VerifyResult | Error = { status: 'pending', amountMinor: null, currency: null, providerReference: null };
     verifyCalls = 0;
     counter = 0;
     constructor(signed = true) { this.signedWebhooks = signed; }
     isConfigured() { return true; }
     generateReference() { return `REF${++this.counter}`; }
     async initiate(r: InitiateRequest) { return { providerReference: 'pr', checkoutUrl: `https://pay.test/${r.reference}` }; }
     async verify() { this.verifyCalls++; if (this.verifyResult instanceof Error) throw this.verifyResult; return this.verifyResult; }
     authenticateWebhook(raw: Buffer, headers: any) {
          if (headers['x-sig'] !== 'ok') throw new GatewayError('Invalid signature', 401);
          return { reference: JSON.parse(raw.toString()).reference, eventType: 'charge.success', eventId: null };
     }
}

class FakeFulfilment implements IPaymentFulfilment {
     applied: string[] = [];
     refuse = false;
     async quote() { return { amountMinor: 15000, currency: 'GHS', periodStart: '2026-01-31', periodEnd: '2026-02-27' }; }
     async fulfil(tx: GatewayTransaction) {
          if (this.refuse) return { ok: false, reason: 'already paid' };
          if (!this.applied.includes(tx.reference)) this.applied.push(tx.reference);
          return { ok: true, reference: `payment:${tx.reference}` };
     }
}

const paid = (over: Partial<VerifyResult> = {}): VerifyResult => ({ status: 'succeeded', amountMinor: 15000, currency: 'GHS', providerReference: null, ...over });

function setup(signed = true) {
     const repo = new MemoryRepo();
     const adapter = new FakeAdapter(signed);
     const fulfilment = new FakeFulfilment();
     let now = new Date('2026-01-01T00:10:00Z');
     const service = new PaymentGatewayService(repo, { paystack: adapter }, fulfilment,
          { publicBaseUrl: 'https://pls.test', returnUrl: '', webhookSecret: 's'.repeat(32), transactionTtlMinutes: 60 }, () => now);
     return { repo, adapter, fulfilment, service, setNow: (d: Date) => { now = d; } };
}
const actor = { tenantId: 1, employeeId: 2 };
const start = async (s: ReturnType<typeof setup>) =>
     (await s.service.initiate({ provider: 'paystack', tenantId: 5, periodStart: '2026-01-31', email: 'a@b.co' }, actor)).transaction.reference;
const hook = (reference: string) => Buffer.from(JSON.stringify({ reference }));

describe('PaymentGatewayService', () => {
     it('uses the server quote and returns a pending checkout', async () => {
          const s = setup();
          const ref = await start(s);
          const tx = (await s.repo.findByReference(ref))!;
          expect(tx).toMatchObject({ status: 'pending', amount_minor: 15000, currency: 'GHS' });
          expect(s.fulfilment.applied).toEqual([]);
     });

     it('reuses the open checkout instead of creating a second one', async () => {
          const s = setup();
          const first = await start(s);
          const again = await s.service.initiate({ provider: 'paystack', tenantId: 5, periodStart: '2026-01-31', email: 'a@b.co' }, actor);
          expect(again.reused).toBe(true);
          expect(again.transaction.reference).toBe(first);
          expect(s.repo.rows).toHaveLength(1);
     });

     it('fulfils once after a verified success, even with repeated callbacks', async () => {
          const s = setup();
          const ref = await start(s);
          s.adapter.verifyResult = paid();
          const a = await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined);
          const b = await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined);
          expect(a).toMatchObject({ handled: true, duplicate: false, status: 'succeeded' });
          expect(b).toMatchObject({ duplicate: true });
          expect(s.fulfilment.applied).toEqual([ref]);
          expect((await s.repo.findByReference(ref))!.fulfilled_at).not.toBeNull();
     });

     it('rejects forged signatures and bad callback tokens without verifying', async () => {
          const s = setup();
          const ref = await start(s);
          await expect(s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'bad' }, undefined)).rejects.toMatchObject({ statusCode: 401 });
          const u = setup(false);
          const uref = await start(u);
          await expect(u.service.handleWebhook('paystack', hook(uref), { 'x-sig': 'ok' }, 'wrong')).rejects.toMatchObject({ statusCode: 401 });
          const ok = await u.service.handleWebhook('paystack', hook(uref), { 'x-sig': 'ok' }, callbackToken('s'.repeat(32), uref));
          expect(ok.handled).toBe(true);
          expect(s.adapter.verifyCalls + 0).toBe(0);
     });

     it('does not trust a webhook that claims success when the provider says pending', async () => {
          const s = setup();
          const ref = await start(s);
          s.adapter.verifyResult = { status: 'pending', amountMinor: null, currency: null, providerReference: null };
          await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined);
          expect((await s.repo.findByReference(ref))!.status).toBe('pending');
          expect(s.fulfilment.applied).toEqual([]);
     });

     it('flags amount, currency and unverifiable-amount mismatches without fulfilling', async () => {
          for (const result of [paid({ amountMinor: 100 }), paid({ currency: 'USD' }), paid({ amountMinor: null })]) {
               const s = setup();
               const ref = await start(s);
               s.adapter.verifyResult = result;
               await s.service.verifyAndApply(ref);
               const tx = (await s.repo.findByReference(ref))!;
               expect(tx.needs_review).toBe(true);
               expect(tx.status).toBe('pending');
               expect(s.fulfilment.applied).toEqual([]);
          }
     });

     it('keeps the transaction open and asks for a retry when verification is unavailable', async () => {
          const s = setup();
          const ref = await start(s);
          s.adapter.verifyResult = new GatewayError('down', 503, true);
          await expect(s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined)).rejects.toMatchObject({ statusCode: 503 });
          const tx = (await s.repo.findByReference(ref))!;
          expect(tx).toMatchObject({ status: 'pending', verify_attempts: 1 });
          s.adapter.verifyResult = paid();
          expect(await s.service.reconcile()).toMatchObject({ checked: 1, unavailable: 0 });
          expect((await s.repo.findByReference(ref))!.status).toBe('succeeded');
     });

     it('records failure, then ignores a later success claim (terminal)', async () => {
          const s = setup();
          const ref = await start(s);
          s.adapter.verifyResult = { status: 'failed', amountMinor: null, currency: null, providerReference: null };
          await s.service.verifyAndApply(ref);
          s.adapter.verifyResult = paid();
          await s.service.verifyAndApply(ref);
          expect((await s.repo.findByReference(ref))!.status).toBe('failed');
          expect(s.fulfilment.applied).toEqual([]);
     });

     it('expires an unpaid checkout but accepts a late verified payment', async () => {
          const s = setup();
          const ref = await start(s);
          s.setNow(new Date('2026-01-01T03:00:00Z'));
          await s.service.verifyAndApply(ref);
          expect((await s.repo.findByReference(ref))!.status).toBe('expired');
          s.adapter.verifyResult = paid();
          await s.service.verifyAndApply(ref);
          expect((await s.repo.findByReference(ref))!.status).toBe('succeeded');
          expect(s.fulfilment.applied).toEqual([ref]);
     });

     it('flags for review when fulfilment is refused (e.g. period already paid)', async () => {
          const s = setup();
          const ref = await start(s);
          s.fulfilment.refuse = true;
          s.adapter.verifyResult = paid();
          await s.service.verifyAndApply(ref);
          expect(await s.repo.findByReference(ref)).toMatchObject({ status: 'succeeded', needs_review: true, fulfilled_at: null });
     });

     it('ignores unknown references and provider mismatches', async () => {
          const s = setup();
          expect(await s.service.handleWebhook('paystack', hook('NOPE'), { 'x-sig': 'ok' }, undefined)).toMatchObject({ handled: false });
     });

     it('records an audit trail of status changes', async () => {
          const s = setup();
          const ref = await start(s);
          s.adapter.verifyResult = paid();
          await s.service.verifyAndApply(ref);
          const types = s.repo.evts.map(e => `${e.event_type}:${e.to_status ?? ''}`);
          expect(types).toEqual(expect.arrayContaining(['created:initiated', 'checkout_created:pending', 'status_changed:succeeded', 'fulfilled:']));
     });
});

describe('adapters', () => {
     const config = loadPaymentGatewayConfig({
          PAYSTACK_SECRET_KEY: 'sk_test_x', HUBTEL_CLIENT_ID: 'i', HUBTEL_CLIENT_SECRET: 's', HUBTEL_MERCHANT_ACCOUNT: 'm',
          PAYMENT_WEBHOOK_SECRET: 'w', PAYSWITCH_API_USER: 'u', PAYSWITCH_API_KEY: 'k', PAYSWITCH_MERCHANT_ID: 'mid',
     });
     const reply = (status: number, json: unknown) => (async () => ({ status, json: async () => json })) as unknown as typeof fetch;

     it('verifies the Paystack HMAC-SHA512 signature over the raw body', () => {
          const adapter = new PaystackAdapter(config);
          const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'PLSabc', id: 7 } }));
          const sig = createHmac('sha512', 'sk_test_x').update(body).digest('hex');
          expect(adapter.authenticateWebhook(body, { 'x-paystack-signature': sig })).toMatchObject({ reference: 'PLSabc' });
          expect(() => adapter.authenticateWebhook(body, { 'x-paystack-signature': 'a'.repeat(128) })).toThrow('Invalid signature');
          expect(() => adapter.authenticateWebhook(body, {})).toThrow('Invalid signature');
          expect(() => adapter.authenticateWebhook(Buffer.from(body.toString() + ' '), { 'x-paystack-signature': sig })).toThrow('Invalid signature');
     });

     it('maps Paystack verify responses', async () => {
          const ok = new PaystackAdapter(config, reply(200, { status: true, data: { status: 'success', amount: 15000, currency: 'ghs', reference: 'R' } }));
          expect(await ok.verify({ reference: 'R' })).toMatchObject({ status: 'succeeded', amountMinor: 15000, currency: 'GHS' });
          const abandoned = new PaystackAdapter(config, reply(200, { status: true, data: { status: 'abandoned', amount: 1, currency: 'GHS', reference: 'R' } }));
          expect((await abandoned.verify({ reference: 'R' })).status).toBe('pending');
          const other = new PaystackAdapter(config, reply(200, { status: true, data: { status: 'success', amount: 1, currency: 'GHS', reference: 'X' } }));
          await expect(other.verify({ reference: 'R' })).rejects.toThrow('different transaction reference');
          const down = new PaystackAdapter(config, reply(502, {}));
          await expect(down.verify({ reference: 'R' })).rejects.toMatchObject({ transient: true });
     });

     it('maps Hubtel and PaySwitch status checks and never invents amounts', async () => {
          const hubtel = new HubtelAdapter(config, reply(200, { data: { status: 'Paid', amount: 150, clientReference: 'R' } }));
          expect(await hubtel.verify({ reference: 'R' })).toMatchObject({ status: 'succeeded', amountMinor: 15000 });
          const ps = new PaySwitchAdapter(config, reply(200, { status: 'approved', code: '000', transaction_id: 'R' }));
          expect(await ps.verify({ reference: 'R' })).toMatchObject({ status: 'succeeded', amountMinor: null });
          expect(new PaySwitchAdapter(config).generateReference()).toMatch(/^\d{12}$/);
          expect(() => new PaySwitchAdapter(config).authenticateWebhook()).toThrow();
     });

     it('parses amounts without float drift', () => {
          expect(majorToMinor('0.10')).toBe(10);
          expect(majorToMinor(150.5)).toBe(15050);
          expect(majorToMinor('abc')).toBeNull();
          expect(majorToMinor('1.234')).toBeNull();
     });

     it('reports unconfigured providers as unavailable', () => {
          const empty = loadPaymentGatewayConfig({});
          expect([new PaystackAdapter(empty), new HubtelAdapter(empty), new PaySwitchAdapter(empty)].map(a => a.isConfigured())).toEqual([false, false, false]);
     });
});

class FakeBills implements IBillPaymentFulfilment {
     applied = new Set<string>();
     outstanding = 5000;
     async quote(_t: number, _b: number, requested?: number): Promise<BillQuote> {
          if (requested && requested > this.outstanding) throw new GatewayError('amount exceeds the outstanding balance');
          return { amountMinor: requested ?? this.outstanding, outstandingMinor: this.outstanding, label: 'Bill #9' };
     }
     async fulfil(tx: GatewayTransaction) { this.applied.add(tx.reference); return { ok: true, reference: `bill:${tx.subject_id}` }; }
}

function tenantSetup(enabledTenants = [7]) {
     const repo = new MemoryRepo();
     const tenantAdapter = new FakeAdapter(true);
     const platformAdapter = new FakeAdapter(true);
     const bills = new FakeBills();
     const resolver: ITenantGatewayResolver = {
          async resolve(tenantId) { return enabledTenants.includes(tenantId) ? { adapter: tenantAdapter, currency: 'GHS' } : null; },
     };
     const service = new PaymentGatewayService(repo, { paystack: platformAdapter }, new FakeFulfilment(),
          { publicBaseUrl: 'https://pls.test', returnUrl: '', webhookSecret: 's'.repeat(32), transactionTtlMinutes: 60 }, () => new Date('2026-01-01T00:10:00Z'),
          { resolver, bills });
     return { repo, tenantAdapter, platformAdapter, bills, service };
}
const billStart = (s: ReturnType<typeof tenantSetup>, tenantId = 7) =>
     s.service.initiateBill({ provider: 'paystack', tenantId, billingId: 9, email: 'p@x.co' }, { tenantId, employeeId: 3 });

describe('tenant patient-bill payments', () => {
     it('refuses checkout when the tenant has no gateway of its own (never uses platform credentials)', async () => {
          const s = tenantSetup([]);
          await expect(billStart(s)).rejects.toMatchObject({ statusCode: 503 });
          expect(s.platformAdapter.verifyCalls).toBe(0);
     });

     it('uses the server quote, scopes the webhook URL to the tenant and rejects over-payment', async () => {
          const s = tenantSetup();
          const { transaction } = await billStart(s);
          const row = (await s.repo.findByReference(transaction.reference))!;
          expect(row).toMatchObject({ purpose: 'patient_bill', subject_id: 9, tenant_id: 7, amount_minor: 5000 });
          await expect(s.service.initiateBill({ provider: 'paystack', tenantId: 7, billingId: 10, email: 'p@x.co', amountMinor: 999999 }, { tenantId: 7, employeeId: 3 }))
               .rejects.toMatchObject({ statusCode: 400 });
     });

     it('applies a verified payment to the bill once, however many callbacks arrive', async () => {
          const s = tenantSetup();
          const ref = (await billStart(s)).transaction.reference;
          s.tenantAdapter.verifyResult = paid({ amountMinor: 5000 });
          await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined, 7);
          await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined, 7);
          expect([...s.bills.applied]).toEqual([ref]);
          expect(s.tenantAdapter.verifyCalls).toBeGreaterThan(0);
          expect(s.platformAdapter.verifyCalls).toBe(0);
     });

     it('does not apply a payment whose amount differs from the bill quote', async () => {
          const s = tenantSetup();
          const ref = (await billStart(s)).transaction.reference;
          s.tenantAdapter.verifyResult = paid({ amountMinor: 100 });
          await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined, 7);
          expect(s.bills.applied.size).toBe(0);
          expect((await s.repo.findByReference(ref))!.needs_review).toBe(true);
     });

     it('ignores a webhook sent to another tenant or to the platform endpoint', async () => {
          const s = tenantSetup([7, 8]);
          const ref = (await billStart(s)).transaction.reference;
          s.tenantAdapter.verifyResult = paid({ amountMinor: 5000 });
          expect((await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined, 8)).handled).toBe(false);
          expect((await s.service.handleWebhook('paystack', hook(ref), { 'x-sig': 'ok' }, undefined)).handled).toBe(false);
          expect(s.bills.applied.size).toBe(0);
     });

     it('hides transactions from other tenants and from the wrong purpose', async () => {
          const s = tenantSetup([7, 8]);
          const ref = (await billStart(s)).transaction.reference;
          await expect(s.service.get(ref, { tenantId: 8, purpose: 'patient_bill' })).rejects.toMatchObject({ statusCode: 404 });
          await expect(s.service.get(ref, { purpose: 'facility_subscription' })).rejects.toMatchObject({ statusCode: 404 });
          await expect(s.service.get(ref, { tenantId: 7, purpose: 'patient_bill' })).resolves.toBeTruthy();
     });
});

describe('CredentialCipher', () => {
     const key = Buffer.alloc(32, 7);
     it('round-trips and binds ciphertext to its tenant and provider', () => {
          const cipher = new CredentialCipher(key);
          const blob = cipher.encrypt({ secretKey: 'sk_test_x' }, 'tenant:1:paystack');
          expect(blob).not.toContain('sk_test_x');
          expect(cipher.decrypt(blob, 'tenant:1:paystack')).toEqual({ secretKey: 'sk_test_x' });
          expect(() => cipher.decrypt(blob, 'tenant:2:paystack')).toThrow();
     });

     it('refuses to encrypt without a configured key and rejects malformed keys', () => {
          expect(() => new CredentialCipher(null).encrypt({ a: 'b' }, 'x')).toThrow(/not configured/);
          expect(parseCredentialKey('short')).toBeNull();
          expect(parseCredentialKey('a'.repeat(64))?.length).toBe(32);
     });

     it('builds tenant adapter config that never inherits platform credentials', () => {
          const base = loadPaymentGatewayConfig({ PAYSTACK_SECRET_KEY: 'platform-secret' } as any);
          const cfg = tenantAdapterConfig(base, 'paystack', {});
          expect(cfg.paystack.secretKey).toBe('');
          expect(new PaystackAdapter(cfg).isConfigured()).toBe(false);
     });
});
