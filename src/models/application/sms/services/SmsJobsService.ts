import { PrimeSmsJobsRepo } from '../repositories/PrimeSmsJobsRepo';
import { CreateSmsJobDto } from '../dtos/CreateSmsJobDto';

function mapJobDtoToDb(dto: any) {
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

export class SmsJobsService {
     constructor(private jobsRepo: PrimeSmsJobsRepo) { }

     async createJob(dto: CreateSmsJobDto) {
          return this.jobsRepo.create(mapJobDtoToDb(dto));
     }

     async getJobById(jobId: number) {
          return this.jobsRepo.findById(jobId);
     }

     async updateJob(jobId: number, dto: Partial<CreateSmsJobDto>) {
          return this.jobsRepo.update(jobId, mapJobDtoToDb(dto));
     }

     async deleteJob(jobId: number) {
          return this.jobsRepo.delete(jobId);
     }
}
