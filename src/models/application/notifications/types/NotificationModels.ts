export type NotificationRecipientType =
     | 'PATIENT'
     | 'DOCTOR'
     | 'ORGANIZATION'
     | 'STAFF'
     | 'LAB_MANAGER'
     | 'BRANCH_MANAGER'
     | 'ACCOUNTANT';

export interface NotificationEventRecord {
     id?: number;
     event_code: string;
     event_name: string;
     description?: string | null;
     module: string;
     is_system: boolean;
     is_active: boolean;
     created_at?: Date;
     updated_at?: Date;
}

export interface NotificationTemplateRecord {
     id?: number;
     tenant_id?: number | null;
     event_id: number;
     template_name: string;
     subject: string;
     html_body?: string | null;
     plain_body?: string | null;
     is_system: boolean;
     is_default: boolean;
     is_active: boolean;
     created_by?: number | null;
     updated_by?: number | null;
     created_at?: Date;
     updated_at?: Date;
}

export interface NotificationTemplateVariableRecord {
     id?: number;
     event_id: number;
     variable_name: string;
     display_name: string;
     data_type: string;
     description?: string | null;
     example_value?: string | null;
     is_required: boolean;
     created_at?: Date;
}

export interface NotificationEventSettingRecord {
     id?: number;
     tenant_id?: number | null;
     event_id: number;
     email_enabled: boolean;
     sms_enabled: boolean;
     whatsapp_enabled: boolean;
     in_app_enabled: boolean;
     default_template_id?: number | null;
     created_at?: Date;
     updated_at?: Date;
}

export interface NotificationEventRecipientRecord {
     id?: number;
     event_id: number;
     recipient_type: NotificationRecipientType;
     is_required: boolean;
     email_override?: string | null;
     is_active: boolean;
     created_at?: Date;
     updated_at?: Date;
}

export interface NotificationTemplateVersionRecord {
     id?: number;
     template_id: number;
     version: number;
     subject: string;
     html_body?: string | null;
     plain_body?: string | null;
     changed_by?: number | null;
     created_at?: Date;
}

export interface NotificationQueueRecord {
     id?: number;
     tenant_id: number;
     event_id: number;
     event_code: string;
     channel: string;
     template_id?: number | null;
     email_queue_id?: number | null;
     priority: 'low' | 'normal' | 'high';
     status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
     scheduled_at?: Date | null;
     processing_started_at?: Date | null;
     processed_at?: Date | null;
     attempts: number;
     max_attempts: number;
     last_error?: string | null;
     payload_json?: string | null;
     created_by?: number | null;
     created_at?: Date;
     updated_at?: Date;
}
