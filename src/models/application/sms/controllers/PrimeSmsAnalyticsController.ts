
import { Request, Response } from 'express';
import { PrimeSmsAnalytics } from '../services/PrimeSmsAnalytics';

export class PrimeSmsAnalyticsController {
     getJobStatusCounts(req: Request, res: Response) {
          const tenantId = Number(req.query.tenantId);
          const analytics = new PrimeSmsAnalytics(tenantId);
          analytics.getJobStatusCounts()
               .then(data => res.json({ success: true, data }))
               .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch job status counts' }));
     }

     getRecipientDeliveryCounts(req: Request, res: Response) {
          if (!req.query.tenantId) {
               return res.status(400).json({ success: false, error: 'Missing tenantId' });
          }
          const tenantId = Number(req.query.tenantId);
          const analytics = new PrimeSmsAnalytics(tenantId);
          analytics.getRecipientDeliveryCounts()
               .then(data => res.json({ success: true, data }))
               .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch recipient delivery counts' }));
     }

     getTotals(req: Request, res: Response) {
          if (!req.query.tenantId) {
               return res.status(400).json({ success: false, error: 'Missing tenantId' });
          }
          const tenantId = Number(req.query.tenantId);
          const analytics = new PrimeSmsAnalytics(tenantId);
          analytics.getTotals()
               .then(data => res.json({ success: true, data }))
               .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch totals' }));
     }

     getJobCountsByCategory(req: Request, res: Response) {
          if (!req.query.tenantId) {
               return res.status(400).json({ success: false, error: 'Missing tenantId' });
          }
          const tenantId = Number(req.query.tenantId);
          const analytics = new PrimeSmsAnalytics(tenantId);
          analytics.getJobCountsByCategory()
               .then(data => res.json({ success: true, data }))
               .catch(() => res.status(500).json({ success: false, error: 'Failed to fetch job counts by category' }));
     }

     getJobTrendsByDay(req: Request, res: Response) {
          if (!req.query.tenantId) {
               return res.status(400).json({ success: false, error: 'Missing tenantId' });
          }
          const tenantId = Number(req.query.tenantId);
          const from = req.query.from ? String(req.query.from) : undefined;
          const to = req.query.to ? String(req.query.to) : undefined;
          const days = req.query.days ? Number(req.query.days) : 30;
          const analytics = new PrimeSmsAnalytics(tenantId);
          analytics.getJobTrendsByDay(days, from, to)
               .then(data => res.json({ success: true, data }))
               .catch((err) => res.status(500).json({ success: false, error: err.message || 'Failed to fetch job trends by day' }));
     }

     getDeliveryTrendsByDay(req: Request, res: Response) {
          if (!req.query.tenantId) {
               return res.status(400).json({ success: false, error: 'Missing tenantId' });
          }
          const tenantId = Number(req.query.tenantId);
          const from = req.query.from ? String(req.query.from) : undefined;
          const to = req.query.to ? String(req.query.to) : undefined;
          const days = req.query.days ? Number(req.query.days) : 30;
          const analytics = new PrimeSmsAnalytics(tenantId);
          analytics.getDeliveryTrendsByDay(days, from, to)
               .then(data => res.json({ success: true, data }))
               .catch((err) => res.status(500).json({ success: false, error: err.message || 'Failed to fetch delivery trends by day' }));
     }
}
