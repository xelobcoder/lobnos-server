import { PrimeSmsAnalytics } from "../../../models/application/sms/services/PrimeSmsAnalytics";
import { Request, response, Response } from 'express';
import { TestApprovalClass } from "../../../models/operations/testApprovalClass";

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


     async getTransactionResultReady(req: Request, res: Response) {
          try {
               const billingid = req.params.billingid;
               if (!billingid) return res.status(400).json({ success: false, error: 'Missing billingid' });
               const tenantId = Number(req.query.tenantId);
               const parsedBillingId = parseInt(billingid.toString(), 10);
               const getTransactionStatus = await TestApprovalClass.getTransactionAscensionsApprovalStatus(tenantId, parsedBillingId);
               res.send({
                    success: true,
                    data: getTransactionStatus
               });
          } catch (err: any) {
               res.status(500).json({ success: false, error: err.message || 'Failed to fetch transaction result ready status' });
          }
     }
}
