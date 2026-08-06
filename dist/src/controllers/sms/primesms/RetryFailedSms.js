"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryFailedTransactionHandler = retryFailedTransactionHandler;
const SmsJobsService_1 = require("../../../models/application/sms/services/SmsJobsService");
const PrimeSmsJobsRepo_1 = require("../../../models/application/sms/repositories/PrimeSmsJobsRepo");
const PrimeSmsJobRecipientsRepo_1 = require("../../../models/application/sms/repositories/PrimeSmsJobRecipientsRepo");
/**
 * Handler to retry a failed SMS transaction.
 * @param req - Express request object
 * @param res - Express response object
 */
async function retryFailedTransactionHandler(req, res) {
    try {
        const tenantId = parseInt(req.query.tenantId);
        const jobid = Number(req.params.jobid);
        const refid = req.params.refid;
        const jobsRepo = new PrimeSmsJobsRepo_1.PrimeSmsJobsRepo(tenantId);
        const jobRecipientsRepo = new PrimeSmsJobRecipientsRepo_1.PrimeSmsJobRecipientsRepo(tenantId);
        const result = await new SmsJobsService_1.SmsJobsService(jobsRepo, jobRecipientsRepo).retryFailedTransaction(tenantId, jobid, refid);
        res.status(200).json({ status: result.status === "success" ? 'success' : 'failed', message: result.message || 'Transaction retry initiated.' });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
}
