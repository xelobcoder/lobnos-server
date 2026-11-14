import { Router } from 'express';
import { requireReportAccess } from '../../middleware/reportAuthority';
import { ReportController } from './ReportController';

const reportsRouter = Router();

reportsRouter.use('/api/v1/reports', requireReportAccess);

reportsRouter.get('/api/v1/reports/datasets', ReportController.datasets);
reportsRouter.post('/api/v1/reports/preview', ReportController.preview);
reportsRouter.post('/api/v1/reports/export', ReportController.exportAdhoc);

reportsRouter.get('/api/v1/reports', ReportController.list);
reportsRouter.post('/api/v1/reports', ReportController.create);
reportsRouter.get('/api/v1/reports/:id', ReportController.get);
reportsRouter.put('/api/v1/reports/:id', ReportController.update);
reportsRouter.delete('/api/v1/reports/:id', ReportController.remove);
reportsRouter.post('/api/v1/reports/:id/run', ReportController.run);
reportsRouter.get('/api/v1/reports/:id/export', ReportController.exportSaved);

export default reportsRouter;
