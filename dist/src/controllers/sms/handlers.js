"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsTemplateController = void 0;
const smsClass_1 = require("../../models/application/sms/smsClass");
const helper_1 = require("../../hooks/helper");
class SmsTemplateController {
    static async handleCreateNewSmsTemplate(request, response) {
        try {
            const { templateName, placeholders, smscontent, createdby } = request.body;
            if (!templateName || !smscontent || !createdby) {
                response.status(400).json({ message: "Missing required fields." });
            }
            else {
                const tenantId = parseInt(request.query.tenantId.toString(), 10);
                const data = { templateName, placeholders, smscontent, createdby };
                const newSmsTemplate = await smsClass_1.PrimeSmsServices.createNewSmsTemplate(tenantId, data);
                response.status(201).json({ status: newSmsTemplate });
            }
        }
        catch (error) {
            response.status(500).json({ message: "Error creating SMS template.", error: error.message });
        }
    }
    static async handleReadSmsTemplateById(request, response) {
        try {
            const templateId = parseInt(request.query.id, 10);
            if (isNaN(templateId)) {
                response.status(400).json({ message: "Invalid template ID." });
            }
            else {
                const tenantId = parseInt(request.query.tenantId.toString(), 10);
                const smsTemplate = await smsClass_1.PrimeSmsServices.readSmsTemplateById(tenantId, templateId);
                if (!smsTemplate) {
                    response.status(404).json({ message: "SMS template not found." });
                }
                else {
                    response.status(200).json(smsTemplate);
                }
            }
        }
        catch (error) {
            response.status(500).json({ message: "Error fetching SMS template.", error: error.message });
        }
    }
    static async handleUpdateSmsTemplateById(request, response) {
        try {
            const templateId = parseInt(request.query.id, 10);
            if (isNaN(templateId)) {
                response.status(400).json({ message: "Invalid template ID." });
            }
            else {
                const updates = request.body;
                if (Object.keys(updates).length === 0) {
                    response.status(400).json({ message: "No updates provided." });
                }
                else {
                    const tenantId = parseInt(request.query.tenantId.toString(), 10);
                    const success = await smsClass_1.PrimeSmsServices.updateSmsTemplateById(tenantId, templateId, updates);
                    if (!success) {
                        response.status(404).json({ message: "SMS template not found." });
                    }
                    else {
                        response.status(200).json({ message: "SMS template updated successfully." });
                    }
                }
            }
        }
        catch (error) {
            response.status(500).json({ message: "Error updating SMS template.", error: error.message });
        }
    }
    static async handleDeleteSmsTemplateById(request, response) {
        try {
            const templateId = parseInt(request.query.id, 10);
            if (isNaN(templateId)) {
                return response.send({ message: "Invalid template ID." });
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const success = await smsClass_1.PrimeSmsServices.deleteSmsTemplateById(tenantId, templateId);
            if (!success) {
                return response.send({ message: "SMS template not found." });
            }
            return response.send({ message: "SMS template deleted successfully." });
        }
        catch (error) {
            return response.send({ message: "Error deleting SMS template.", error: error.message });
        }
    }
    static async handleReadAllSmsTemplates(request, response) {
        try {
            const page = parseInt(request.query.page, 10);
            const count = parseInt(request.query.count, 10);
            if ((page && isNaN(page)) || (count && isNaN(count))) {
                return response.send({ message: "Invalid pagination parameters." });
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            if (!page && !count) {
                const templates = await smsClass_1.PrimeSmsServices.readAllSmsTemplatesWithoutPagination(tenantId);
                return response.send({ templates });
            }
            const { templates, totalCount } = await smsClass_1.PrimeSmsServices.readSmsTemplatesWithPagination(tenantId, page, count);
            return response.send({
                templates,
                pagination: {
                    currentPage: page,
                    totalCount,
                    totalPages: Math.ceil(totalCount / count),
                },
            });
        }
        catch (error) {
            return response.send({ message: "Error fetching SMS templates.", error: error.message });
        }
    }
    static async handleReadAScheduleMessages(request, response) {
        try {
            const { messageid } = request.query;
            const parsedMessageid = parseInt(messageid.toString());
            if (!messageid || isNaN(parsedMessageid)) {
                return response.send({ message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, status: false });
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const message = await smsClass_1.PrimeSmsServices.readSmsMessageById(tenantId, parsedMessageid);
            response.send(message);
        }
        catch (err) {
            (0, helper_1.responseError)(response);
        }
    }
    static async handleDeleteMessages(request, response) {
        try {
            const { messageid } = request.query;
            const parsedMessageid = parseInt(messageid.toString());
            if (!messageid || isNaN(parsedMessageid)) {
                return response.send({ message: "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, status: false });
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const message = await smsClass_1.PrimeSmsServices.deleteSmsMessageById(tenantId, parsedMessageid);
            response.send({ status: message });
        }
        catch (err) {
            (0, helper_1.responseError)(response);
        }
    }
    static async createNewSmsMessage(request, response) {
        try {
            const { frequency, message, isTemplateused, templateid, isScheduled, scheduledDate, scheduledTime, endDate, usecase, receipients, isBulk } = request.body;
            const hasAllRequired = frequency && message
                && usecase;
            if (hasAllRequired && isScheduled && (!scheduledTime || !scheduledDate || !endDate)) {
                return (0, helper_1.customError)(`${"Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */}. Schedule date and time must be provided`, 400, response);
            }
            if (hasAllRequired && isTemplateused && !templateid) {
                return (0, helper_1.customError)(`${"Invalid response body parameters." /* OperationsFailures.invalidResponseBodyParams */}. template is being used but specific templateid not provided`, 404, response);
            }
            if (hasAllRequired && isBulk == 0 && (Array.isArray(receipients) === false || receipients.length == 0)) {
                return (0, helper_1.customError)("The type of request body is invalid" /* OperationsFailures.invalidRequestBodyType */ + " receipient for non bulk sms must be present", 400, response);
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const isCreated = await smsClass_1.PrimeSmsServices.createNewSmsMessage(tenantId, request.body);
            response.send({ status: isCreated });
        }
        catch (err) {
            console.log(err);
            (0, helper_1.responseError)(response);
        }
    }
    static async getMessages(request, response) {
        try {
            const { count, page } = request.query;
            if (!count || !page) {
                return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + " count and page not included in request query", 400, response);
            }
            const parsedCount = parseInt(count.toString());
            const parsedPage = parseInt(page.toString());
            if (isNaN(parsedCount) || isNaN(parsedPage)) {
                return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + "  Number required for count and page query params", 400, response);
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const result = await smsClass_1.PrimeSmsServices.readAllsmsMessageWithPagination(tenantId, parsedCount, parsedPage);
            response.send(result);
        }
        catch (err) {
            (0, helper_1.responseError)(response);
        }
    }
    static async getMessageRecipients(request, response) {
        const { messageid } = request.query;
        const parsedMessageid = parseInt(messageid.toString());
        if (isNaN(parsedMessageid)) {
            return (0, helper_1.customError)("Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */ + ". Messageid must be a number", 400, response);
        }
        const tenantId = parseInt(request.query.tenantId.toString(), 10);
        const result = await smsClass_1.PrimeSmsServices.humanizeMessageRecipients(tenantId, parsedMessageid);
        console.log(result);
        response.send(result);
    }
    static async sendScheduledMessageReachedAndUnsentHandler(request, response) {
        try {
            const { count, page } = request.query;
            const parsedCount = parseInt(count.toString());
            const parsedPage = parseInt(page.toString());
            if (!page || !count || isNaN(parsedCount) || isNaN(parsedPage)) {
                return (0, helper_1.customError)("400 Bad Request" /* HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST */ + " " + "Invalid request query parameters." /* OperationsFailures.invalidResquestQuery */, 400, response);
            }
            const tenantId = parseInt(request.query.tenantId.toString(), 10);
            const result = await smsClass_1.PrimeSmsServices.sendScheduledMessageReachedAndUnsent(tenantId, parsedCount, parsedPage);
            response.send(result);
        }
        catch (err) {
            console.log(err);
            (0, helper_1.responseError)(response);
        }
    }
}
exports.SmsTemplateController = SmsTemplateController;
