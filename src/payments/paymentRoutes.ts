import express, { Request, Response, Router } from 'express';
import logger from '../hooks/logger';
import { customError } from '../hooks/helper';
import { createRateLimiter } from '../middleware/rateLimiter';
import { requirePlatformFacilityAuthority } from '../middleware/platformFacilityAuthority';
import { FacilityError } from '../models/Tenancy/FacilityInput';
import { FacilityManagementService } from '../models/Tenancy/FacilityManagementService';
import { parseTenantIdParam } from '../models/Tenancy/FacilityManagementInput';
import { loadPaymentGatewayConfig } from './PaymentGatewayConfig';
import { PaymentGatewayRepository } from './PaymentGatewayRepository';
import { PaymentGatewayService } from './PaymentGatewayService';
import { SubscriptionPaymentFulfilment } from './SubscriptionPaymentFulfilment';
import { PatientBillFulfilment } from './PatientBillFulfilment';
import { TenantGatewayResolver } from './TenantGatewayResolver';
import { TenantGatewayStore, isProvider } from './TenantGatewayStore';
import { getAuthUser } from '../middleware/authority';
import { roleAllowed } from '../middleware/roles';
import { HubtelAdapter } from './adapters/HubtelAdapter';
import { PaySwitchAdapter } from './adapters/PaySwitchAdapter';
import { PaystackAdapter } from './adapters/PaystackAdapter';
import { GATEWAY_PROVIDERS, GatewayError, GatewayStatus } from './types';

let singleton: PaymentGatewayService | null = null;
let tenantStore: TenantGatewayStore | null = null;

export function getTenantGatewayStore(): TenantGatewayStore {
     if (!tenantStore) tenantStore = new TenantGatewayStore();
     return tenantStore;
}

export function getPaymentGatewayService(): PaymentGatewayService {
     if (!singleton) {
          const config = loadPaymentGatewayConfig();
          const store = getTenantGatewayStore();
          singleton = new PaymentGatewayService(
               new PaymentGatewayRepository(),
               { paystack: new PaystackAdapter(config), hubtel: new HubtelAdapter(config), payswitch: new PaySwitchAdapter(config) },
               new SubscriptionPaymentFulfilment(new FacilityManagementService()),
               {
                    publicBaseUrl: config.publicBaseUrl, returnUrl: config.returnUrl, webhookSecret: config.webhookSecret,
                    transactionTtlMinutes: config.transactionTtlMinutes,
               },
               () => new Date(),
               { resolver: new TenantGatewayResolver(store), bills: new PatientBillFulfilment(store) },
          );
     }
     return singleton;
}

export const anyPaymentProviderConfigured = () => getPaymentGatewayService().providers().some(provider => provider.configured);

const fail = (res: Response, error: unknown, context: string) => {
     if (error instanceof GatewayError || error instanceof FacilityError) {
          const status = (error as any).statusCode ?? 400;
          return customError(error.message, status, res);
     }
     // Log only the error class/driver code; never request bodies, headers or provider payloads.
     logger.error(`[payments] ${context} failed: ${(error as any)?.code ?? (error as any)?.name ?? 'unknown'}`);
     return customError('Payment service temporarily unavailable', 503, res);
};

const STATUSES: GatewayStatus[] = ['initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'expired', 'refund_pending', 'refunded'];

/**
 * Provider-facing endpoints. Mount BEFORE express.json and before auth/licence middleware: the webhook needs the
 * exact raw bytes for signature checks, and providers cannot present PLS credentials. Authenticity comes from the
 * provider signature or PLS callback token, and success always requires API verification.
 */
export function createPaymentWebhookRouter(service: () => PaymentGatewayService = getPaymentGatewayService): Router {
     const router = Router();
     const limiter = createRateLimiter({ windowMs: 60_000, max: 300 });
     const raw = express.raw({ type: '*/*', limit: '256kb' });

     router.post('/api/v1/payments/webhooks/:provider', limiter, raw, async (req: Request, res: Response) => {
          try {
               const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
               const result = await service().handleWebhook(String(req.params.provider), body, req.headers, req.query.k);
               return res.status(200).send({ status: 'success', received: true, handled: result.handled });
          } catch (error) {
               return fail(res, error, 'webhook');
          }
     });

     router.post('/api/v1/payments/webhooks/:provider/:tenantId', limiter, raw, async (req: Request, res: Response) => {
          try {
               if (!/^\d{1,9}$/.test(String(req.params.tenantId))) throw new GatewayError('Unknown tenant', 404);
               const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
               const result = await service().handleWebhook(String(req.params.provider), body, req.headers, req.query.k, Number(req.params.tenantId));
               return res.status(200).send({ status: 'success', received: true, handled: result.handled });
          } catch (error) {
               return fail(res, error, 'tenant-webhook');
          }
     });

     router.get('/api/v1/payments/return/:provider', limiter, async (req: Request, res: Response) => {
          try {
               const transaction = await service().handleReturn(String(req.params.provider), String(req.query.ref ?? ''));
               if (!transaction) return customError('Unknown payment', 404, res);
               // Outcome comes from the verified PLS record, never from the query string the browser supplied.
               const outcome = { reference: transaction.reference, status: transaction.status };
               const target = loadPaymentGatewayConfig().returnUrl;
               if (target) {
                    const url = new URL(target);
                    url.searchParams.set('reference', outcome.reference);
                    url.searchParams.set('status', outcome.status);
                    return res.redirect(303, url.toString());
               }
               return res.json({ status: 'success', result: outcome });
          } catch (error) {
               return fail(res, error, 'return');
          }
     });

     return router;
}

/** Platform-administrator endpoints (control tenant only, via requirePlatformFacilityAuthority). */
export function createPlatformPaymentsRouter(service: () => PaymentGatewayService = getPaymentGatewayService): Router {
     const router = Router();
     const run = (operation: (req: Request, res: Response) => Promise<unknown>, context: string) => async (req: Request, res: Response) => {
          try { return res.json({ status: 'success', result: await operation(req, res) }); } catch (error) { return fail(res, error, context); }
     };
     const admin = createRateLimiter({ windowMs: 60_000, max: 120 });

     router.post('/api/v1/platform/facilities/:tenantId/gateway-payments', admin, requirePlatformFacilityAuthority, run(async (req, res) => {
          const tenantId = parseTenantIdParam(String(req.params.tenantId));
          const { provider, periodStart, email } = req.body ?? {};
          if (!GATEWAY_PROVIDERS.includes(provider)) throw new GatewayError('provider must be paystack, hubtel or payswitch');
          if (typeof periodStart !== 'string' || typeof email !== 'string') throw new GatewayError('periodStart and email are required');
          return service().initiate({ provider, tenantId, periodStart, email }, res.locals.facilityActor);
     }, 'initiate'));

     router.get('/api/v1/platform/payments/providers', requirePlatformFacilityAuthority, run(async () => service().providers(), 'providers'));

     router.get('/api/v1/platform/payments/transactions', requirePlatformFacilityAuthority, run(async req => {
          const status = typeof req.query.status === 'string' && STATUSES.includes(req.query.status as GatewayStatus) ? req.query.status as GatewayStatus : undefined;
          const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
          const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize ?? '25'), 10) || 25));
          const tenantId = req.query.tenantId ? parseTenantIdParam(String(req.query.tenantId)) : undefined;
          const needsReview = req.query.needsReview === undefined ? undefined : req.query.needsReview === 'true';
          return service().list({ status, tenantId, needsReview, page, pageSize, purpose: 'facility_subscription' });
     }, 'list'));

     router.get('/api/v1/platform/payments/transactions/:reference', requirePlatformFacilityAuthority, run(req => service().get(String(req.params.reference), { purpose: 'facility_subscription' }), 'get'));

     router.post('/api/v1/platform/payments/transactions/:reference/verify', admin, requirePlatformFacilityAuthority, run(async req => {
          const outcome = await service().verifyScoped(String(req.params.reference), { purpose: 'facility_subscription' });
          return { verified: outcome.verified, transaction: service().publicView(outcome.transaction) };
     }, 'verify'));

     router.post('/api/v1/platform/payments/reconcile', admin, requirePlatformFacilityAuthority, run(() => service().reconcile(), 'reconcile'));

     return router;
}

const GATEWAY_ADMIN_ROLES = ['admin', 'superadmin', 'accountant'];
const NON_COLLECTING_ROLES = ['clinician', 'doctor', 'patient'];

/**
 * Endpoints a facility uses to collect patient bills into its own merchant accounts. Mount AFTER checkTokenExists:
 * the tenant and employee always come from the verified session, never from the request body.
 */
export function createTenantPaymentsRouter(
     service: () => PaymentGatewayService = getPaymentGatewayService,
     store: () => TenantGatewayStore = getTenantGatewayStore,
): Router {
     const router = Router();
     const limiter = createRateLimiter({ windowMs: 60_000, max: 120 });
     const base = '/api/v1/payments/gateway';

     const guarded = (kind: 'admin' | 'collect', operation: (req: Request, user: NonNullable<ReturnType<typeof getAuthUser>>) => Promise<unknown>, context: string) =>
          async (req: Request, res: Response) => {
               try {
                    const user = getAuthUser(req);
                    if (!user || !user.tenantId) return customError('Authentication required', 401, res);
                    const allowed = kind === 'admin' ? roleAllowed(user.role, GATEWAY_ADMIN_ROLES) : !roleAllowed(user.role, NON_COLLECTING_ROLES);
                    if (!allowed) return customError('You are not permitted to perform this action', 403, res);
                    return res.json({ status: 'success', result: await operation(req, user) });
               } catch (error) {
                    return fail(res, error, context);
               }
          };

     const provider = (req: Request) => {
          if (!isProvider(req.params.provider)) throw new GatewayError('Unknown payment provider', 404);
          return req.params.provider;
     };

     router.get(`${base}/providers`, limiter, guarded('collect', async (_req, user) => {
          const views = await store().list(user.tenantId);
          return {
               encryptionAvailable: store().encryptionAvailable,
               providers: views.map(view => ({ ...view, webhookUrl: service().tenantWebhookUrl(view.provider, user.tenantId) })),
          };
     }, 'tenant-providers'));

     router.put(`${base}/providers/:provider`, limiter, guarded('admin', async (req, user) => {
          const saved = await store().save(user.tenantId, provider(req), req.body ?? {}, user.employeeid);
          return { ...saved, webhookUrl: service().tenantWebhookUrl(saved.provider, user.tenantId) };
     }, 'tenant-provider-save'));

     router.delete(`${base}/providers/:provider`, limiter, guarded('admin', async (req, user) => {
          await store().remove(user.tenantId, provider(req));
          return { removed: true };
     }, 'tenant-provider-remove'));

     router.post(`${base}/bills/:billingId/checkout`, limiter, guarded('collect', async (req, user) => {
          if (!/^\d{1,12}$/.test(String(req.params.billingId))) throw new GatewayError('Invalid bill');
          const { provider: chosen, email, amount } = req.body ?? {};
          if (typeof chosen !== 'string' || typeof email !== 'string') throw new GatewayError('provider and email are required');
          let amountMinor: number | undefined;
          if (amount !== undefined && amount !== null && amount !== '') {
               const value = Number(amount);
               if (!Number.isFinite(value) || value <= 0) throw new GatewayError('amount must be greater than zero');
               amountMinor = Math.round(value * 100);
          }
          return service().initiateBill(
               { provider: chosen, tenantId: user.tenantId, billingId: Number(req.params.billingId), email, amountMinor },
               { tenantId: user.tenantId, employeeId: user.employeeid },
          );
     }, 'bill-checkout'));

     router.get(`${base}/transactions`, limiter, guarded('collect', async (req, user) => {
          const status = typeof req.query.status === 'string' && STATUSES.includes(req.query.status as GatewayStatus) ? req.query.status as GatewayStatus : undefined;
          const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
          const pageSize = Math.min(100, Math.max(1, Number.parseInt(String(req.query.pageSize ?? '25'), 10) || 25));
          const needsReview = req.query.needsReview === undefined ? undefined : req.query.needsReview === 'true';
          return service().list({ status, tenantId: user.tenantId, needsReview, page, pageSize, purpose: 'patient_bill' });
     }, 'tenant-list'));

     router.get(`${base}/transactions/:reference`, limiter, guarded('collect', (req, user) =>
          service().get(String(req.params.reference), { tenantId: user.tenantId, purpose: 'patient_bill' }), 'tenant-get'));

     router.post(`${base}/transactions/:reference/verify`, limiter, guarded('collect', async (req, user) => {
          const outcome = await service().verifyScoped(String(req.params.reference), { tenantId: user.tenantId, purpose: 'patient_bill' });
          return { verified: outcome.verified, transaction: service().publicView(outcome.transaction) };
     }, 'tenant-verify'));

     return router;
}
