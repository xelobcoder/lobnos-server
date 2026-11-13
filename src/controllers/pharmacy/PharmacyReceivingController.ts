import { Request, Response, Router } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { PharmacyReceiving } from '../../models/pharmacy/PharmacyReceiving';
import { PharmacySupplierInvoices } from '../../models/pharmacy/PharmacySupplierInvoices';
import { calculatePharmacyPrice } from '../../models/pharmacy/PharmacyPricing';
import { tenantOf } from './pharmacyContext';
import { pharmacyFinanceAccess, pharmacyReversalAccess, pharmacyStockAccess } from './pharmacyAccess.middleware';

type Services = { receiving: PharmacyReceiving; invoices: PharmacySupplierInvoices };
const operation = (work: (services: Services, request: Request) => Promise<unknown>) => async (request: Request, response: Response) => {
     try {
          const db = await KnexConnection(tenantOf(request)), actor = getAuthUser(request);
          if (!actor) return response.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'An authenticated pharmacy employee is required' } });
          const data = await work({ receiving: new PharmacyReceiving(db, actor), invoices: new PharmacySupplierInvoices(db, actor) }, request);
          return response.json({ success: true, data });
     } catch (error: unknown) {
          const failure = error instanceof Error ? error : new Error('The receiving operation failed');
          const code = 'code' in failure && typeof failure.code === 'string' ? failure.code : '';
          const uncertain = /^(ER_|ECONN|ETIMEDOUT|PROTOCOL_)/.test(code);
          return response.status(uncertain ? 503 : 400).json({ success: false, error: { code: uncertain ? 'PHARMACY_OPERATION_UNCONFIRMED' : 'PHARMACY_OPERATION_REJECTED',
               message: uncertain ? 'The operation could not be confirmed. Retry the original request.' : failure.message } });
     }
};
export const pharmacyReceivingRouter = Router();
pharmacyReceivingRouter.get('/setup', pharmacyStockAccess, operation((s, r) => s.receiving.setup(typeof r.query.orderId === 'string' ? r.query.orderId : undefined)));
pharmacyReceivingRouter.get('/deliveries', pharmacyStockAccess, operation(s => s.receiving.deliveries()));
pharmacyReceivingRouter.get('/deliveries/:id', pharmacyStockAccess, operation((s, r) => s.receiving.delivery(String(r.params.id))));
pharmacyReceivingRouter.post('/deliveries', pharmacyStockAccess, operation((s, r) => s.receiving.record(r.body)));
pharmacyReceivingRouter.post('/receive', pharmacyStockAccess,
     (request, response, next) => request.body?.invoice ? pharmacyReversalAccess(request, response, next) : next(),
     operation((s, r) => s.receiving.receive(r.body)));
pharmacyReceivingRouter.post('/deliveries/:id/accept', pharmacyStockAccess, operation((s, r) => s.receiving.accept(String(r.params.id), r.body)));
pharmacyReceivingRouter.post('/deliveries/:id/finish', pharmacyStockAccess,
     (request, response, next) => request.body?.invoice ? pharmacyReversalAccess(request, response, next) : next(),
     operation((s, r) => s.receiving.finish(String(r.params.id), r.body)));
pharmacyReceivingRouter.post('/deliveries/:id/return', pharmacyReversalAccess, operation((s, r) => s.receiving.returnHeld(String(r.params.id), r.body)));
pharmacyReceivingRouter.post('/policy', pharmacyReversalAccess, operation((s, r) => s.receiving.savePolicy(r.body)));
pharmacyReceivingRouter.post('/prices/preview', pharmacyStockAccess, operation(async (s, r) => r.body.receipt
     ? s.receiving.previewReceivePrice(r.body) : r.body.deliveryId
          ? s.receiving.previewPrice(r.body) : calculatePharmacyPrice(r.body.cost, r.body, r.body.increment)));
pharmacyReceivingRouter.get('/invoices', pharmacyFinanceAccess, operation(s => s.receiving.invoices()));
pharmacyReceivingRouter.get('/uninvoiced', pharmacyFinanceAccess, operation(s => s.receiving.uninvoiced()));
pharmacyReceivingRouter.get('/invoices/:id', pharmacyFinanceAccess, operation((s, r) => s.invoices.detail(String(r.params.id))));
pharmacyReceivingRouter.post('/invoices/:id/copies', pharmacyReversalAccess, operation((s, r) => s.invoices.attachCopy(String(r.params.id), r.body)));
pharmacyReceivingRouter.get('/invoices/:id/copies/:fileId', pharmacyFinanceAccess, operation((s, r) => s.invoices.copy(String(r.params.id), String(r.params.fileId))));
pharmacyReceivingRouter.post('/invoices', pharmacyReversalAccess, operation((s, r) => s.invoices.record(r.body)));
