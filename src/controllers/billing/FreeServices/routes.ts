import { Router, Request, Response } from 'express';
import { FreeServicesController } from './FreeServicesController';

const router = Router();

router.post('/request', (req: Request, res: Response) =>
     FreeServicesController.requestFreeService(req as any, res)
);

router.post('/approve', (req: Request, res: Response) =>
     FreeServicesController.approveRequest(req as any, res)
);

router.post('/reject', (req: Request, res: Response) =>
     FreeServicesController.rejectRequest(req as any, res)
);

router.get('/summary', (req: Request, res: Response) =>
     FreeServicesController.getSummary(req as any, res)
);

router.get('/list', (req: Request, res: Response) =>
     FreeServicesController.listRequests(req as any, res)
);

router.get('/status/:requestId', (req: Request, res: Response) =>
     FreeServicesController.getStatus(req as any, res)
);

router.get('/billing/:billingId', (req: Request, res: Response) =>
     FreeServicesController.getRequestsByBilling(req as any, res)
);

router.get('/request/:requestId', (req: Request, res: Response) =>
     FreeServicesController.getRequest(req as any, res)
);

router.delete('/request/:requestId/withdraw', (req: Request, res: Response) =>
     FreeServicesController.withdrawRequest(req as any, res)
);

export default router;
