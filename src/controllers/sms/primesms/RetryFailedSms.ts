import { Request, Response } from 'express';
import { SmsJobsService } from '../../../models/application/sms/services/SmsJobsService';
import { PrimeSmsJobsRepo } from '../../../models/application/sms/repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../../../models/application/sms/repositories/PrimeSmsJobRecipientsRepo';



/**
 * Handler to retry a failed SMS transaction.
 * @param req - Express request object
 * @param res - Express response object
 */

import { getAuthUser } from '../../../middleware/authority';
import { SmsCampaignService } from '../../../models/application/sms/SmsCampaignService';
export async function retryFailedTransactionHandler(req: Request, res: Response) {
 try {
  const actor=getAuthUser(req);if(!actor)return res.status(401).json({error:'Authentication required'});
  const jobid=Number(req.params.jobid),refid=Number(req.params.refid);
  if(!Number.isSafeInteger(jobid)||jobid<=0||!Number.isSafeInteger(refid)||refid<=0)return res.status(400).json({error:'Invalid message reference'});
  res.json(await new SmsCampaignService(actor.tenantId).retry(jobid,refid,actor));
 }catch(error:any){res.status(error?.statusCode||500).json({error:error?.statusCode?error.message:'Unable to queue the retry'});}
}
