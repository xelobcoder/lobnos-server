import { CreateEmailTemplateDto } from '../dtos/CreateEmailTemplateDto';
import { EmailTemplatesRepo } from '../repositories/EmailTemplatesRepo';
import { TemplateRenderer } from './TemplateRenderer';

function mapTemplateDto(dto: CreateEmailTemplateDto) {
     return {
          name: dto.name,
          category: dto.category,
          subject: dto.subject,
          html_body: dto.htmlBody,
          plain_text_body: dto.plainTextBody,
          variables_json: JSON.stringify(dto.variables),
          status: dto.status,
          created_by: dto.createdBy ?? null,
          updated_by: dto.updatedBy ?? null,
     };
}

export class EmailTemplatesService {
     constructor(
          private templatesRepo: EmailTemplatesRepo,
          private templateRenderer: TemplateRenderer,
     ) { }

     async create(dto: CreateEmailTemplateDto) {
          return this.templatesRepo.create(mapTemplateDto(dto));
     }

     async update(id: number, dto: Partial<CreateEmailTemplateDto>) {
          const payload = {
               ...(dto.name !== undefined ? { name: dto.name } : {}),
               ...(dto.category !== undefined ? { category: dto.category } : {}),
               ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
               ...(dto.htmlBody !== undefined ? { html_body: dto.htmlBody } : {}),
               ...(dto.plainTextBody !== undefined ? { plain_text_body: dto.plainTextBody } : {}),
               ...(dto.variables !== undefined ? { variables_json: JSON.stringify(dto.variables) } : {}),
               ...(dto.status !== undefined ? { status: dto.status } : {}),
               ...(dto.updatedBy !== undefined ? { updated_by: dto.updatedBy } : {}),
          };

          return this.templatesRepo.update(id, payload);
     }

     async getById(id: number) {
          return this.templatesRepo.findById(id);
     }

     async getAll() {
          return this.templatesRepo.findAll();
     }

     async delete(id: number) {
          return this.templatesRepo.delete(id);
     }

     async preview(id: number, variables: Record<string, unknown>) {
          const template = await this.templatesRepo.findById(id);
          if (!template) {
               throw new Error('Template not found');
          }

          return this.templateRenderer.render(
               template.subject,
               template.html_body,
               template.plain_text_body,
               variables,
          );
     }
}
