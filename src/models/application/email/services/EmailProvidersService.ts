import { CreateEmailProviderDto } from '../dtos/CreateEmailProviderDto';
import { EmailProvidersRepo } from '../repositories/EmailProvidersRepo';
import { ProviderFactory } from './ProviderFactory';
import { EmailProviderRecord } from '../types/EmailModels';

/** API shape: the password is never returned, only whether one is stored. */
export function toPublicProvider(record: EmailProviderRecord | null) {
     if (!record) return null;
     const { password, ...rest } = record;
     return { ...rest, hasPassword: Boolean(password) };
}

function mapProviderDto(dto: CreateEmailProviderDto) {
     return {
          name: dto.name,
          provider_type: dto.providerType,
          host: dto.host,
          port: dto.port,
          secure: dto.secure,
          username: dto.username,
          password: dto.password,
          from_email: dto.fromEmail,
          from_name: dto.fromName,
          is_default: dto.isDefault,
          is_active: dto.isActive,
          created_by: dto.createdBy ?? null,
          updated_by: dto.updatedBy ?? null,
     };
}

export class EmailProvidersService {
     constructor(
          private providersRepo: EmailProvidersRepo,
          private providerFactory: ProviderFactory,
     ) { }

     async create(dto: CreateEmailProviderDto) {
          return this.providersRepo.create(mapProviderDto(dto));
     }

     async update(id: number, dto: Partial<CreateEmailProviderDto>) {
          const payload = {
               ...(dto.name !== undefined ? { name: dto.name } : {}),
               ...(dto.providerType !== undefined ? { provider_type: dto.providerType } : {}),
               ...(dto.host !== undefined ? { host: dto.host } : {}),
               ...(dto.port !== undefined ? { port: dto.port } : {}),
               ...(dto.secure !== undefined ? { secure: dto.secure } : {}),
               ...(dto.username !== undefined ? { username: dto.username } : {}),
               ...(dto.password ? { password: dto.password } : {}),
               ...(dto.fromEmail !== undefined ? { from_email: dto.fromEmail } : {}),
               ...(dto.fromName !== undefined ? { from_name: dto.fromName } : {}),
               ...(dto.isDefault !== undefined ? { is_default: dto.isDefault } : {}),
               ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
               ...(dto.updatedBy !== undefined ? { updated_by: dto.updatedBy } : {}),
          };

          return this.providersRepo.update(id, payload);
     }

     async getById(id: number) {
          return toPublicProvider(await this.providersRepo.findById(id));
     }

     async getAll(page?: number, count?: number) {
          const rows = await this.providersRepo.findAll(page, count);
          return rows.map((row) => toPublicProvider(row));
     }

     async delete(id: number) {
          return this.providersRepo.delete(id);
     }

     async testProvider(id: number) {
          const provider = await this.providersRepo.findById(id);
          if (!provider) {
               throw new Error('Provider not found');
          }

          const instance = this.providerFactory.create(provider);
          return instance.testConnection();
     }

     /** Sends one real message through this facility's provider. Delivery failures are reported, not thrown. */
     async sendTestEmail(id: number, to: string) {
          const provider = await this.providersRepo.findById(id);
          if (!provider) {
               throw new Error('Provider not found');
          }

          const instance = this.providerFactory.create(provider);
          const result = await instance.send({
               queueId: 0,
               providerId: provider.id ?? null,
               fromEmail: provider.from_email,
               fromName: provider.from_name,
               to: [to],
               cc: [],
               bcc: [],
               subject: 'Prime Laboratory Software test email',
               htmlBody: '<p>This is a test email confirming your facility email settings work.</p>',
               plainTextBody: 'This is a test email confirming your facility email settings work.',
               attachments: [],
          });

          return { delivered: result.success, message: result.success ? 'Test email sent' : (result.failureReason ?? 'Test email failed') };
     }
}
