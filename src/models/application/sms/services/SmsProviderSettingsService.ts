import { SmsProviderSettingsDto } from '../dtos/SmsProviderSettingsDto';
import { SmsProviderSettingsRepo } from '../repositories/SmsProviderSettingsRepo';
import { SmsProviderConfiguration } from '../types/SmsProviderModels';

export class SmsProviderSettingsService {
     constructor(private repo: SmsProviderSettingsRepo) { }

     async getForAdministration() {
          const settings = await this.repo.find();
          if (!settings) return { configured: false };
          return {
               configured: true,
               providerType: settings.provider_type,
               apiKey: this.maskSecret(settings.api_key),
               senderId: settings.sender_id,
               baseUrl: settings.base_url,
               isActive: Boolean(settings.is_active),
               updatedBy: settings.updated_by,
               updatedAt: settings.updated_at,
          };
     }

     async save(dto: SmsProviderSettingsDto, updatedBy: number): Promise<void> {
          const current = await this.repo.find();
          const apiKey = dto.apiKey?.trim() || current?.api_key;
          if (!apiKey) throw new Error('SMS API key is required when configuring a provider');
          await this.repo.save({
               provider_type: dto.providerType,
               api_key: apiKey,
               sender_id: dto.senderId,
               base_url: dto.baseUrl.replace(/\/+$/, ''),
               is_active: dto.isActive,
               updated_by: updatedBy,
          });
     }

     async getActiveConfiguration(): Promise<SmsProviderConfiguration> {
          const settings = await this.repo.find();
          if (!settings) throw new Error('SMS provider is not configured for this facility');
          if (!settings.is_active) throw new Error('SMS provider is disabled for this facility');
          return {
               apiKey: settings.api_key,
               defaultSender: settings.sender_id,
               baseUrl: settings.base_url.replace(/\/+$/, ''),
          };
     }

     private maskSecret(secret: string): string {
          if (secret.length <= 4) return '*'.repeat(secret.length);
          return `${'*'.repeat(Math.min(12, secret.length - 4))}${secret.slice(-4)}`;
     }
}
