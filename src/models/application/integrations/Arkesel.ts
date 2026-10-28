import { SmsProviderSettingsRepo } from '../sms/repositories/SmsProviderSettingsRepo';
import { SmsProviderSettingsService } from '../sms/services/SmsProviderSettingsService';
import { SmsProviderConfiguration } from '../sms/types/SmsProviderModels';

interface SmsResponse {
    status: string;
    code: number;
    message: string;
    data?: any;
    uncertain?: boolean;
}

interface SmsSendOptions {
    sender?: string;
    callbackUrl?: string;
    scheduledDate?: string;
}

interface PhoneValidationResult {
    isValid: boolean;
    formattedNumber: string | null;
    error?: string;
}

export class SmsService {
    private resolvedProvider?: SmsProviderConfiguration;
    constructor(private tenantId: number, private readonly configuredProvider?: SmsProviderConfiguration) { }

    private async getConfig(): Promise<SmsProviderConfiguration> {
        if (this.configuredProvider) return this.configuredProvider;
        if (!this.resolvedProvider) {
            this.resolvedProvider = await new SmsProviderSettingsService(
                new SmsProviderSettingsRepo(this.tenantId)
            ).getActiveConfiguration();
        }
        return this.resolvedProvider;
    }

    private async sendRequest(provider: SmsProviderConfiguration, endpoint: string, method: string, data?: object): Promise<SmsResponse> {
        try {
            const config = {
                method: method,
                url: `${provider.baseUrl}${endpoint}`,
                headers: {
                    'api-key': provider.apiKey,
                    'Content-Type': 'application/json'
                },
                data: data
            };

            const response = await fetch(config.url, {
                method: config.method,
                headers: config.headers as HeadersInit,
                body: config.method !== 'GET' && config.data ? JSON.stringify(config.data) : undefined,
                signal: AbortSignal.timeout(20000),
            });


            if (!response.ok) {
                return {
                    status: 'error',
                    code: response.status,
                    uncertain: response.status >= 500 || response.status === 408,
                    message: `Request failed with status ${response.status}: ${response.statusText}`,
                };
            }
            const result = await response.json();
            if (result?.status === 'error' && Number(result.code) >= 500) result.uncertain = true;
            return result;
        } catch (error) {
            // A timeout or unreadable response does not establish rejection.
            return {
                status: 'error',
                code: 500,
                uncertain: true,
                message: error instanceof Error ? error.message : 'Unknown error occurred',
            };
        }
    }

    private validatePhoneNumber(phone: string): PhoneValidationResult {
        if (!phone) {
            return {
                isValid: false,
                formattedNumber: null,
                error: 'Phone number is required'
            }
        }
        let digits = phone.replace(/\D/g, '')
        if (digits.startsWith('00')) {
            digits = digits.slice(2)
        }
        let formattedNumber: string | null = null
        if (digits.length === 9) {
            formattedNumber = '0' + digits
        } else if (digits.startsWith('233') && digits.length === 12) {
            formattedNumber = '0' + digits.slice(3)
        } else if (digits.length === 10) {
            formattedNumber = digits.startsWith('0') ? digits : '0' + digits
        }
        if (!formattedNumber || !/^0\d{9}$/.test(formattedNumber)) {
            return {
                isValid: false,
                formattedNumber: null,
                error: 'Invalid phone number format'
            }
        }
        return {
            isValid: true,
            formattedNumber
        }
    }

    private validateRecipients(recipients: string[]): {
        validNumbers: string[];
        invalidNumbers: Array<{ number: string; error: string }>;
    } {
        const validNumbers: string[] = []
        const invalidNumbers: Array<{ number: string; error: string }> = []
        recipients.forEach(number => {
            const validation = this.validatePhoneNumber(number)
            if (validation.isValid && validation.formattedNumber) {
                validNumbers.push(validation.formattedNumber)
            } else {
                invalidNumbers.push({
                    number,
                    error: validation.error || 'Invalid number'
                })
            }
        })
        return { validNumbers, invalidNumbers }
    }

    private validateSender(sender: string): string {
        if (!sender) {
            throw new Error('Sender is required');
        }
        if (sender.length > 11) {
            return sender.substring(0, 11);
        }
        return sender;
    }

    async sendSms(
        recipients: string[],
        message: string,
        options: SmsSendOptions = {}
    ): Promise<SmsResponse> {
        const config = await this.getConfig();
        if (!recipients.length || !message || !message.trim()) {
            throw new Error('Recipients and message are required')
        }
        const { validNumbers, invalidNumbers } = this.validateRecipients(recipients)
        if (invalidNumbers.length > 0) {
            console.warn('Invalid phone numbers detected:', invalidNumbers)
        }
        if (validNumbers.length === 0) {
            throw new Error('No valid phone numbers provided')
        }
        const sender = this.validateSender(options.sender || config.defaultSender);
        const data = {
            sender: sender,
            message: message.trim(),
            recipients: validNumbers,
            ...(options.callbackUrl && { callback_url: options.callbackUrl }),
            ...(options.scheduledDate && { scheduled_date: options.scheduledDate })
        }
        return this.sendRequest(config, '/api/v2/sms/send', 'POST', data)
    }

    async getMessageReport(messageId: string): Promise<SmsResponse> {
        if (!/^[\w-]{1,64}$/.test(messageId)) throw new Error('Invalid provider message ID');
        return this.sendRequest(await this.getConfig(), '/api/v2/sms/' + encodeURIComponent(messageId), 'GET');
    }

    async sendSingleSms(
        to: string,
        message: string,
        options: SmsSendOptions = {}
    ): Promise<SmsResponse> {
        const config = await this.getConfig();
        if (!to || !message.trim()) {
            throw new Error('Recipient and message are required')
        }
        const validation = this.validatePhoneNumber(to)
        if (!validation.isValid) {
            throw new Error(`Invalid phone number: ${validation.error}`)
        }
        const queryParams = new URLSearchParams({
            action: 'send-sms',
            api_key: config.apiKey,
            to: validation.formattedNumber!,
            sms: message.trim(),
            sender: options.sender || config.defaultSender
        })
        return this.sendRequest(config, `/sms/api?${queryParams}`, 'GET')
    }

    private formatScheduledDate(date: string | Date): string {
        let d: Date
        if (typeof date === 'string') {
            d = new Date(date)
        } else {
            d = date
        }
        const pad = (n: number) => n < 10 ? '0' + n : n
        const year = d.getFullYear()
        const month = pad(d.getMonth() + 1)
        const day = pad(d.getDate())
        let hour = d.getHours()
        const minute = pad(d.getMinutes())
        const ampm = hour >= 12 ? 'PM' : 'AM'
        hour = hour % 12
        if (hour === 0) hour = 12
        const hourStr = pad(hour)
        return `${year}-${month}-${day} ${hourStr}:${minute} ${ampm}`
    }

    async scheduleSms(
        recipients: string[],
        message: string,
        scheduledDate: string | Date,
        sender?: string
    ): Promise<SmsResponse> {
        const formattedDate = this.formatScheduledDate(scheduledDate)
        return await this.sendSms(recipients, message, { scheduledDate: formattedDate, sender })
    }

    async sendSmsWithWebhook(
        recipients: string[],
        message: string,
        callbackUrl: string,
        sender?: string
    ): Promise<SmsResponse> {
        return this.sendSms(recipients, message, { callbackUrl, sender });
    }
}
