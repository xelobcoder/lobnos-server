"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsService = void 0;
class SmsService {
    constructor(apiKey) {
        this.config = {
            apiKey: apiKey || process.env.ARKESEL_SMS_API_KEY,
            defaultSender: process.env.SMS_DEFAULT_SENDER,
            baseUrl: process.env.ARKESEL_BASE_URL
        };
        if (!this.config.apiKey) {
            throw new Error('SMS API key is required');
        }
    }
    async sendRequest(endpoint, method, data) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'api-key': this.config.apiKey
            };
            const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
                method,
                headers,
                body: method !== 'GET' && data ? JSON.stringify(data) : undefined,
            });
            if (!response.ok) {
                throw new Error(`SMS API error: ${response.status} ${response.statusText}`);
            }
            return await response.json();
        }
        catch (error) {
            console.error('SMS service error:', error);
            throw new Error(error instanceof Error ? error.message : 'Unknown SMS service error');
        }
    }
    validatePhoneNumber(phone) {
        if (!phone) {
            return {
                isValid: false,
                formattedNumber: null,
                error: 'Phone number is required'
            };
        }
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('00')) {
            digits = digits.slice(2);
        }
        let formattedNumber = null;
        if (digits.length === 9) {
            formattedNumber = '0' + digits;
        }
        else if (digits.startsWith('255') && digits.length === 12) {
            formattedNumber = '0' + digits.slice(3);
        }
        else if (digits.length === 10) {
            formattedNumber = digits.startsWith('0') ? digits : '0' + digits;
        }
        if (!formattedNumber || !/^0\d{9}$/.test(formattedNumber)) {
            return {
                isValid: false,
                formattedNumber: null,
                error: 'Invalid phone number format'
            };
        }
        return {
            isValid: true,
            formattedNumber
        };
    }
    validateRecipients(recipients) {
        const validNumbers = [];
        const invalidNumbers = [];
        recipients.forEach(number => {
            const validation = this.validatePhoneNumber(number);
            if (validation.isValid && validation.formattedNumber) {
                validNumbers.push(validation.formattedNumber);
            }
            else {
                invalidNumbers.push({
                    number,
                    error: validation.error || 'Invalid number'
                });
            }
        });
        return { validNumbers, invalidNumbers };
    }
    async sendSms(recipients, message, options = {}) {
        if (!recipients.length || !message.trim()) {
            throw new Error('Recipients and message are required');
        }
        const { validNumbers, invalidNumbers } = this.validateRecipients(recipients);
        if (invalidNumbers.length > 0) {
            console.warn('Invalid phone numbers detected:', invalidNumbers);
        }
        if (validNumbers.length === 0) {
            throw new Error('No valid phone numbers provided');
        }
        const data = Object.assign(Object.assign({ sender: options.sender || this.config.defaultSender, message: message.trim(), recipients: validNumbers }, (options.callbackUrl && { callback_url: options.callbackUrl })), (options.scheduledDate && { scheduled_date: options.scheduledDate }));
        return this.sendRequest('/api/v2/sms/send', 'POST', data);
    }
    async sendSingleSms(to, message, options = {}) {
        if (!to || !message.trim()) {
            throw new Error('Recipient and message are required');
        }
        const validation = this.validatePhoneNumber(to);
        if (!validation.isValid) {
            throw new Error(`Invalid phone number: ${validation.error}`);
        }
        const queryParams = new URLSearchParams({
            action: 'send-sms',
            api_key: this.config.apiKey,
            to: validation.formattedNumber,
            sms: message.trim(),
            sender: options.sender || this.config.defaultSender
        });
        return this.sendRequest(`/sms/api?${queryParams}`, 'GET');
    }
    formatScheduledDate(date) {
        let d;
        if (typeof date === 'string') {
            d = new Date(date);
        }
        else {
            d = date;
        }
        const pad = (n) => n < 10 ? '0' + n : n;
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        let hour = d.getHours();
        const minute = pad(d.getMinutes());
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12;
        if (hour === 0)
            hour = 12;
        const hourStr = pad(hour);
        return `${year}-${month}-${day} ${hourStr}:${minute} ${ampm}`;
    }
    async scheduleSms(recipients, message, scheduledDate, sender) {
        const formattedDate = this.formatScheduledDate(scheduledDate);
        return await this.sendSms(recipients, message, { scheduledDate: formattedDate, sender });
    }
    async sendSmsWithWebhook(recipients, message, callbackUrl, sender) {
        return this.sendSms(recipients, message, { callbackUrl, sender });
    }
}
exports.SmsService = SmsService;
