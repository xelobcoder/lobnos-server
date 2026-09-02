import { Request, Response, Router } from 'express';
import { checkTokenExists } from '../../middleware/validateTenancy';
import { PharmacyCatalogueRepository } from '../../models/pharmacy/repositories/PharmacyCatalogueRepository';
import { PharmacyCatalogueSortField, PharmacySortDirection } from '../../models/pharmacy/interfaces/IPharmacyCatalogueRepository';
import { PharmacyCatalogueService } from '../../models/pharmacy/services/PharmacyCatalogueService';
import { PharmacySaleService } from '../../models/pharmacy/services/PharmacySaleService';
import { PharmacyDashboardRepository } from '../../models/pharmacy/repositories/PharmacyDashboardRepository';
import { PharmacyDashboardService } from '../../models/pharmacy/services/PharmacyDashboardService';

const router = Router();
const allowedRoles = new Set(['admin', 'manager', 'pharmacy_cashier', 'pharmacy_manager', 'pharmacy_storekeeper', 'pharmacy_dispensary_officer']);

const pharmacyAccess = (request: Request, response: Response, next: Function) => {
     const user = (request as any).authUser;
     if (!user || !allowedRoles.has(String(user.role || '').toLowerCase())) return response.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Pharmacy access is required' } });
     next();
};
const tenant = (request: Request) => Number((request as any).authUser.tenantId);
const catalogueService = (request: Request) => new PharmacyCatalogueService(new PharmacyCatalogueRepository(tenant(request)));
const pagingParams = (request: Request) => ({
     page: Number(request.query.page || 1),
     count: Number(request.query.count || 10),
     sortBy: request.query.sortBy as PharmacyCatalogueSortField | undefined,
     sortDirection: request.query.sortDirection as PharmacySortDirection | undefined
});

router.use(checkTokenExists, pharmacyAccess);
router.get('/catalogue', async (request: Request, response: Response) => {
     try {
          const listing = await catalogueService(request).getCatalogue({
               ...pagingParams(request),
               search: String(request.query.search || ''),
               sellableOnly: request.query.sellableOnly === 'true'
          });
          response.json({ success: true, data: listing });
     } catch (error: any) { response.status(500).json({ success: false, error: { code: 'CATALOGUE_UNAVAILABLE', message: error.message } }); }
});
router.get('/stock', async (request: Request, response: Response) => {
     try {
          const overview = await catalogueService(request).getStockOverview({
               ...pagingParams(request),
               search: String(request.query.search || ''),
               lowStockOnly: request.query.filter === 'low'
          });
          response.json({ success: true, data: overview });
     } catch (error: any) { response.status(500).json({ success: false, error: { code: 'STOCK_UNAVAILABLE', message: error.message } }); }
});
router.get('/dashboard', async (request: Request, response: Response) => {
     try {
          const dashboardService = new PharmacyDashboardService(new PharmacyDashboardRepository(tenant(request)));
          response.json({ success: true, data: await dashboardService.getDashboard() });
     } catch (error: any) { response.status(500).json({ success: false, error: { code: 'DASHBOARD_UNAVAILABLE', message: error.message } }); }
});
router.get('/sales-history', async (request: Request, response: Response) => {
     try {
          const page = Number(request.query.page || 1);
          const count = Number(request.query.count || 20);
          response.json({ success: true, data: await new PharmacySaleService(tenant(request)).getSalesHistory(page, count, String(request.query.search || '')) });
     } catch (error: any) { response.status(500).json({ success: false, error: { code: 'SALES_HISTORY_UNAVAILABLE', message: error.message } }); }
});
router.post('/sales', async (request: Request, response: Response) => {
     try { response.status(201).json({ success: true, data: await new PharmacySaleService(tenant(request)).completeSale(request.body, Number((request as any).authUser.employeeid)) }); }
     catch (error: any) { const status = /unavailable|insufficient|requires a prescription|positive|Duplicate/.test(error.message) ? 409 : 400; response.status(status).json({ success: false, error: { code: 'SALE_REJECTED', message: error.message } }); }
});

export default router;