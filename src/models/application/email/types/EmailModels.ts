import { EmailProviderType } from '../constants/EmailProviderType';
import { EmailStatus } from '../constants/EmailStatus';
import { EmailTemplateCategory } from '../constants/EmailTemplateCategory';
import { EmailAttachmentDto } from '../dtos/CreateEmailJobDto';

export interface EmailTemplateRecord {
     id?: number;
     name: string;
     category: EmailTemplateCategory;
     subject: string;
     html_body: string;
     plain_text_body: string;
     variables_json: string;
     status: 'active' | 'archived';
     created_by?: number | null;
     updated_by?: number | null;
     created_at?: Date;
     updated_at?: Date;
}

export interface EmailProviderRecord {
     id?: number;
     name: string;
     provider_type: EmailProviderType;
     host: string;
     port: number;
     secure: boolean;
     username: string;
     password: string;
     from_email: string;
     from_name: string;
     is_default: boolean;
     is_active: boolean;
     created_by?: number | null;
     updated_by?: number | null;
     created_at?: Date;
     updated_at?: Date;
}

export interface EmailSettingsRecord {
     id?: number;
     default_provider_id?: number | null;
     max_attachment_size_mb: number;
     max_retries: number;
     retry_backoff_minutes_json: string;
     allow_marketing_emails: boolean;
     updated_by?: number | null;
     created_at?: Date;
     updated_at?: Date;
}

export interface EmailQueueRecord {
     id?: number;
     template_id?: number | null;
     provider_id?: number | null;
     status: EmailStatus;
     priority: 'low' | 'normal' | 'high';
     recipients_json: string;
     cc_json: string;
     bcc_json: string;
     subject: string;
     html_body: string;
     plain_text_body: string;
     variables_json: string;
     attachments_json: string;
     scheduled_at?: Date | null;
     sent_at?: Date | null;
     failure_reason?: string | null;
     retry_count: number;
     next_retry_at?: Date | null;
     reference_type?: string | null;
     reference_id?: string | null;
     provider_message_id?: string | null;
     created_by?: number | null;
     created_at?: Date;
     updated_at?: Date;
}

export interface EmailLogRecord {
     id?: number;
     queue_id: number;
     provider_id?: number | null;
     status: EmailStatus;
     recipients_json: string;
     subject: string;
     response_payload_json?: string | null;
     failure_reason?: string | null;
     duration_ms?: number | null;
     created_at?: Date;
}

export interface RenderedEmailTemplate {
     subject: string;
     htmlBody: string;
     plainTextBody: string;
}

export interface EmailDispatchResult {
     success: boolean;
     providerMessageId?: string;
     responsePayload?: Record<string, unknown>;
     failureReason?: string;
}

export interface ResolvedEmailJob {
     queueId: number;
     /** null when dispatching through the .env fallback sender (facility has no provider of its own). */
     providerId: number | null;
     fromEmail: string;
     fromName: string;
     to: string[];
     cc: string[];
     bcc: string[];
     subject: string;
     htmlBody: string;
     plainTextBody: string;
     attachments: EmailAttachmentDto[];
}
