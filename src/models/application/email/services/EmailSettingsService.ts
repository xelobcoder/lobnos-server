import { UpdateEmailSettingsDto } from '../dtos/UpdateEmailSettingsDto';
import { EmailSettingsRepo } from '../repositories/EmailSettingsRepo';

export class EmailSettingsService {
     constructor(private settingsRepo: EmailSettingsRepo) { }

     async getSettings() {
          const settings = await this.settingsRepo.get();
          if (!settings) {
               await this.settingsRepo.upsert({});
               return this.settingsRepo.get();
          }
          return settings;
     }

     async updateSettings(dto: UpdateEmailSettingsDto) {
          await this.settingsRepo.upsert({
               ...(dto.defaultProviderId !== undefined ? { default_provider_id: dto.defaultProviderId } : {}),
               ...(dto.maxAttachmentSizeMb !== undefined ? { max_attachment_size_mb: dto.maxAttachmentSizeMb } : {}),
               ...(dto.maxRetries !== undefined ? { max_retries: dto.maxRetries } : {}),
               ...(dto.retryBackoffMinutes !== undefined ? { retry_backoff_minutes_json: JSON.stringify(dto.retryBackoffMinutes) } : {}),
               ...(dto.allowMarketingEmails !== undefined ? { allow_marketing_emails: dto.allowMarketingEmails } : {}),
               ...(dto.updatedBy !== undefined ? { updated_by: dto.updatedBy } : {}),
          });
          return this.getSettings();
     }
}
