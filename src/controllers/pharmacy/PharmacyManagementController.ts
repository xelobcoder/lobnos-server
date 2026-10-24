import { Request, Response } from 'express';
import KnexConnection from '../../database/KnexConnections';
import { PharmacyManagement } from '../../models/pharmacy/PharmacyManagement';
import { actorOf, branchOf, tenantOf } from './pharmacyContext';

type Operation = (service: PharmacyManagement, req: Request) => Promise<any>;
export const pharmacyOperation = (operation: Operation) => async (req: Request, res: Response) => {
     try {
          const service = new PharmacyManagement(await KnexConnection(tenantOf(req)), branchOf(req)!, actorOf(req));
          res.json({ success: true, data: await operation(service, req) });
     } catch (error: any) {
          const uncertain = typeof error.code === 'string';
          res.status(uncertain ? 503 : 400).json({ success: false, error: { code: uncertain ? 'PHARMACY_OPERATION_UNCONFIRMED' : 'PHARMACY_OPERATION_REJECTED', message: uncertain ? 'The operation could not be confirmed. Retry the original request.' : error.message } });
     }
};
