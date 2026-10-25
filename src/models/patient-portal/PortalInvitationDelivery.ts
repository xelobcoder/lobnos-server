import { Knex } from 'knex';
import { configuration } from '../../hooks/configuration';
import { systemConfigConnection } from '../../database/connection';
import { MODULE_CONFIG_TABLE, validateModuleConfiguration } from '../Tenancy/FacilityModules';
import { EmailProvidersRepo } from '../application/email/repositories/EmailProvidersRepo';
import { ProviderFactory } from '../application/email/services/ProviderFactory';
import { SmsService } from '../application/integrations/Arkesel';
import { SmsProviderSettingsRepo } from '../application/sms/repositories/SmsProviderSettingsRepo';
import { SmsProviderSettingsService } from '../application/sms/services/SmsProviderSettingsService';

export type InvitationChannel = 'email' | 'sms' | 'link';
export type InvitationAvailability = Record<'email' | 'sms', { available: boolean; reason: string | null }>;
export interface InvitationDelivery {
     channel: InvitationChannel;
     status: 'accepted' | 'failed' | 'not_requested';
     reason: string | null;
}

export function patientInvitationAvailability(base: InvitationAvailability, patient: any, blocked?: string | null): InvitationAvailability {
     const emailReason = blocked || (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patient.email || '').trim()) ? 'A valid patient email address is required' : base.email.reason);
     const smsReason = blocked || (!invitationPhone(patient.mobile_number) ? 'A valid patient mobile number is required' : base.sms.reason);
     return { email: { available: !emailReason, reason: emailReason || null }, sms: { available: !smsReason, reason: smsReason || null } };
}

/** Match the facility SMS provider's supported Ghanaian formats, without allowing arbitrary text. */
export function invitationPhone(value: unknown): string | null {
     const input = String(value || '').trim();
     if (!/^\+?[\d ()-]+$/.test(input)) return null;
     let digits = input.replace(/\D/g, '');
     if (digits.startsWith('00')) digits = digits.slice(2);
     if (/^233\d{9}$/.test(digits)) digits = `0${digits.slice(3)}`;
     if (/^\d{9}$/.test(digits)) digits = `0${digits}`;
     return /^0\d{9}$/.test(digits) ? digits : null;
}

/** Invitation delivery is synchronous provider acceptance, not confirmed handset/inbox delivery. */
export class PortalInvitationDelivery {
     constructor(private readonly tenantId: number, private readonly audience: 'patient' | 'practitioner' = 'patient') { }

     async availability(db: Knex, patient: any, baseUrl: string): Promise<InvitationAvailability> {
          const result: InvitationAvailability = {
               email: { available: false, reason: null }, sms: { available: false, reason: null },
          };
          let urlValid = false;
          try { urlValid = ['http:', 'https:'].includes(new URL(baseUrl).protocol); } catch { /* unavailable */ }
          if (!urlValid) {
               for (const channel of ['email', 'sms'] as const) result[channel].reason = 'The public patient portal URL is not configured';
               return result;
          }
          // Match facilityModuleAccess. SMS needs platform authorization AND facility activation.
          let emailEnabled = false, smsEnabled = false;
          try {
               const settings = await db('applicationsettings').where({ keyid: 1 }).first();
               const local = settings?.moduleConfiguration
                    ? validateModuleConfiguration(JSON.parse(settings.moduleConfiguration)) : null;
               emailEnabled = !settings?.moduleConfiguration || !!local?.modules.email.enabled;
               smsEnabled = Number(settings?.smsActivated) === 1;
               if (configuration.isMultiTenant) {
                    const row = await systemConfigConnection(MODULE_CONFIG_TABLE).where({ tenant_id: this.tenantId }).first('configuration');
                    const platform = row ? validateModuleConfiguration(JSON.parse(row.configuration)) : null;
                    smsEnabled = smsEnabled && !!platform?.modules.sms.enabled;
               } else if (settings?.moduleConfiguration) smsEnabled = smsEnabled && !!local?.modules.sms.enabled;
          } catch {
               result.email.reason = result.sms.reason = 'Facility communication authorization could not be verified';
               return result;
          }
          result.email.reason = !emailEnabled ? 'Email is not enabled for this facility' : null;
          result.sms.reason = !smsEnabled ? 'SMS is not authorized and activated for this facility' : null;
          await Promise.all((['email', 'sms'] as const).map(async channel => {
               if (result[channel].reason) return;
               try {
                    if (channel === 'email') {
                         const provider = await new EmailProvidersRepo(this.tenantId).findDefault();
                         if (!provider?.id || provider.provider_type !== 'smtp' || !provider.host?.trim() ||
                              !Number.isInteger(Number(provider.port)) || Number(provider.port) <= 0 ||
                              !provider.username?.trim() || !provider.password ||
                              !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(provider.from_email || '')) {
                              result.email.reason = 'Email delivery is not configured for this facility';
                         }
                    } else {
                         const config = await new SmsProviderSettingsService(new SmsProviderSettingsRepo(this.tenantId)).getActiveConfiguration();
                         if (!config.apiKey || !config.defaultSender || !config.baseUrl) throw new Error('Incomplete configuration');
                    }
               } catch { result[channel].reason = `${channel === 'email' ? 'Email' : 'SMS'} delivery is not configured or is disabled for this facility`; }
               result[channel].available = !result[channel].reason;
          }));
          return patient ? patientInvitationAvailability(result, patient) : result;
     }

     async send(channel: 'email' | 'sms', patient: any, link: string, expiresAt: Date): Promise<InvitationDelivery> {
          const audience = this.audience;
          try {
               if (channel === 'email') {
                    const provider = await new EmailProvidersRepo(this.tenantId).findDefault();
                    if (!provider?.id) throw new Error('Unavailable');
                    const text = `You have been invited to the ${audience} portal. Activate your account: ${link} (expires ${expiresAt.toUTCString()}, single use).`;
                    const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const result = await new ProviderFactory().create(provider).send({
                         queueId: 0, providerId: provider.id, fromEmail: provider.from_email, fromName: provider.from_name,
                         to: [String(patient.email).trim()], cc: [], bcc: [], subject: `Your ${audience} portal invitation`,
                         htmlBody: `<p>You have been invited to access the ${audience} portal.</p><p><a href="${safeLink}">Activate your ${audience} portal account</a></p><p>This link expires on ${expiresAt.toUTCString()} and can only be used once.</p>`,
                         plainTextBody: text, attachments: [],
                    });
                    if (!result.success) throw new Error('Rejected');
               } else {
                    const phone = invitationPhone(patient.mobile_number);
                    if (!phone) throw new Error('Invalid recipient');
                    const result = await new SmsService(this.tenantId).sendSms([phone],
                         `Your ${audience} portal invitation: ${link} Expires ${expiresAt.toUTCString()}. Single use; keep this link private.`);
                    if (result.status !== 'success') throw new Error('Rejected');
               }
               return { channel, status: 'accepted', reason: null };
          } catch {
               // Never expose/log provider errors: they can contain destinations, payloads or credentials.
               return { channel, status: 'failed', reason: `${channel === 'email' ? 'Email' : 'SMS'} could not be sent. Provider acceptance was not confirmed. Copy the new link securely or retry after the cooldown.` };
          }
     }
}
