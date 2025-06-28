import { PrimeSmsJobsRepo } from '../repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../repositories/PrimeSmsJobRecipientsRepo';
import { CreateSmsJobDto } from '../dtos/CreateSmsJobDto';
import KnexConnection from '../../../../database/KnexConnections';

function mapJobDtoToDb(dto: any) {
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

export class SmsJobsService {
     constructor(
          private jobsRepo: PrimeSmsJobsRepo,
          private jobRecipientsRepo: PrimeSmsJobRecipientsRepo
     ) { }

     async createJob(dto: CreateSmsJobDto, tenantId: number) {
          try {
               // 1. Create the job
               console.log(dto);
               console.log(mapJobDtoToDb(dto));
               const transaction = await KnexConnection(tenantId);
               const trx = await transaction.transaction();
               const jobId = await this.jobsRepo.create(mapJobDtoToDb(dto), trx);

               if (dto.recipientScope !== 'all' && dto.targetIds) {
                    // Assume targetIds is an array for 'multiple', or a single value for 'single'
                    const targets = Array.isArray(dto.targetIds) ? dto.targetIds : [dto.targetIds];
                    // Validate phone numbers (simple E.164 regex, can be improved)
                    const validPhone = (phone: string) => /^\+?\d{7,15}$/.test(phone);
                    const recipients = targets
                         .filter((target: any) => target.phone && validPhone(target.phone))
                         .map((target: any) => ({
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
          } catch (error) {
               console.error('Error creating SMS job:', error);
               throw new Error('Failed to create SMS job. Please try again later.');
          }
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

     async getAllJobsPaginated(page: number, count: number) {
          return this.jobsRepo.findAllPaginated(page, count);
     }
}
