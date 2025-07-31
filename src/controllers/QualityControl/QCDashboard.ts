import { Request, Response } from 'express';
import { QCSessionsRepository } from '../../repositories/QualityControl/QCSessionsRepository';

export class QCDashboardController {
     static async getDashboardData(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string)
               const repo = new QCSessionsRepository(tenantId);
               const dashboardData = await repo.getDashboardData();
               res.json(dashboardData);
          } catch (error: any) {
               res.status(500).json({ error: 'Failed to fetch QC dashboard data', details: error.message });
          }
     }

     static async getRecentAlertReadings(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string) || 1;
               const repo = new QCSessionsRepository(tenantId);
               const limit = parseInt(req.query.limit as string) || 10;
               const readings = await repo.getRecentAlertReadings(limit);
               res.json(readings);
          } catch (error: any) {
               res.status(500).json({ error: 'Failed to fetch recent alert readings', details: error.message });
          }
     }
}

export class QCSessionsController {
     static async getRecentReadingsWithDetails(req: Request, res: Response) {
          try {
               const tenantId = parseInt(req.query.tenantId as string) || 1;
               const repo = new QCSessionsRepository(tenantId);
               const limit = parseInt(req.query.limit as string) || 10;
               const readings = await repo.getRecentReadingsWithDetails(limit);
               res.json(readings);
          } catch (error: any) {
               res.status(500).json({ error: 'Failed to fetch recent QC readings', details: error.message });
          }
     }
}
