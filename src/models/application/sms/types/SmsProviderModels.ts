export interface SmsProviderRecord {
     id: number;
     provider_type: 'arkesel';
     api_key: string;
     sender_id: string;
     base_url: string;
     is_active: boolean;
     updated_by: number | null;
     webhook_secret?: string | null;
     require_signed_webhooks?: boolean;
     sandbox?: boolean;
     paused_reason?: string | null;
     low_credit_threshold?: number;
     created_at?: Date;
     updated_at?: Date;
}

export interface SmsProviderConfiguration {
     apiKey: string;
     defaultSender: string;
     baseUrl: string;
     sandbox?: boolean;
     pausedReason?: string | null;
}
