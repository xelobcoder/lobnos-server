import { Request, Response } from "express";
import { PrimeSmsServices } from "../../models/application/sms/smsClass";
import { PrimeLimsTablesmsmessages, PrimeLimsTablesmstemplate } from "../../database/DatabaseTableSchema";
import { OperationsFailures } from "../../models/operations/types";
import { responseError, customError } from "../../hooks/helper";
import { HTTPSTATUSERRORS } from "../../Errors/HTTPErrors";

interface SmsTemplateQuery {
	id?: string;
	page?: string;
	count?: string;
	tenantId: string
}

export class SmsTemplateController {
	static async handleCreateNewSmsTemplate(
		request: Request<{}, {}, Omit<PrimeLimsTablesmstemplate, 'tempateid' | 'createdon'>, SmsTemplateQuery>,
		response: Response
	) {
		try {
			const { templateName, placeholders, smscontent, createdby } = request.body;

			if (!templateName || !smscontent || !createdby) {
				response.status(400).json({ message: "Missing required fields." });
			} else {
				const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
				const data: Omit<PrimeLimsTablesmstemplate, 'tempateid' | 'createdon'> = { templateName, placeholders, smscontent, createdby };
				const newSmsTemplate = await PrimeSmsServices.createNewSmsTemplate(tenantId, data);
				response.status(201).json({ status: newSmsTemplate });
			}
		} catch (error) {
			response.status(500).json({ message: "Error creating SMS template.", error: error.message });
		}
	}

	static async handleReadSmsTemplateById(
		request: Request<{}, {}, {}, SmsTemplateQuery>,
		response: Response
	) {
		try {
			const templateId = parseInt(request.query.id as string, 10);

			if (isNaN(templateId)) {
				response.status(400).json({ message: "Invalid template ID." });
			} else {
				const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
				const smsTemplate = await PrimeSmsServices.readSmsTemplateById(tenantId, templateId);

				if (!smsTemplate) {
					response.status(404).json({ message: "SMS template not found." });
				} else {
					response.status(200).json(smsTemplate);
				}
			}
		} catch (error) {
			response.status(500).json({ message: "Error fetching SMS template.", error: error.message });
		}
	}

	static async handleUpdateSmsTemplateById(
		request: Request<{}, {}, Partial<PrimeLimsTablesmstemplate>, SmsTemplateQuery>,
		response: Response
	) {
		try {
			const templateId = parseInt(request.query.id as string, 10);

			if (isNaN(templateId)) {
				response.status(400).json({ message: "Invalid template ID." });
			} else {
				const updates: Partial<PrimeLimsTablesmstemplate> = request.body;

				if (Object.keys(updates).length === 0) {
					response.status(400).json({ message: "No updates provided." });
				} else {
					const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
					const success = await PrimeSmsServices.updateSmsTemplateById(tenantId, templateId, updates);

					if (!success) {
						response.status(404).json({ message: "SMS template not found." });
					} else {
						response.status(200).json({ message: "SMS template updated successfully." });
					}
				}
			}
		} catch (error) {
			response.status(500).json({ message: "Error updating SMS template.", error: error.message });
		}
	}

	static async handleDeleteSmsTemplateById(
		request: Request<{}, {}, {}, SmsTemplateQuery>,
		response: Response
	) {
		try {
			const templateId = parseInt(request.query.id as string, 10);

			if (isNaN(templateId)) {
				return response.send({ message: "Invalid template ID." });
			}
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const success = await PrimeSmsServices.deleteSmsTemplateById(tenantId, templateId);

			if (!success) {
				return response.send({ message: "SMS template not found." });
			}

			return response.send({ message: "SMS template deleted successfully." });
		} catch (error) {
			return response.send({ message: "Error deleting SMS template.", error: error.message });
		}
	}

	static async handleReadAllSmsTemplates(
		request: Request<{}, {}, {}, SmsTemplateQuery>,
		response: Response
	) {
		try {
			const page = parseInt(request.query.page as string, 10)
			const count = parseInt(request.query.count as string, 10)

			if ((page && isNaN(page)) || (count && isNaN(count))) {
				return response.send({ message: "Invalid pagination parameters." });
			}

			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);

			if (!page && !count) {
				const templates = await PrimeSmsServices.readAllSmsTemplatesWithoutPagination(tenantId);
				return response.send({ templates });
			}

			const { templates, totalCount } = await PrimeSmsServices.readSmsTemplatesWithPagination(tenantId, page, count);

			return response.send({
				templates,
				pagination: {
					currentPage: page,
					totalCount,
					totalPages: Math.ceil(totalCount / count),
				},
			});
		} catch (error) {
			return response.send({ message: "Error fetching SMS templates.", error: error.message });
		}
	}
	static async handleReadAScheduleMessages(request: Request<{}, {}, {}, {
		messageid: string,
		tenantId: string
	}>, response: Response) {
		try {
			const { messageid } = request.query
			const parsedMessageid = parseInt(messageid.toString());
			if (!messageid || isNaN(parsedMessageid)) {
				return response.send({ message: OperationsFailures.invalidResquestQuery, status: false });
			}
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const message = await PrimeSmsServices.readSmsMessageById(tenantId, parsedMessageid);

			response.send(message);
		} catch (err) {
			responseError(response);
		}
	}

	static async handleDeleteMessages(request: Request<{}, {}, {}, {
		messageid: string,
		tenantId: string
	}>, response: Response) {
		try {
			const { messageid } = request.query
			const parsedMessageid = parseInt(messageid.toString());
			if (!messageid || isNaN(parsedMessageid)) {
				return response.send({ message: OperationsFailures.invalidResquestQuery, status: false });
			}
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const message = await PrimeSmsServices.deleteSmsMessageById(tenantId, parsedMessageid);

			response.send({ status: message });
		} catch (err) {
			responseError(response);
		}
	}

	static async createNewSmsMessage(request: Request<{}, {}, PrimeLimsTablesmsmessages>, response: Response) {
		try {
			const { frequency, message, isTemplateused, templateid, isScheduled, scheduledDate, scheduledTime, endDate, usecase, receipients, isBulk } = request.body

			const hasAllRequired = frequency && message
				&& usecase;

			if (hasAllRequired && isScheduled && (!scheduledTime || !scheduledDate || !endDate)) {
				return customError(`${OperationsFailures.invalidResponseBodyParams}. Schedule date and time must be provided`, 400, response);
			}

			if (hasAllRequired && isTemplateused && !templateid) {
				return customError(`${OperationsFailures.invalidResponseBodyParams}. template is being used but specific templateid not provided`, 404, response);
			}

			if (hasAllRequired && isBulk == 0 && (Array.isArray(receipients) === false || receipients.length == 0)) {
				return customError(OperationsFailures.invalidRequestBodyType + " receipient for non bulk sms must be present", 400, response);
			}
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const isCreated = await PrimeSmsServices.createNewSmsMessage(tenantId, request.body);

			response.send({ status: isCreated });

		} catch (err) {
			console.log(err)
			responseError(response)
		}
	}

	static async getMessages(request: Request<{}, {}, {}, { count: number | string, page: number | string, tenantId: string }>, response: Response) {
		try {
			const { count, page } = request.query
			if (!count || !page) {
				return customError(OperationsFailures.invalidResquestQuery + " count and page not included in request query", 400, response);
			}

			const parsedCount = parseInt(count.toString());
			const parsedPage = parseInt(page.toString());

			if (isNaN(parsedCount) || isNaN(parsedPage)) {
				return customError(OperationsFailures.invalidResquestQuery + "  Number required for count and page query params", 400, response);
			}
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const result = await PrimeSmsServices.readAllsmsMessageWithPagination(tenantId, parsedCount, parsedPage);

			response.send(result);

		} catch (err) {
			responseError(response);
		}
	}


	static async getMessageRecipients(request: Request<{}, {}, {}, { messageid: number | string, tenantId: string }>, response: Response) {
		const { messageid } = request.query;
		const parsedMessageid = parseInt(messageid.toString());

		if (isNaN(parsedMessageid)) {
			return customError(OperationsFailures.invalidResquestQuery + ". Messageid must be a number", 400, response);
		}
		const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
		const result = await PrimeSmsServices.humanizeMessageRecipients(tenantId, parsedMessageid);

		console.log(result);

		response.send(result)
	}


	static async sendScheduledMessageReachedAndUnsentHandler(request: Request<{}, {}, {}, { page: number, count: number, tenantId: string }>, response: Response) {
		try {
			const { count, page } = request.query
			const parsedCount = parseInt(count.toString());
			const parsedPage = parseInt(page.toString());


			if (!page || !count || isNaN(parsedCount) || isNaN(parsedPage)) {
				return customError(HTTPSTATUSERRORS.HTTP_400_BAD_REQUEST + " " + OperationsFailures.invalidResquestQuery, 400, response)
			}
			const tenantId: number = parseInt(request.query.tenantId.toString(), 10);
			const result = await PrimeSmsServices.sendScheduledMessageReachedAndUnsent(tenantId, parsedCount, parsedPage);

			response.send(result);
		}
		catch (err) {
			console.log(err)
			responseError(response)
		}
	}

}
