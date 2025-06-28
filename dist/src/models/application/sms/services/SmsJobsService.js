"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobsService = void 0;
const KnexConnections_1 = __importDefault(require("../../../../database/KnexConnections"));
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
            console.log(dto);
            console.log(mapJobDtoToDb(dto));
            const transaction = await (0, KnexConnections_1.default)(tenantId);
            const trx = await transaction.transaction();
            const jobId = await this.jobsRepo.create(mapJobDtoToDb(dto), trx);
            if (dto.recipientScope !== 'all' && dto.targetIds) {
                // Assume targetIds is an array for 'multiple', or a single value for 'single'
                const targets = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
                // Validate phone numbers (simple E.164 regex, can be improved)
                const validPhone = (phone) => /^\+?\d{7,15}$/.test(phone);
                const recipients = targets
                    .filter((target) => target.phone && validPhone(target.phone))
                    .map((target) => ({
                    phonee164: target.phone,
                    personalizedbody: '',
                    refid: target.id
                }));
                if (recipients.length !== targets.length) {
                    throw new Error('One or more recipient phone numbers are invalid.');
                }
                await this.jobRecipientsRepo.bulkInsert(jobId, recipients, trx);
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
