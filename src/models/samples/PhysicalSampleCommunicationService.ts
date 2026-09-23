import KnexConnection from '../../database/KnexConnections';
import { EmailLogsRepo } from '../application/email/repositories/EmailLogsRepo';
import { EmailProvidersRepo } from '../application/email/repositories/EmailProvidersRepo';
import { EmailQueueRepo } from '../application/email/repositories/EmailQueueRepo';
import { EmailSettingsRepo } from '../application/email/repositories/EmailSettingsRepo';
import { EmailTemplatesRepo } from '../application/email/repositories/EmailTemplatesRepo';
import { EmailQueueService } from '../application/email/services/EmailQueueService';
import { ProviderFactory } from '../application/email/services/ProviderFactory';
import { TemplateRenderer } from '../application/email/services/TemplateRenderer';
import { PrimeSmsJobsRepo } from '../application/sms/repositories/PrimeSmsJobsRepo';
import { PrimeSmsJobRecipientsRepo } from '../application/sms/repositories/PrimeSmsJobRecipientsRepo';
import { SmsJobsService } from '../application/sms/services/SmsJobsService';

export type SampleCommunicationChannel = 'sms' | 'email';

export class PhysicalSampleCommunicationService {
     constructor(private readonly tenantId: number) { }

     async dispatch(communicationId: number): Promise<void> {
          const connection = await KnexConnection(this.tenantId);
          const communication = await connection('physical_sample_communications as communication')
               .join('physical_samples as sample', 'sample.id', 'communication.sample_id')
               .join('new_patients as patient', 'patient.patientid', 'communication.patientid')
               .select('communication.*', 'sample.sample_uid', 'patient.email', 'patient.mobile_number')
               .where('communication.id', communicationId)
               .first();
          if (!communication) throw new Error('Sample communication not found');
          const channels = this.channelsOf(communication.requested_channels);
          if (!channels.length) {
               await connection('physical_sample_communications').where({ id: communicationId }).update({ status: 'none', updated_at: new Date() });
               return;
          }

          for (const channel of channels) {
               await this.dispatchChannel(connection, communication, channel);
          }
          const attempts = await connection('physical_sample_delivery_attempts').where({ communication_id: communicationId });
          const failed = attempts.filter((attempt: any) => attempt.status === 'failed').length;
          const queued = attempts.filter((attempt: any) => ['queued', 'sent'].includes(attempt.status)).length;
          const status = queued === attempts.length ? 'queued' : failed === attempts.length ? 'failed' : 'partial';
          await connection('physical_sample_communications').where({ id: communicationId }).update({ status, updated_at: new Date() });
     }

     async list(sampleId: number): Promise<any[]> {
          const connection = await KnexConnection(this.tenantId);
          const communications = await connection('physical_sample_communications').where({ sample_id: sampleId }).orderBy('created_at', 'desc');
          if (!communications.length) return [];
          const attempts = await connection('physical_sample_delivery_attempts').whereIn('communication_id', communications.map((item: any) => item.id)).orderBy('created_at');
          for (const attempt of attempts) {
               let status = attempt.status;
               let failureReason = attempt.failure_reason;
               let providerMessageId = attempt.provider_message_id;
               if (attempt.email_queue_id) {
                    const email = await new EmailQueueRepo(this.tenantId).findById(Number(attempt.email_queue_id));
                    status = email?.status === 'sent' ? 'sent' : ['failed', 'cancelled'].includes(String(email?.status)) ? 'failed' : 'queued';
                    failureReason = email?.failure_reason || failureReason;
                    providerMessageId = email?.provider_message_id || providerMessageId;
               } else if (attempt.sms_recipient_id) {
                    const sms = await new PrimeSmsJobRecipientsRepo(this.tenantId).findById(Number(attempt.sms_recipient_id));
                    status = sms?.deliverystatus === 'sent' ? 'sent' : sms?.deliverystatus === 'failed' ? 'failed' : 'queued';
                    failureReason = sms?.errorcode || failureReason;
                    providerMessageId = sms?.messageid || providerMessageId;
               }
               if (status !== attempt.status || failureReason !== attempt.failure_reason || providerMessageId !== attempt.provider_message_id) {
                    await connection('physical_sample_delivery_attempts').where({ id: attempt.id }).update({ status, failure_reason: failureReason || null, provider_message_id: providerMessageId || null });
                    Object.assign(attempt, { status, failure_reason: failureReason || null, provider_message_id: providerMessageId || null });
               }
          }
          const result = [];
          for (const item of communications) {
               const itemAttempts = attempts.filter((attempt: any) => Number(attempt.communication_id) === Number(item.id));
               const statuses = itemAttempts.map((attempt: any) => attempt.status);
               const currentStatus = statuses.length === 0 ? item.status : statuses.every((status: string) => status === 'sent') ? 'sent' : statuses.every((status: string) => status === 'failed') ? 'failed' : statuses.some((status: string) => status === 'failed') ? 'partial' : 'queued';
               if (currentStatus !== item.status) await connection('physical_sample_communications').where({ id: item.id }).update({ status: currentStatus, updated_at: new Date() });
               result.push({ ...item, status: currentStatus, requested_channels: this.channelsOf(item.requested_channels), attempts: itemAttempts });
          }
          return result;
     }

     private async dispatchChannel(connection: any, communication: any, channel: SampleCommunicationChannel): Promise<void> {
          const previous = await connection('physical_sample_delivery_attempts').where({ communication_id: communication.id, channel }).count('* as count').first();
          const attemptNumber = Number(previous?.count || 0) + 1;
          const [attemptId] = await connection('physical_sample_delivery_attempts').insert({ communication_id: communication.id, channel, attempt_number: attemptNumber, status: 'pending', created_at: new Date() });
          try {
               if (channel === 'sms') {
                    if (!communication.mobile_number) throw new Error('Patient has no mobile number');
                    const jobsRepo = new PrimeSmsJobsRepo(this.tenantId);
                    const recipientsRepo = new PrimeSmsJobRecipientsRepo(this.tenantId);
                    const jobId = await new SmsJobsService(jobsRepo, recipientsRepo).createJob({
                         customBody: communication.message,
                         category: 'patient',
                         recipientScope: 'single',
                         targetIds: [{ id: communication.patientid, phone: String(communication.mobile_number) }],
                         sendType: 'immediate',
                         createdBy: Number(communication.requested_by),
                    }, this.tenantId);
                    const recipients = await recipientsRepo.findAllByJob(jobId);
                    await connection('physical_sample_delivery_attempts').where({ id: attemptId }).update({ status: 'queued', recipient_masked: this.maskPhone(communication.mobile_number), sms_job_id: jobId, sms_recipient_id: recipients[0]?.recid || null, attempted_at: new Date() });
               } else {
                    if (!communication.email) throw new Error('Patient has no email address');
                    const queueRepo = new EmailQueueRepo(this.tenantId);
                    const service = new EmailQueueService(
                         queueRepo,
                         new EmailLogsRepo(this.tenantId),
                         new EmailTemplatesRepo(this.tenantId),
                         new EmailProvidersRepo(this.tenantId),
                         new EmailSettingsRepo(this.tenantId),
                         new ProviderFactory(),
                         new TemplateRenderer(),
                    );
                    const queued = await service.queueEmail({
                         to: [communication.email], cc: [], bcc: [], attachments: [], variables: {},
                         subject: `Sample ${communication.sample_uid} requires attention`,
                         htmlBody: `<p>${this.escapeHtml(communication.message)}</p>`,
                         plainTextBody: communication.message,
                         priority: 'high', referenceType: 'physical_sample', referenceId: String(communication.sample_id), createdBy: Number(communication.requested_by),
                    });
                    await connection('physical_sample_delivery_attempts').where({ id: attemptId }).update({ status: 'queued', recipient_masked: this.maskEmail(communication.email), email_queue_id: queued?.id || null, attempted_at: new Date() });
               }
          } catch (error: any) {
               await connection('physical_sample_delivery_attempts').where({ id: attemptId }).update({ status: 'failed', failure_reason: error?.message || String(error), attempted_at: new Date() });
          }
     }

     private channelsOf(value: unknown): SampleCommunicationChannel[] {
          if (Array.isArray(value)) return value.filter((item): item is SampleCommunicationChannel => item === 'sms' || item === 'email');
          try { return this.channelsOf(JSON.parse(String(value || '[]'))); } catch { return []; }
     }

     private maskPhone(value: string): string { const text = String(value); return `${'*'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`; }
     private maskEmail(value: string): string { const [name, domain] = String(value).split('@'); return `${name?.slice(0, 2) || '*'}***@${domain || 'unknown'}`; }
     private escapeHtml(value: string): string { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char)); }
}
