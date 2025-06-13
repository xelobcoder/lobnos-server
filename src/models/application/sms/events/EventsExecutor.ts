import KnexConnection from "../../../../database/KnexConnections";
import { promisifyQuery } from "../../../../hooks/helper";
import { Billing } from "../../../billing/billing";
import { SmsService } from "../../integrations/Arkesel";
import { PrimeSmsServices } from "../smsClass";
import { BirthdayQueries } from "./BirthdayQueries";
import { EventsRepository } from "./EventsRepository";

interface SmsRecipient {
    mobile: string;
    message: string;
    name: string;
}

class EventsExecutor {
    private static readonly SOURCE_CONFIG = {
        Clients: { table: 'new_patients', mobileField: 'mobile_number' },
        Outsourcing: { table: 'outsourcingorganization', mobileField: 'contactNumber' },
        organization: { table: 'organization', mobileField: 'mobile' },
        clinicians: { table: 'clinicianbasicinfo', mobileField: 'phone' },
        staffs: { table: 'roles', mobileField: 'mobile' }
    };

    private tenantId: number;

    constructor(tenantId: number) {
        this.tenantId = tenantId;
    }

    private formatPhoneNumber(phone: string): string | null {
        if (!phone) return null;
        const digits = phone.replace(/\D/g, '');
        return digits.length === 9 ? `0${digits}` :
            digits.startsWith('255') ? `0${digits.slice(3)}` :
                digits.length === 10 ? `0${digits}` : null;
    }

    private extractFieldValue(data: any, fieldPath: string): string {
        const parts = fieldPath.split('.');
        let value = data;

        for (const part of parts) {
            if (value === null || value === undefined) break;
            value = value[part];
        }

        return value !== null && value !== undefined ? String(value) : '';
    }

    private replacePlaceholders(template: string, placeholders: any[], data: any): string {
        let message = template;

        const replacementData = {
            ...data,
            Clients: data
        };

        placeholders.forEach(placeholder => {
            const field = placeholder.field || placeholder.value;
            const value = this.extractFieldValue(replacementData, field);

            const fieldBase = field.replace('Clients.', '');
            const patterns = [
                new RegExp(`\\{@${field}\\}`, 'gi'),
                new RegExp(`\\{${field}\\}`, 'gi'),
                new RegExp(`\\{@Clients.${fieldBase}\\}`, 'gi'),
                new RegExp(`\\{Clients.${fieldBase}\\}`, 'gi')
            ];

            patterns.forEach(pattern => {
                message = message.replace(pattern, value);
            });
        });

        const remainingPlaceholders = message.match(/\{@?[^{}]+\}/g) || [];
        const uniquePlaceholders = [...new Set(remainingPlaceholders)];

        uniquePlaceholders.forEach(placeholder => {
            const fieldMatch = placeholder.match(/\{@?(?:Clients\.)?([^{}]+)\}/);
            if (fieldMatch) {
                const field = fieldMatch[1];
                const value = this.extractFieldValue(replacementData, field);
                message = message.replace(new RegExp(placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g'), value);
            }
        });

        return message;
    }

    private async loadEventTemplate(eventName: string) {
        return new EventsRepository(this.tenantId).findByName(eventName);
    }

    public async processBirthEvent(): Promise<SmsRecipient[]> {
        try {
            const event = await this.loadEventTemplate('birthday');
            if (!event) {
                throw new Error('Birthday event template not found');
            }

            const { attachedscheduler } = event;
            const loadTemplate = await PrimeSmsServices.readSmsTemplateById(this.tenantId, attachedscheduler);
            if (!loadTemplate) {
                throw new Error(`Template with ID ${attachedscheduler} not found`);
            }

            const birthdayCount = await promisifyQuery(this.tenantId, BirthdayQueries.getTodaysBirthdaysCount);
            if (birthdayCount === 0) {
                console.log("No birthdays today");
                return [];
            }

            const birthdayClients = await promisifyQuery(this.tenantId, BirthdayQueries.getTodaysBirthdays, [100, 1]);
            if (birthdayClients.length === 0) {
                console.log("No birthday clients found");
                return [];
            }

            const patientIds = birthdayClients.map((client: { patientid: number }) => client.patientid);
            const connection = await KnexConnection(this.tenantId);

            const patients = await connection('new_patients')
                .whereIn('patientid', patientIds)
                .select('*');

            const recipients: SmsRecipient[] = patients
                .map((patient: any) => {
                    const formattedMessage = this.replacePlaceholders(
                        loadTemplate.smscontent,
                        typeof loadTemplate.placeholders === 'string'
                            ? JSON.parse(loadTemplate.placeholders)
                            : loadTemplate.placeholders,
                        patient
                    );

                    const formattedMobile = this.formatPhoneNumber(patient.mobile_number);

                    return {
                        mobile: formattedMobile || '',
                        message: formattedMessage,
                        name: `${patient.firstname} ${patient.lastname}`
                    };
                })
                .filter((recipient: SmsRecipient) => recipient.mobile);

            if (recipients.length === 0) return [];

            for (const recipient of recipients) {
                if (!recipient.mobile) {
                    console.warn(`Skipping recipient with missing mobile number: ${recipient.name}`);
                    continue;
                }

                const status = await new SmsService().sendSms(
                    [recipient.mobile],
                    recipient.message
                );

                console.log(status);
            }
            return recipients;
        } catch (error) {
            console.error('Error processing birth event:', error);
            throw error;
        }
    }


    processResultReadyEventBilling = async (eventName: string): Promise<boolean> => {
        try {
            const event = await this.loadEventTemplate(eventName);
            if (!event) {
                throw new Error(`Event template for ${eventName} not found`);
            }

            const { attachedscheduler } = event;
            const loadTemplate = await PrimeSmsServices.readSmsTemplateById(this.tenantId, attachedscheduler);
            if (!loadTemplate) {
                throw new Error(`Template with ID ${attachedscheduler} not found`);
            }

            const placeholders = typeof loadTemplate.placeholders === 'string'
                ? JSON.parse(loadTemplate.placeholders)
                : loadTemplate.placeholders;

            const sourceMatch = loadTemplate.smscontent.match(/{@(\w+)\./);
            if (!sourceMatch) {
                throw new Error('No valid source entity found in template');
            }

            const sourceType = sourceMatch[1];
            const sourceConfig = EventsExecutor.SOURCE_CONFIG[sourceType];
            if (!sourceConfig) {
                throw new Error(`Invalid source type: ${sourceType}`);
            }

            // Fetch patient data from new_patients table
            const connection = await KnexConnection(this.tenantId);
            const patients = await connection('new_patients').select('*');

            const recipients: SmsRecipient[] = patients.map(patient => {
                const formattedMessage = this.replacePlaceholders(
                    loadTemplate.smscontent,
                    placeholders,
                    patient
                );

                const formattedMobile = this.formatPhoneNumber(patient.mobile_number);

                return {
                    mobile: formattedMobile || '',
                    message: formattedMessage,
                    name: `${patient.firstname} ${patient.lastname}`
                };
            }).filter(recipient => recipient.mobile);

            if (recipients.length === 0) {
                console.log("No valid recipients found");
                return false;
            }

            for (const recipient of recipients) {
                try {
                    const status = await new SmsService().sendSms(
                        [recipient.mobile],
                        recipient.message
                    );
                    console.log(`SMS Status for ${recipient.name}:`, status);
                } catch (error) {
                    console.error(`Failed to send SMS to ${recipient.name}:`, error);
                }
            }

            return true;
        } catch (error) {
            console.error('Error processing event:', error);
            return false;
        }
    }
}

export default EventsExecutor;