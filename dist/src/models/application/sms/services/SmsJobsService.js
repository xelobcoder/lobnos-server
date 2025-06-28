"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobsService = void 0;
function mapJobDtoToDb(dto) {
    return {
        templateid: dto.templateId,
        category: dto.category,
        recipientscope: dto.recipientScope,
        targetids: dto.targetIds,
        sendtype: dto.sendType,
        scheduledat: dto.scheduledAt,
        status: dto.status,
        createdby: dto.createdBy,
    };
}
class SmsJobsService {
    constructor(jobsRepo) {
        this.jobsRepo = jobsRepo;
    }
    async createJob(dto) {
        return this.jobsRepo.create(mapJobDtoToDb(dto));
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
}
exports.SmsJobsService = SmsJobsService;
