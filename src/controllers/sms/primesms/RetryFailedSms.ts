import { Request, Response } from 'express';
import { SmsJobsService } from '../../../models/application/sms/services/SmsJobsService';
import { PrimeSmsJobsRepo } from '../../../models/application/sms/repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../../../models/application/sms/repositories/PrimeSmsJobRecipientsRepo';



/**
 * Handler to retry a failed SMS transaction.
 * @param req - Express request object
 * @param res - Express response object
 */

export async function retryFailedTransactionHandler(req: Request, res: Response) {
     try {
          const tenantId = parseInt(req.query.tenantId as string);
          const jobid = Number(req.params.jobid);
          const refid = req.params.refid;
          const jobsRepo = new PrimeSmsJobsRepo(tenantId);
          const jobRecipientsRepo = new PrimeSmsJobRecipientsRepo(tenantId);
          const result = await new SmsJobsService(jobsRepo, jobRecipientsRepo, tenantId).retryFailedTransaction(tenantId, jobid, refid as string);
          res.status(200).json({ status: result.status === "success" ? 'success' : 'failed', message: result.message || 'Transaction retry initiated.' });
     } catch (err:any) {
          res.status(400).json({ error: err.message });
     }
}