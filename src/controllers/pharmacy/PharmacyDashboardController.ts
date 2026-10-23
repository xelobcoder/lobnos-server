import { Request, Response } from 'express';
import { PharmacyDashboardRepository } from '../../models/pharmacy/repositories/PharmacyDashboardRepository';
import { PharmacyDashboardService } from '../../models/pharmacy/services/PharmacyDashboardService';
import { tenantOf,branchOf } from './pharmacyContext';

export class PharmacyDashboardController {
     static async getDashboard(request: Request, response: Response): Promise<void> {
          try {
               const dashboardService = new PharmacyDashboardService(new PharmacyDashboardRepository(tenantOf(request),branchOf(request)));
               response.json({ success: true, data: await dashboardService.getDashboard() });
          } catch (error: any) {
               response.status(500).json({ success: false, error: { code: 'DASHBOARD_UNAVAILABLE', message: error.message } });
          }
     }
}
