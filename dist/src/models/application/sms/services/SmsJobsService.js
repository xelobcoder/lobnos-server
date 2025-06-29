"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobsService = void 0;
const PrimeSmsJobRecipientsRepo_1 = require("../repositories/PrimeSmsJobRecipientsRepo");
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const SmsMessageParser_1 = require("../PrimeSms/SmsMessageParser");
const Arkesel_1 = require("../../integrations/Arkesel");
function mapJobDtoToDb(dto) {
    return {
        templateid: dto.templateId,
        custombody: dto.customBody ? dto.customBody : null,
        category: dto.category,
        recipientscope: dto.recipientScope,
        targetids: dto.recipientScope === 'all' ? dto.targetIds : null,
        sendtype: dto.sendType,
        scheduledat: (typeof dto.scheduledAt === 'string' && !isNaN(Date.parse(dto.scheduledAt))) ? new Date(dto.scheduledAt) : null,
        status: dto.status ? dto.status : 'pending',
        createdby: dto.createdBy,
    };
}
class SmsJobsService {
    constructor(jobsRepo, jobRecipientsRepo) {
        this.jobsRepo = jobsRepo;
        this.jobRecipientsRepo = jobRecipientsRepo;
    }
    async createJob(dto, tenantId) {
        try {
            const transaction = await (0, KnexConnections_1.default)(tenantId);
            const trx = await transaction.transaction();
            const jobId = await this.jobsRepo.create(mapJobDtoToDb(dto), trx);
            if (dto.recipientScope !== 'all' && dto.targetIds) {
                const targets = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
                const validPhone = (phone) => /^\+?\d{7,15}$/.test(phone);
                let recipients = await Promise.all(targets
                    .filter((target) => target.phone && validPhone(target.phone))
                    .map(async (target) => {
                    const personalizedbody = await new SmsMessageParser_1.SmsMessageParser(tenantId, dto.category, target.id).humanizeTemplate(Object.assign(Object.assign({}, target), { templateid: dto.templateId }));
                    return {
                        phonee164: target.phone,
                        personalizedbody,
                        refid: target.id
                    };
                }));
                if (recipients.length !== targets.length) {
                    throw new Error('One or more recipient phone numbers are invalid.');
                }
                this.jobRecipientsRepo = this.jobRecipientsRepo || new PrimeSmsJobRecipientsRepo_1.PrimeSmsJobRecipientsRepo(tenantId);
                if (!this.jobRecipientsRepo) {
                    throw new Error('jobRecipientsRepo is not initialized. Please ensure you pass it to the SmsJobsService constructor.');
                }
                await this.jobRecipientsRepo.bulkInsert(jobId, recipients, trx);
                await trx.commit();
                this.processJobData(jobId);
            }
            else if (dto.recipientScope === 'all') {
                await trx.commit();
            }
            return jobId;
        }
        catch (error) {
            throw new Error('Failed to create SMS job. Please try again later.');
        }
    }
    async getJobById(jobId) {
        return this.jobsRepo.findById(jobId);
    }
    async updateJob(jobId, dto) {
        return this.jobsRepo.update(jobId, mapJobDtoToDb(dto));
    }
    async deleteJob(jobId) {
        return this.jobsRepo.delete(jobId);
    }
    async getAllJobsPaginated(page, count) {
        return this.jobsRepo.findAllPaginated(page, count);
    }
    async processJobData(jobid) {
        const job = await this.jobsRepo.findById(jobid);
        if (!job) {
            return;
        }
        const { templateid, custombody, recipientscope, sendtype, scheduledat, status } = job;
        if (sendtype === 'scheduled' && scheduledat) {
            await this.processScheduledJob(job);
            return;
        }
        if (sendtype === 'immediate' && status !== 'pending') {
            const hasTemplate = templateid !== null && templateid !== undefined;
            const hasCustomBody = custombody !== null && custombody !== undefined;
            if (!hasTemplate && !hasCustomBody) {
                return;
            }
        }
        const recipients = await this.jobRecipientsRepo.findAllByJob(jobid);
        if (job.recipientscope === 'all') {
            await this.processBatchJob(job);
        }
        else {
            await this.processSingleOrMultipleJob(job, recipients);
        }
    }
    async processScheduledJob(job) {
        const { jobid, templateid, custombody, scheduledat } = job;
        const recipients = await this.jobRecipientsRepo.findAllByJob(jobid);
        const smsService = new Arkesel_1.SmsService();
        const numbers = recipients.map(r => r.phonee164);
        let message;
        if (custombody) {
            message = custombody;
        }
        else if (templateid && recipients.length === 1) {
            message = recipients[0].personalizedbody;
        }
        else {
            return;
        }
        try {
            const result = await smsService.scheduleSms(numbers, message, scheduledat.toISOString());
            if (result.status === 'success') {
                for (const recipient of recipients) {
                    await this.jobRecipientsRepo.update(recipient.recid, {
                        deliverystatus: 'queued'
                    });
                }
                await this.jobsRepo.update(job.jobid, { status: 'processing' });
            }
        }
        catch (err) { }
    }
    async processSingleOrMultipleJob(job, recipients) {
        const smsService = new Arkesel_1.SmsService();
        const isScheduled = job.sendtype === 'scheduled' && job.scheduledat;
        const sendOrSchedule = async (phones, message, scheduledAt) => {
            if (isScheduled && scheduledAt) {
                return await smsService.scheduleSms(phones, message, scheduledAt.toISOString());
            }
            else {
                return await smsService.sendSms(phones, message);
            }
        };
        const updateRecipient = async (recipient, status, messageid) => {
            await this.jobRecipientsRepo.update(recipient.recid, {
                deliverystatus: status,
                messageid: messageid
            });
        };
        const updateJobStatus = async (status) => {
            await this.jobsRepo.update(job.jobid, { status });
        };
        if (recipients.length === 1) {
            const recipient = recipients[0];
            let message = job.custombody || recipient.personalizedbody;
            try {
                const result = await sendOrSchedule([recipient.phonee164], message, job.scheduledat);
                if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                    await updateRecipient(recipient, isScheduled ? 'queued' : 'sent', result.data[0].id);
                    await updateJobStatus(isScheduled ? 'processing' : 'sent');
                }
            }
            catch (err) { }
        }
        else if (recipients.length > 1) {
            if (job.custombody) {
                try {
                    const numbers = recipients.map(r => r.phonee164);
                    const result = await sendOrSchedule(numbers, job.custombody, job.scheduledat);
                    if (result.status === 'success' && Array.isArray(result.data)) {
                        let allSent = true;
                        for (const recipient of recipients) {
                            const sentInfo = result.data.find((d) => d.recipient === recipient.phonee164.replace(/^\+/, ''));
                            await updateRecipient(recipient, isScheduled ? 'queued' : 'sent', sentInfo ? sentInfo.id : null);
                            if (!sentInfo)
                                allSent = false;
                        }
                        if (allSent) {
                            await updateJobStatus(isScheduled ? 'processing' : 'sent');
                        }
                    }
                }
                catch (err) { }
            }
            else if (job.templateid) {
                let allSent = true;
                for (const recipient of recipients) {
                    try {
                        const result = await sendOrSchedule([recipient.phonee164], recipient.personalizedbody, job.scheduledat);
                        if (result.status === 'success' && Array.isArray(result.data) && result.data[0]) {
                            await updateRecipient(recipient, isScheduled ? 'queued' : 'sent', result.data[0].id);
                        }
                        else {
                            allSent = false;
                        }
                    }
                    catch (err) {
                        allSent = false;
                    }
                }
                if (allSent) {
                    await updateJobStatus(isScheduled ? 'processing' : 'sent');
                }
            }
        }
    }
    async processBatchJob(job) {
        return;
    }
    async processDueScheduledJobs() {
        const now = new Date();
        const dueJobs = await this.jobsRepo.findAllDueScheduledJobs(now);
        for (const job of dueJobs) {
            const recipients = await this.jobRecipientsRepo.findAllByJob(job.jobid);
            await this.processSingleOrMultipleJob(job, recipients);
        }
    }
}
exports.SmsJobsService = SmsJobsService;
