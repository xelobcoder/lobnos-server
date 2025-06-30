"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsJobRecipientsService = void 0;
function mapJobRecipientDtoToDb(dto) {
    var _a;
    return {
        jobid: dto.jobId,
        phonee164: dto.phoneE164,
        personalizedbody: dto.personalizedBody,
        deliverystatus: dto.deliveryStatus,
        sentat: dto.sentAt,
        errorcode: dto.errorCode,
        refid: (_a = dto.refId) !== null && _a !== void 0 ? _a : dto.refid,
    };
}
class SmsJobRecipientsService {
    constructor(recipientsRepo) {
        this.recipientsRepo = recipientsRepo;
    }
    async createRecipient(dto) {
        return this.recipientsRepo.create(mapJobRecipientDtoToDb(dto));
    }
    async getRecipientById(id) {
        return this.recipientsRepo.findById(id);
    }
    async updateRecipient(id, dto) {
        return this.recipientsRepo.update(id, mapJobRecipientDtoToDb(dto));
    }
    async deleteRecipient(id) {
        return this.recipientsRepo.delete(id);
    }
    async getAllByJob(jobId, page = 1, count = 20) {
        return this.recipientsRepo.findAllByJobPaginated(jobId, page, count);
    }
}
exports.SmsJobRecipientsService = SmsJobRecipientsService;
