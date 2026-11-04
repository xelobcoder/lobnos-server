import { getAuthUser } from '../../../middleware/authority';
import { Request, Response } from "express";
import { PrimeEventsSMSDataSource } from "../../../models/application/sms/events/PrimeEventsDataSource";
import KnexConnection from "../../../database/KnexConnections";
import { TestApprovalClass } from "../../../models/operations/testApprovalClass";
import { assertCriticalRelease } from "../../../models/operations/CriticalActionService";

export const sendEventSmsPaymentHandler = async (req: Request, res: Response) => {
     const tenantId = Number(req.query.tenantId);
     const billingid = req.query.billingid;
     const employeeId = getAuthUser(req)?.employeeid;

     if (!billingid || !employeeId) return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
     try {
          const parsedBillingId = parseInt(billingid.toString(), 10);
          const parsedEmployeeId = parseInt(employeeId.toString(), 10);
          const repo = new PrimeEventsSMSDataSource(tenantId);
          const sms = await repo.paymentConfirmationEvent(tenantId, parsedBillingId, parsedEmployeeId);
          res.send(sms);
     } catch (err: any) {
          console.log('Error sending SMS payment event:', err);
          res.status(500).json({ success: false, error: err.message || 'Failed to send SMS payment' });
     }
}


export const getClientResultReadySentcount = async (req: Request, res: Response) => {
     const tenantId = Number(req.query.tenantId);
     const billingid = req.query.billingid;
     if (!tenantId || !billingid) return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
     try {
          const parsedBillingId = parseInt(billingid.toString(), 10);
          if (isNaN(parsedBillingId)) return res.status(400).json({ success: false, error: 'Invalid billingid' });
          const count = await PrimeEventsSMSDataSource.getClientResultReadySentcount(tenantId, parsedBillingId);
          res.json({ success: true, count });
     } catch (err: any) {
          res.status(500).json({ success: false, error: err.message || 'Failed to get sent count' });
     }
}


export const sendResultReadyEvent = async (req: Request, res: Response) => {
     const tenantId = Number(req.query.tenantId);
     const billingid = req.query.billingid;
     const actor = getAuthUser(req);
     if (!actor) return res.status(401).json({ success: false, error: 'Authentication required' });
     const customMessage = typeof req.query.message !== 'undefined' && req.query.message !== null ? req.query.message.toString() : '';
     if (!tenantId || !billingid) return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
     try {
          const parsedBillingId = Number(billingid);
          if (!Number.isSafeInteger(parsedBillingId) || parsedBillingId <= 0) return res.status(400).json({ success: false, error: 'Invalid billingid' });
          const connection = await KnexConnection(tenantId);
          const bill = await connection('billing').where({ billingid: parsedBillingId }).first('branchid');
          if (!bill || (actor.branch != null && Number(bill.branchid) !== Number(actor.branch)))
               return res.status(403).json({ success: false, error: 'Billing access denied' });
          const results = await TestApprovalClass.getTransactionAscensionsApprovalStatus(tenantId, parsedBillingId);
          if (!results.length || results.some(result => !result.resultEntryEnd || Number(result.isapproved) !== 1 || Number(result.requires_revalidation) === 1))
               return res.status(409).json({ success: false, error: 'All ordered results must be finalized before sending result-ready SMS' });
          for (const result of results) await assertCriticalRelease(connection, Number(result.ascensionid), 'release');
          const repo = new PrimeEventsSMSDataSource(tenantId);
          const sms = await repo.testAscensionEventDataAllDone(tenantId, parsedBillingId, actor.employeeid, true, customMessage);
          if (!sms || (sms.status !== true && sms.status !== 'success'))
               return res.status(409).json({ success: false, error: 'Result-ready SMS was not queued. Check SMS activation and event settings.' });
          res.json({ success: true, sms });
     } catch (err: any) {
          console.error('Error sending result ready event:', err);
          res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Failed to send result ready event' });
     }
}

export const getSentResultReadyMessage = async (req: Request, res: Response) => {
     const tenantId = Number(req.query.tenantId);
     const billingid = req.query.billingid;
     if (!tenantId || !billingid) return res.status(400).json({ success: false, error: 'Missing tenantId or billingid' });
     try {
          const parsedBillingId = parseInt(billingid.toString(), 10);
          if (isNaN(parsedBillingId)) return res.status(400).json({
               success: false,
               error: 'Invalid billingid'
          });
          const message = await PrimeEventsSMSDataSource.getSentSMSEventMessage(tenantId, 'PATIENT_RESULT_READY', parsedBillingId);
     
          if (!message) return res.status(404).json({ success: false, error: 'No message found' });
          res.json({ success: true, message });
     } catch (err: any) {
          console.error('Error getting sent result ready message:', err);
          res.status(500).json({ success: false, error: err.message || 'Failed to get sent message' });
     }
};
