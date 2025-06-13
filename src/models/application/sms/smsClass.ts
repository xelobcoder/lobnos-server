
import { PrimeLimsTablesmsmessages, PrimeLimsTablesmstemplate } from '../../../database/DatabaseTableSchema';
import { TiifuWorkingClass } from '../../../database/TiifuWorkingClass';
import { paginationQuery, promisifyQuery, rowAffected } from '../../../hooks/helper';
import { OperationsFailures } from '../../operations/types';
import { SmsService } from '../integrations/Arkesel';

import {
    q_create_new_sms_template,
    q_read_sms_template_by_id,
    q_read_sms_templates_with_pagination,
    q_update_sms_template,
    q_delete_sms_template_by_id,
    q_sms_template_count,
    q_sms_message_delete,
    q_sms_message_update,
    q_sms_message_insert,
    q_sms_message_select,
    q_sms_messages_count,
    q_read_sms_messages_with_pagination,
    q_sms_reached_scheduled_date_an_time_sms_unsent,
    q_sms_message_update_resolved,
    q_read_sms_templates_without_pagination,
} from './queries';
import SmsLogsRepository from './SmsLogsRepository';

export class PrimeSmsServices {
    static async createNewSmsTemplate(tenantId: number, data: Omit<PrimeLimsTablesmstemplate, 'tempateid' | 'createdon'>): Promise<boolean> {
        const { templateName, placeholders, smscontent, createdby } = data;
        const createdon = new Date().toISOString();
        const placeholdersJSON = placeholders ? JSON.stringify(placeholders) : null;
        const result = await promisifyQuery(tenantId, q_create_new_sms_template, [templateName, placeholdersJSON, smscontent, createdby, createdon]);
        return rowAffected(result);
    }

    static async readSmsTemplateById(tenantId: number, tempateid: number): Promise<PrimeLimsTablesmstemplate | null> {
        const rows = await promisifyQuery(tenantId, q_read_sms_template_by_id, [tempateid]);
        if (Array.isArray(rows) && rows.length > 0) {
            const record = rows[0] as PrimeLimsTablesmstemplate;
            return {
                ...record,
                placeholders: record.placeholders ? JSON.parse(record.placeholders as unknown as string) : null,
            };
        }
        return null;
    }

    static async readSmsTemplatesWithPagination(tenantId: number, page: number, count: number): Promise<{ templates: PrimeLimsTablesmstemplate[]; totalCount: number }> {
        const rows = await paginationQuery({ count, page }, q_read_sms_templates_with_pagination, [], tenantId);
        const totalCountResult = await promisifyQuery(tenantId, q_sms_template_count);
        const totalCount = totalCountResult[0].total;

        const templates = rows.map((row: PrimeLimsTablesmstemplate) => ({
            ...row,
            placeholders: row.placeholders ? JSON.parse(row.placeholders as unknown as string) : null,
        }));

        return { templates, totalCount };
    }

    static async readAllSmsTemplates(tenantId: number): Promise<PrimeLimsTablesmstemplate[]> {
        const rows = await promisifyQuery(tenantId, q_read_sms_templates_with_pagination, []);
        return rows.map((row: PrimeLimsTablesmstemplate) => ({
            ...row,
            placeholders: row.placeholders ? JSON.parse(row.placeholders as unknown as string) : null,
        }));
    }

    static async readAllSmsTemplatesWithoutPagination(tenantId: number): Promise<PrimeLimsTablesmstemplate[]> {
        const rows = await promisifyQuery(tenantId, q_read_sms_templates_without_pagination, []);
        return rows.map((row: PrimeLimsTablesmstemplate) => ({
            ...row,
            placeholders: row.placeholders ? JSON.parse(row.placeholders as unknown as string) : null,
        }));
    }

    static async updateSmsTemplateById(
        tenantId: number,
        tempateid: number,
        updates: Partial<Omit<PrimeLimsTablesmstemplate, 'tempateid' | 'createdon'>>
    ): Promise<boolean> {
        const fields = Object.keys(updates);
        const values = Object.values(updates).map((value) =>
            fields.includes('placeholders') ? JSON.stringify(value) : value
        );
        if (fields.length === 0) {
            throw new Error('No updates provided');
        }
        const query = q_update_sms_template(fields);
        const result = await promisifyQuery(tenantId, query, [...values, tempateid]);
        return (result as any).affectedRows > 0;
    }

    static async deleteSmsTemplateById(tenantId: number, tempateid: number): Promise<boolean> {
        const result = await promisifyQuery(tenantId, q_delete_sms_template_by_id, [tempateid]);
        return (result as any).affectedRows > 0;
    }
    static async humanizeSmsTemplateScheduled(tenantId: number, data: Partial<PrimeLimsTablesmsmessages>) {
        const { templateid, receipients } = data;

        if (!templateid) return null;

        const template: PrimeLimsTablesmstemplate = await this.readSmsTemplateById(tenantId, templateid);

        const { smscontent } = template;

        const sourceMatch = smscontent.match(/\{@(\w+)\./);
        if (!sourceMatch) return OperationsFailures.notFound;

        const source = sourceMatch[1];

        const parsedRecipients = typeof receipients == "string" ? JSON.parse(receipients) : receipients;
        console.log("contacts", parsedRecipients, receipients)
        if (!Array.isArray(parsedRecipients) || parsedRecipients.length === 0) return;

        const contacts = parsedRecipients.map((item: { mobile: string, mobile_number: string }) => item.mobile || item.mobile_number).filter((num: string | number) => num !== undefined && num !== null);

        const preprocessNumbers = (numbers: number[]) => {
            const uniqueNumbers = Array.from(new Set(numbers));
            return uniqueNumbers
                .map((num) => num.toString().padStart(10, '0'))
                .filter((num) => num.length === 10);
        };


        const humanizeTextMessage = function (receipientFullData: any[], source: string, mobileKey: string) {
            const humanizedMessages = receipientFullData.map((recipient: any) => {
                let message = smscontent;

                const placeholders = message.match(new RegExp(`\\{@${source}\\.(\\w+)\\}`, 'g')) || [];

                placeholders.forEach((placeholder: string) => {
                    const key = placeholder.match(new RegExp(`\\{@${source}\\.(\\w+)\\}`))?.[1];
                    if (key && recipient[key] !== undefined) {
                        message = message.replace(placeholder, recipient[key]);
                    }
                });

                let name = ''

                if (source === "Clients") {
                    name = `${recipient.firstname} ${recipient.middlename} ${recipient.lastname}`;
                } else if (source === "Outsourcing") {
                    name = recipient.name;
                } else if (source === "organization") {
                    name = recipient.name
                } else if (source === "staffs") {
                    name = recipient.username;
                } else if (source === "clinicians") {
                    name = recipient.name
                } else {
                    name = ''
                }


                return {
                    mobile: `${recipient[mobileKey]}`.charAt(0) === '0' ? recipient[mobileKey] : `0${recipient[mobileKey]}`,
                    message,
                    name
                };
            });

            return humanizedMessages;
        }

        let smsRecipients = [];

        const validContacts = preprocessNumbers(contacts.map(num => Number(num)));

        if (source === 'Clients') {
            const receipientFullData = await new TiifuWorkingClass("new_patients").findList(tenantId, "mobile_number", validContacts);
            smsRecipients = humanizeTextMessage(receipientFullData, source, 'mobile_number');
        } else if (source === "Outsourcing") {
            const receipientFullData = await new TiifuWorkingClass('outsourcingorganization').findList(tenantId, 'contactNumber', validContacts);
            smsRecipients = humanizeTextMessage(receipientFullData, source, 'contactNumber');
        } else if (source === "organization") {
            const receipientFullData = await new TiifuWorkingClass('organization').findList(tenantId, 'mobile', validContacts);
            smsRecipients = humanizeTextMessage(receipientFullData, source, 'mobile');
        } else if (source === "clinicians") {
            const receipientFullData = await new TiifuWorkingClass('clinicianbasicinfo').findList(tenantId, 'phone', validContacts);
            smsRecipients = humanizeTextMessage(receipientFullData, source, 'phone');
        } else if (source === "staffs") {
            const receipientFullData = await new TiifuWorkingClass('roles').findList(tenantId, 'mobile', validContacts);
            smsRecipients = humanizeTextMessage(receipientFullData, source, 'mobile');
        } else {
            return []
        }
        return smsRecipients;
    }


    static async createNewSmsMessage(tenantId: number, data: PrimeLimsTablesmsmessages): Promise<boolean> {
        const { frequency, message, isTemplateused, templateid, isScheduled, scheduledDate, scheduledTime, endDate, usecase, isSent, templateCategory, isBulk, receipients } = data;

        if (isScheduled) {
            if (!scheduledDate || !scheduledTime) {
                throw new Error('Both scheduled date and time are required for scheduled messages');
            }

            const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
            if (isNaN(scheduledDateTime.getTime())) {
                throw new Error('Invalid scheduled date/time format');
            }
        }

        const receipientsJSON = receipients ? JSON.stringify(receipients) : null;

        const result = await promisifyQuery(tenantId, q_sms_message_insert, [
            frequency, message, isTemplateused, templateid, isScheduled, scheduledDate, scheduledTime, endDate, usecase, isSent, templateCategory, isBulk, receipientsJSON
        ]);

        const status = rowAffected(result);
        if (!status) return;
        if (isBulk == 1) return status

        const messageid = result?.insertId;
        let isSmsSent = null;
        if (isScheduled == 1 && scheduledDate && scheduledTime) {
            isSmsSent = await this.sendSmsMessage(tenantId, messageid)
        } else {
            isSmsSent = await this.sendSmsMessage(tenantId, messageid);
        }
        return status
    }

    static async smsSentUpdate(tenantId: number, messageid: number) {
        const result = await promisifyQuery(tenantId, q_sms_message_update_resolved, [messageid]);
        return rowAffected(result);
    }

    static async updateSmsMessageById(tenantId: number, messageid: number, updates: Record<string, any>): Promise<boolean> {
        const fields = Object.keys(updates);
        const values = Object.values(updates).map((value) =>
            fields.includes('receipients') ? JSON.stringify(value) : value
        );
        if (fields.length === 0) {
            throw new Error('No updates provided');
        }
        const result = await promisifyQuery(tenantId, q_sms_message_update, [...values, messageid]);
        return rowAffected(result);
    }

    static async deleteSmsMessageById(tenantId: number, messageid: number): Promise<boolean> {
        const result = await promisifyQuery(tenantId, q_sms_message_delete, [messageid]);
        return rowAffected(result);
    }

    static async readSmsMessageById(tenantId: number, messageid: number): Promise<PrimeLimsTablesmsmessages | null> {
        const rows = await promisifyQuery(tenantId, q_sms_message_select, [messageid]);
        if (Array.isArray(rows) && rows.length > 0) {
            const record = rows[0];
            return {
                ...record,
                receipients: record.receipients ? JSON.parse(record.receipients) : null,
            };
        }

        return null
    }
    static async totalSmsCount(tenantId: number, isUnsent: boolean = false) {
        let query = q_sms_messages_count;
        if (isUnsent && isUnsent === true) query += ` WHERE isSent = 0`;
        const totalCountResult = await promisifyQuery(tenantId, q_sms_messages_count);
        return totalCountResult[0].total;
    }
    static async readAllsmsMessageWithPagination(tenantId: number, count: number, page: number) {
        const rows = await paginationQuery({ count, page }, q_read_sms_messages_with_pagination, [], tenantId);

        const totalCount = await this.totalSmsCount(tenantId)

        const messages = rows.map((row: PrimeLimsTablesmstemplate) => ({
            ...row,
            placeholders: row.placeholders ? JSON.parse(row.placeholders as unknown as string) : null,
        }));

        return { messages, totalCount };
    }

    static async humanizeMessageRecipients(tenantId: number, messageid: number) {
        const message = await this.readSmsMessageById(tenantId, messageid);
        if (message) {
            return this.humanizeSmsTemplateScheduled(tenantId, message);
        }
        return null;
    }

    


    static async sendSmsMessage(tenantId: number, messageid: number){
        const message = await this.readSmsMessageById(tenantId, messageid);
        if (!message) throw new Error('Message not found');
        const { isBulk, isScheduled, scheduledDate, scheduledTime } = message

        if (isBulk == 0) {
            const result = await PrimeSmsServices.targetedSmsMessaging(tenantId, message, isScheduled, scheduledDate, scheduledTime, messageid);
            return result
        }
    }

    private static async targetedSmsMessaging(tenantId: number, message: PrimeLimsTablesmsmessages, isScheduled: number, scheduledDate: string | Date, scheduledTime: string, messageid: number) {
        const { receipients, templateid } = message;
        if (templateid == null) {
            const { message: messageContent, messageid ,isBulk} = message;
            if (!isBulk){
                if (!messageContent || !receipients || !Array.isArray(receipients)) {
                throw new Error('Invalid message content or recipients');
            }

            if (receipients.length === 0) return;
            if (receipients.length == 1) {
                const mobile = receipients[0].mobile;
                const smsService = await new SmsService().sendSms([mobile], messageContent);
                if (smsService) {
                    await this.smsSentUpdate(tenantId, messageid);
                }
            }


            if (receipients.length > 1) {
                const mobiles = receipients.map((recipient: { mobile: string }) => recipient.mobile);
                const smsService = await new SmsService().sendSms(mobiles, messageContent);
                if (smsService) {
                    await this.smsSentUpdate(tenantId, messageid);
                }

                return smsService;
            }

            } else {

            }
        } else {
            const recipients = await this.humanizeSmsTemplateScheduled(tenantId, message);
            const invalid = !recipients || !Array.isArray(recipients) || recipients.length === 0
            if (invalid) throw new Error('No valid recipients found');
            const smsService = new SmsService(null);

            const messageForwarding = await Promise.all(
                recipients.map(async (recipient, index: number) => {
                    let isSmsSent = null;
                    if (isScheduled == 1) {
                        const _date = new Date(scheduledDate);
                        const schedule = PrimeSmsServices.parseDateAsArkesel(scheduledTime, _date);

                        const { status } = await smsService.scheduleSms([recipient.mobile], recipient.message, schedule);
                        isSmsSent = status === "success";
                    } else {
                        isSmsSent = await smsService.sendSms([recipient.mobile], recipient.message);
                    }

                    if (!isSmsSent) return false;
                    const isUpdated = await this.smsSentUpdate(tenantId, messageid);
                    return isUpdated;
                })
            );
            return messageForwarding.some((_value: boolean) => !_value);
        }
    }

    private static parseDateAsArkesel(scheduledTime: string, _date: Date) {
        const [hour, minute, second] = scheduledTime.split(":").map(Number);
        const year = _date.getFullYear();
        const month = String(_date.getMonth() + 1).padStart(2, "0");
        const day = String(_date.getDate()).padStart(2, "0");

        const formattedHour = hour % 12 || 12;
        const amPm = hour >= 12 ? "PM" : "AM";

        const schedule = `${year}-${month}-${day} ${String(formattedHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${amPm}`;
        return schedule;
    }

    static async sendScheduledMessageReachedAndUnsent(tenantId: number, count: number, page: number): Promise<{ totalCount: number, result: PrimeLimsTablesmsmessages[] }> {
        const data: PrimeLimsTablesmsmessages[] = await paginationQuery({ count, page }, q_sms_reached_scheduled_date_an_time_sms_unsent, [], tenantId);
        const totalCount = await this.totalSmsCount(tenantId);
        return { result: data, totalCount }
    }

}




