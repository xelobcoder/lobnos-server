import { Request, Response } from "express";
import { PrimeEventsSMSDataSource } from "../../../models/application/sms/events/PrimeEventsDataSource";

export const sendEventSmsPaymentHandler = async (req: Request, res: Response) => {
     const tenantId = Number(req.query.tenantId);
     const billingid = req.query.billingid;
     if (!tenantId || !billingid) {
          return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
     }
     try {
          const parsedBillingId = parseInt(billingid.toString(), 10);
          const repo = new PrimeEventsSMSDataSource(tenantId);
          const sms = await repo.paymentConfirmationEvent(tenantId, parsedBillingId);
          res.send(sms);
     } catch (err: any) {
          res.status(500).json({ success: false, error: err.message || 'Failed to send SMS payment' });
     }
}