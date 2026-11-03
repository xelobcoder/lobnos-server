import { Request, Response, Router } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { PharmacyPurchaseOrders } from '../../models/pharmacy/PharmacyPurchaseOrders';
import { roleAllowed } from '../../middleware/roles';
import { pharmacyReversalAccess, pharmacyStockAccess } from './pharmacyAccess.middleware';

const operation = (work: (service: PharmacyPurchaseOrders, request: Request) => Promise<unknown>) => async (request: Request, response: Response) => {
     try {
          const actor = getAuthUser(request);
          if (!actor) return response.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'An authenticated pharmacy employee is required' } });
          if (!roleAllowed(actor.role, ['admin', 'pharmacy_manager', 'pharmacy_storekeeper', 'pharmacy_accountant']))
               return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy purchasing access is required' } });
          const db = await KnexConnection(actor.tenantId);
          return response.json({ success: true, data: await work(new PharmacyPurchaseOrders(db, actor), request) });
     } catch (error: unknown) {
          const failure = error instanceof Error ? error : new Error('The purchase order operation failed');
          const code = 'code' in failure && typeof failure.code === 'string' ? failure.code : '';
          const uncertain = /^(ER_|ECONN|ETIMEDOUT|PROTOCOL_)/.test(code);
          return response.status(uncertain ? 503 : 400).json({ success: false, error: { code: uncertain ? 'PHARMACY_OPERATION_UNCONFIRMED' : 'PHARMACY_OPERATION_REJECTED',
               message: uncertain ? 'The operation could not be confirmed. Retry the original request.' : failure.message } });
     }
};
export const pharmacyPurchaseOrderRouter = Router();
pharmacyPurchaseOrderRouter.get('/', operation(service => service.list()));
pharmacyPurchaseOrderRouter.post('/', pharmacyStockAccess, operation((service, request) => service.create(request.body)));
pharmacyPurchaseOrderRouter.get('/:id', operation((service, request) => service.detail(String(request.params.id))));
pharmacyPurchaseOrderRouter.post('/:id/submit', pharmacyStockAccess, operation((service, request) => service.submit(String(request.params.id), request.body)));
pharmacyPurchaseOrderRouter.post('/:id/update', pharmacyStockAccess, operation((service, request) => service.update(String(request.params.id), request.body)));
pharmacyPurchaseOrderRouter.post('/:id/decision', pharmacyReversalAccess, operation((service, request) => service.decide(String(request.params.id), request.body)));
pharmacyPurchaseOrderRouter.post('/:id/cancel', pharmacyReversalAccess, operation((service, request) => service.cancel(String(request.params.id), request.body)));
