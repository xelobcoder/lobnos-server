import { PrimeSmsTemplatesRepo } from '../repositories/PrimeSmsTemplatesRepo';
import { CreateSmsTemplateDto } from '../dtos/CreateSmsTemplateDto';

function mapTemplateDtoToDb(dto: any) {
     return {
          name: dto.name,
          body: dto.body,
          category: dto.category,
          createdby: dto.createdBy,
     };
}

export class SmsTemplatesService {
     constructor(private templatesRepo: PrimeSmsTemplatesRepo) { }

     async createTemplate(dto: CreateSmsTemplateDto) {
          return this.templatesRepo.create(mapTemplateDtoToDb(dto));
     }

     async getTemplateById(id: number) {
          return this.templatesRepo.findById(id);
     }

     async updateTemplate(id: number, dto: Partial<CreateSmsTemplateDto>) {
          return this.templatesRepo.update(id, mapTemplateDtoToDb(dto));
     }

     async deleteTemplate(id: number) {
          return this.templatesRepo.delete(id);
     }

     async getAllTemplates() {
          return this.templatesRepo.findAll();
     }

     async getAllTemplatesPaginated(page: number, count: number) {
          return this.templatesRepo.findAllPaginated(page, count);
     }
}
