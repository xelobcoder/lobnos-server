"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobsService = void 0;
const PrimeSmsJobRecipientsRepo_1 = require("../repositories/PrimeSmsJobRecipientsRepo");
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
const SmsMessageParser_1 = require("../PrimeSms/SmsMessageParser");
function mapJobDtoToDb(dto) {
    return {
        templateid: dto.templateId,
        custombody: dto.customBody ? dto.customBody : null,
        category: dto.category,
        recipientscope: dto.recipientScope,
        targetids: dto.recipientScope === 'all' ? dto.targetIds : null,
        sendtype: dto.sendType,
        scheduledat: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
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
            // 1. Create the job
            const transaction = await (0, KnexConnections_1.default)(tenantId);
            const trx = await transaction.transaction();
            const jobId = await this.jobsRepo.create(mapJobDtoToDb(dto), trx);
            if (dto.recipientScope !== 'all' && dto.targetIds) {
                // Assume targetIds is an array for 'multiple', or a single value for 'single'
                const targets = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
                // Validate phone numbers (simple E.164 regex, can be improved)
                const validPhone = (phone) => /^\+?\d{7,15}$/.test(phone);
                let recipients = await Promise.all(targets
                    .filter((target) => target.phone && validPhone(target.phone))
                    .map(async (target) => {
                    // Use template or customBody for parsing
                    let template = dto.customBody || '';
                    // If you want to support templateId, you would fetch the template here
                    // For now, just use customBody
                    const personalizedbody = await new SmsMessageParser_1.SmsMessageParser(tenantId, dto.category, target.refid).humanizeTemplate(Object.assign(Object.assign({}, target), { templateid: dto.templateId }));
                    return {
                        phonee164: target.phone,
                        personalizedbody,
                        refid: target.refid
                    };
                }));
                console.log(recipients);
                if (recipients.length !== targets.length) {
                    throw new Error('One or more recipient phone numbers are invalid.');
                }
                this.jobRecipientsRepo = this.jobRecipientsRepo || new PrimeSmsJobRecipientsRepo_1.PrimeSmsJobRecipientsRepo(tenantId);
                if (!this.jobRecipientsRepo) {
                    throw new Error('jobRecipientsRepo is not initialized. Please ensure you pass it to the SmsJobsService constructor.');
                }
                await this.jobRecipientsRepo.bulkInsert(jobId, recipients, trx);
                await trx.commit();
            }
            else if (dto.recipientScope === 'all') {
                // For 'all', we assume targetIds is not used and no recipients are created
                await trx.commit();
            }
            return jobId;
        }
        catch (error) {
            console.error('Error creating SMS job:', error);
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
}
exports.SmsJobsService = SmsJobsService;
