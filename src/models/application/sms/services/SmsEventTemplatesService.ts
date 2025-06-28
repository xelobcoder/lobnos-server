import { PrimeSmsEventTemplatesRepo } from '../repositories/PrimeSmsEventTemplatesRepo';
import { CreateSmsEventTemplateDto } from '../dtos/CreateSmsEventTemplateDto';

function mapEventTemplateDtoToDb(dto: any) {
     return {
          eventid: dto.eventId,
          templateid: dto.templateId,
          isactive: dto.isActive,
     };
}

export class SmsEventTemplatesService {
     constructor(private eventTemplatesRepo: PrimeSmsEventTemplatesRepo) { }

     async createEventTemplate(dto: CreateSmsEventTemplateDto) {
          return this.eventTemplatesRepo.create(mapEventTemplateDtoToDb(dto));
     }

     async getEventTemplateById(id: number) {
          return this.eventTemplatesRepo.findById(id);
     }

     async updateEventTemplate(id: number, dto: Partial<CreateSmsEventTemplateDto>) {
          return this.eventTemplatesRepo.update(id, mapEventTemplateDtoToDb(dto));
     }

     async deleteEventTemplate(id: number) {
          return this.eventTemplatesRepo.delete(id);
     }

     async getAllByEvent(eventId: number) {
          return this.eventTemplatesRepo.findAllByEvent(eventId);
     }

     async getAllByTemplate(templateId: number) {
          return this.eventTemplatesRepo.findAllByTemplate(templateId);
     }
}
