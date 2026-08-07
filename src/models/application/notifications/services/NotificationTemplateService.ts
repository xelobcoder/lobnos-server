import { CreateNotificationTemplateDto, UpdateNotificationTemplateDto } from '../dtos/NotificationDtos';
import { NotificationEventsRepo } from '../repositories/NotificationEventsRepo';
import { NotificationTemplatesRepo } from '../repositories/NotificationTemplatesRepo';
import { NotificationTemplateVersionsRepo } from '../repositories/NotificationTemplateVersionsRepo';
import { NotificationTemplateRenderer } from './NotificationTemplateRenderer';

export class NotificationTemplateService {
     constructor(
          private eventsRepo: NotificationEventsRepo,
          private templatesRepo: NotificationTemplatesRepo,
          private versionsRepo: NotificationTemplateVersionsRepo,
          private renderer: NotificationTemplateRenderer,
          private tenantId: number,
     ) { }

     async getTemplates() {
          return this.templatesRepo.findAll();
     }

     async getTemplateById(id: number) {
          return this.templatesRepo.findById(id);
     }

     async createTemplate(dto: CreateNotificationTemplateDto) {
          const event = await this.eventsRepo.findByCode(dto.eventCode);
          if (!event) throw new Error('Notification event not found');

          const templateId = await this.templatesRepo.create({
               event_id: event.id as number,
               template_name: dto.templateName,
               subject: dto.subject,
               html_body: dto.htmlBody || null,
               plain_body: dto.plainBody || null,
               is_system: false,
               is_default: dto.isDefault,
               is_active: dto.isActive,
               created_by: dto.createdBy ?? null,
               updated_by: dto.createdBy ?? null,
          });

          await this.versionsRepo.create({
               template_id: templateId,
               version: 1,
               subject: dto.subject,
               html_body: dto.htmlBody || null,
               plain_body: dto.plainBody || null,
               changed_by: dto.createdBy ?? null,
          });

          return this.templatesRepo.findById(templateId);
     }

     async updateTemplate(id: number, dto: UpdateNotificationTemplateDto) {
          const current = await this.templatesRepo.findById(id);
          if (!current) throw new Error('Template not found');

          const payload = {
               ...(dto.templateName !== undefined ? { template_name: dto.templateName } : {}),
               ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
               ...(dto.htmlBody !== undefined ? { html_body: dto.htmlBody } : {}),
               ...(dto.plainBody !== undefined ? { plain_body: dto.plainBody } : {}),
               ...(dto.isDefault !== undefined ? { is_default: dto.isDefault } : {}),
               ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
               ...(dto.updatedBy !== undefined ? { updated_by: dto.updatedBy } : {}),
          };

          await this.templatesRepo.update(id, payload);

          const version = (await this.versionsRepo.findLatestVersion(id)) + 1;
          await this.versionsRepo.create({
               template_id: id,
               version,
               subject: dto.subject ?? current.subject,
               html_body: dto.htmlBody ?? current.html_body ?? null,
               plain_body: dto.plainBody ?? current.plain_body ?? null,
               changed_by: dto.updatedBy ?? null,
          });

          return this.templatesRepo.findById(id);
     }

     async deleteTemplate(id: number) {
          return this.templatesRepo.delete(id);
     }

     async previewTemplate(id: number, variables: Record<string, unknown>) {
          const template = await this.templatesRepo.findById(id);
          if (!template) throw new Error('Template not found');

          return this.renderer.render(
               template.subject,
               template.html_body || '',
               template.plain_body || '',
               variables,
          );
     }

     async getTemplateVersions(id: number) {
          return this.versionsRepo.findAllByTemplate(id);
     }
}
