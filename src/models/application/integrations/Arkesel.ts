import { SmsProviderSettingsRepo } from '../sms/repositories/SmsProviderSettingsRepo';
import { SmsProviderSettingsService } from '../sms/services/SmsProviderSettingsService';
import { SmsProviderConfiguration } from '../sms/types/SmsProviderModels';

interface SmsResponse {
    status: string;
    code: number;
    message: string;
    data?: any;
    uncertain?: boolean;
    reason?: 'CONTACT_GROUP_NOT_FOUND';
}

interface SmsSendOptions {
    sender?: string;
    callbackUrl?: string;
    scheduledDate?: string;
    sandbox?: boolean;
    useCase?: 'promotional' | 'transactional';
}

interface PhoneValidationResult {
    isValid: boolean;
    formattedNumber: string | null;
    error?: string;
}

export class SmsService {
    private resolvedProvider?: SmsProviderConfiguration;
    constructor(private tenantId: number, private readonly configuredProvider?: SmsProviderConfiguration) { }

    public async getConfiguration(): Promise<SmsProviderConfiguration> {
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
                url: new URL(endpoint,provider.baseUrl).toString(),
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


            let result: any;
            try { result = await response.json(); } catch { return {status:'error',code:response.status || 500,uncertain:true,message:'Provider returned an unreadable response; check acceptance before retrying'}; }
            if (!response.ok || result?.status === 'error') {
                const code = Number(result?.code) || response.status;
                const descriptions: Record<number,string> = {401:'Arkesel credentials were rejected',402:'Arkesel balance is insufficient',403:'Arkesel gateway is inactive',422:'Arkesel rejected the message fields',429:'Arkesel rate limit reached; try later'};
                const missingContactGroup = endpoint === '/api/v2/contacts' && response.status === 422 && /^the group name provided does not exist!?$/i.test(String(result?.message || '').trim());
                return {status:'error',code,...(missingContactGroup?{reason:'CONTACT_GROUP_NOT_FOUND' as const}:{}),uncertain:code >= 500 || code === 408,message:missingContactGroup ? 'Arkesel could not find this contact group for the configured API account. Check the group and account with Arkesel before retrying.' : descriptions[code] || 'Arkesel could not confirm this request'};
            }
            if (!result || typeof result !== 'object') return {status:'error',code:500,uncertain:true,message:'Invalid provider response'};

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
        let digits = phone.replace(/[\s()+-]/g, '')
        if (!/^\d+$/.test(digits)) return {isValid:false,formattedNumber:null,error:'Invalid phone number format'}
        if (digits.startsWith('00')) {
            digits = digits.slice(2)
        }
        if (/^[1-9]\d{10,14}$/.test(digits) && !digits.startsWith('233')) return {isValid:true,formattedNumber:digits,error:undefined};
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
        if (sender.length > 11) throw new Error('Sender ID must be no more than 11 characters');
        return sender;
    }

    async sendSms(
        recipients: string[],
        message: string,
        options: SmsSendOptions = {}
    ): Promise<SmsResponse> {
        const config = await this.getConfiguration();
        if (!recipients.length || !message || !message.trim()) {
            throw new Error('Recipients and message are required')
        }
        const { validNumbers, invalidNumbers } = this.validateRecipients(recipients)
        if (invalidNumbers.length > 0) {
            console.warn('Invalid SMS recipients excluded:', invalidNumbers.length)
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
            ...(options.scheduledDate && { scheduled_date: options.scheduledDate }),
            ...((options.sandbox ?? config.sandbox) ? {sandbox:true} : {}),
            ...(options.useCase ? {use_case:options.useCase} : {})
        }
        return this.sendRequest(config, '/api/v2/sms/send', 'POST', data)
    }

    async getMessageReport(messageId: string): Promise<SmsResponse> {
        if (!/^[\w-]{1,64}$/.test(messageId)) throw new Error('Invalid provider message ID');
        return this.sendRequest(await this.getConfiguration(), '/api/v2/sms/' + encodeURIComponent(messageId), 'GET');
    }

    async sendSingleSms(
        to: string,
        message: string,
        options: SmsSendOptions = {}
    ): Promise<SmsResponse> {
        const config = await this.getConfiguration();
        if (!to || !message.trim()) {
            throw new Error('Recipient and message are required')
        }
        const validation = this.validatePhoneNumber(to)
        if (!validation.isValid) {
            throw new Error(`Invalid phone number: ${validation.error}`)
        }
        return this.sendSms([to],message,options);
    }

    async getMessageReports(ids: string[]): Promise<SmsResponse> {
        if (!ids.length || ids.length > 1000 || ids.some(id=> !/^[\w-]{1,64}$/.test(id))) throw new Error('Provide 1 to 1000 valid provider message IDs');
        return this.sendRequest(await this.getConfiguration(),'/api/v2/sms/message-reports','POST',{msg_ids:[...new Set(ids)]});
    }
    async createContactGroup(groupName:string):Promise<SmsResponse>{
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(groupName))throw new Error('Invalid provider group reference');
        return this.sendRequest(await this.getConfiguration(),'/api/v2/contacts/groups','POST',{group_name:groupName});
    }
    async addContactsToGroup(groupName:string,contacts:Array<{phone_number:string;first_name?:string;company?:string}>):Promise<SmsResponse>{
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(groupName)||!contacts.length||contacts.length>200)throw new Error('Provide a group and 1 to 200 contacts');
        const safe=contacts.map(contact=>{const phone=this.validatePhoneNumber(contact.phone_number);if(!phone.isValid)throw new Error('Invalid contact number');return {phone_number:phone.formattedNumber!,...(contact.first_name?{first_name:contact.first_name}:{}),...(contact.company?{company:contact.company}:{})};});
        return this.sendRequest(await this.getConfiguration(),'/api/v2/contacts','POST',{group_name:groupName,contacts:safe});
    }
    /** Arkesel's contact-only compatibility API. Never log its URL or fetch errors:
     * this documented GET contract places credentials and contact data in the query.
     * A single contact per worker checkpoint keeps uncertain outcomes isolated. */
    async addContactToGroupCompatibility(groupName:string,contact:{phone_number:string;first_name?:string;company?:string}):Promise<SmsResponse>{
        if(!/^[A-Za-z0-9_-]{1,100}$/.test(groupName))throw new Error('Invalid provider group reference');
        const phone=this.validatePhoneNumber(contact.phone_number);
        if(!phone.isValid)throw new Error('Invalid contact number');
        const provider=await this.getConfiguration();
        const url=new URL('/contacts/api',provider.baseUrl);
        if(url.protocol!=='https:')throw new Error('Contact synchronization requires HTTPS');
        url.search=new URLSearchParams({action:'subscribe-us',api_key:provider.apiKey,phone_book:groupName,
            phone_number:phone.formattedNumber!.replace(/^0/,'233'),response:'json',
            ...(contact.first_name?{first_name:contact.first_name}:{}),...(contact.company?{company:contact.company}:{})}).toString();
        try{
            const response=await fetch(url.toString(),{method:'GET',headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
            let result:any;try{result=await response.json();}catch{return{status:'error',code:response.status||500,uncertain:true,message:'Contact acceptance could not be confirmed'};}
            // Both outcomes establish membership; the provider's duplicate response is not a new insertion.
            if(response.ok&&(result?.code==='ok'||String(result?.code)==='105'))return{status:'success',code:200,message:String(result.code)==='105'?'Contact already belongs to the group':'Contact synchronized'};
            const known:Record<string,string>={'102':'Arkesel credentials were rejected','103':'Arkesel rejected this contact number','104':'Arkesel could not find the contact subscription list'};
            const message=known[String(result?.code)];
            return{status:'error',code:message?422:response.status||500,uncertain:!message,message:message||'Contact acceptance could not be confirmed'};
        }catch{return{status:'error',code:500,uncertain:true,message:'Contact acceptance could not be confirmed; check Arkesel before retrying'};}
    }
    async getBalance(): Promise<SmsResponse> { return this.sendRequest(await this.getConfiguration(),'/api/v2/clients/balance-details','GET'); }
    async getWebhookSecret(): Promise<SmsResponse> { return this.sendRequest(await this.getConfiguration(),'/api/v2/webhooks/secret','GET'); }
    async rotateWebhookSecret(): Promise<SmsResponse> { return this.sendRequest(await this.getConfiguration(),'/api/v2/webhooks/secret/rotate','POST',{}); }
    async sendTemplateSms(message: string, recipients: Record<string,Record<string,string>>, options: SmsSendOptions = {}): Promise<SmsResponse> {
        const config=await this.getConfiguration();
        if (options.sandbox || config.sandbox) throw new Error('Arkesel template endpoint does not document sandbox support; use standard sandbox sending');
        const entries=Object.entries(recipients);
        if (!message.trim() || !entries.length) throw new Error('Template and recipients are required');
        const normalized: Record<string,Record<string,string>>={};
        for (const [phone,variables] of entries) { const valid=this.validatePhoneNumber(phone);if(!valid.isValid)throw new Error('Invalid template recipient');normalized[valid.formattedNumber!]=variables; }
        return this.sendRequest(config,'/api/v2/sms/template/send','POST',{sender:this.validateSender(options.sender||config.defaultSender),message,recipients:normalized,...(options.callbackUrl?{callback_url:options.callbackUrl}:{})});
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
