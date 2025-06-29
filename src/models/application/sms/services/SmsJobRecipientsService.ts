import { PrimeSmsJobRecipientsRepo } from '../repositories/PrimeSmsJobRecipientsRepo';
import { CreateSmsJobRecipientDto } from '../dtos/CreateSmsJobRecipientDto';

function mapJobRecipientDtoToDb(dto: any) {
     return {
          jobid: dto.jobId,
          phonee164: dto.phoneE164,
          personalizedbody: dto.personalizedBody,
          deliverystatus: dto.deliveryStatus,
          sentat: dto.sentAt,
          errorcode: dto.errorCode,
     };
}

export class SmsJobRecipientsService {
     constructor(private recipientsRepo: PrimeSmsJobRecipientsRepo) { }

     async createRecipient(dto: CreateSmsJobRecipientDto) {
          return this.recipientsRepo.create(mapJobRecipientDtoToDb(dto));
     }

     async getRecipientById(id: number) {
          return this.recipientsRepo.findById(id);
     }

     async updateRecipient(id: number, dto: Partial<CreateSmsJobRecipientDto>) {
          return this.recipientsRepo.update(id, mapJobRecipientDtoToDb(dto));
     }

     async deleteRecipient(id: number) {
          return this.recipientsRepo.delete(id);
     }

     async getAllByJob(jobId: number, page: number = 1, count: number = 20) {
          return this.recipientsRepo.findAllByJobPaginated(jobId, page, count);
     }
}
