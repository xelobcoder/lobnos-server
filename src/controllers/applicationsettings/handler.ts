import { Request, Response } from "express";
import logger from "../../hooks/logger";
import User from "../../LobnosAuth/user";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { categoryColumnMapper, smsTemplatePlaceholdersOptions, TableFilteringType } from "../../database/interface";
import Tax from "../../models/application/Tax";
import ResultSettings from "../../models/application/appsettings/resultSettings";
import { OperationsFailures } from "../../models/operations/types";
import ApplicationSettings from "./../../models/application/appsettings/appset";
import { responseError, customError } from "../../hooks/helper";
import { ApplicationBillSettings } from "../../models/application/appsettings/Type";
import { CustomerBillingInit } from "../../models/billing/multi/initCustomerBilling";
import { EntityType } from "../../models/billing/multi/billing_shared_types";
import { SubmitCustomerBilling } from "../../models/billing/billing-new-client-multi";
import { CustomerBillingCheckout } from "../../models/billing/multi/customerBillingCheckout";




const appsettings = new ApplicationSettings();
const tax = new Tax(null);
const result = new ResultSettings(null);

export const getApplicationSettings = async (req: Request<{ target: string }>, response: Response) => {
	try {
		const target = req.params.target;
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await appsettings.getAllAppSettings(tenantId);
		if (result && target) {
			if (result[target] !== undefined) {
				response.send({ statusCode: 200, status: "success", [target]: result[target] });
			} else {
				response.send({ statusCode: 404, status: "error", message: `${target} not found` });
			}
		}
		response.send({ statusCode: 200, status: "success", result });
	} catch (err) {
		responseError(response);
	}
};


export const getApplicationSettingsBilling = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString())
		const data = await appsettings.getAppBillSettings(tenantId);
		res.send(data);
	} catch (err) {
		console.log(err)
		responseError(res);
	}
};

export const updateApplicationBillSettingsHandler = async (req: Request<{}, {}, ApplicationBillSettings>, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString())
		const data = await ApplicationSettings.updateApplicationBillSettings(tenantId, req.body)
		res.send({ status: data > 0 ? true : false });
	} catch (err) {
		responseError(res);
	}
};

export const updateApplicationSettings = async (request: Request, response: Response) => {
	try {
		const data = request.body;
		const tenantId = parseInt(request.query.tenantId.toString())
		const is_updated = await appsettings.updateApplicationSettings(tenantId, data);
		is_updated && response.send({ message: "Applications settings updated successfully", statusCode: 200, status: "success" });
	} catch (err) {
		console.log(err);
		responseError(response);
	}
};

export const updateSmsSettings = async (req: Request, res: Response) => {
	try {
		const data = JSON.stringify(req.body);
		const tenantId = parseInt(req.query.tenantId.toString())
		const is_updated = await appsettings.updateSmsSettings(tenantId, data);
		res.send({ status: is_updated });
	} catch (err) {
		responseError(res);
	}
};

export const getSmsSettings = async (request: Request, response: Response) => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString())
		const sms_settings = await appsettings.getSmsSettings(tenantId);
		response.send(sms_settings);
	} catch (err) {
		responseError(response);
	}
};

export const getEmailPreference = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await appsettings.getEmailPreference(tenantId);
		res.send({ message: "success", status: "success", statusCode: 200, result });
	} catch (err) {
		customError("something went wrong", 500, res);
	}
};

export const getGeneralEmailSettings = async (req: Request, response: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString())
		const result = await appsettings.getGeneralEmailSettings(tenantId);
		response.send({ message: "success", status: "success", statusCode: 200, result });
	} catch (err) {
		customError("something went wrong", 500, response);
	}
};

export const updateGeneralEmailSettings = async (request: Request, res: Response) => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString())
		const result = await appsettings.updateGeneralEmailSettings(tenantId, request.body);
		res.send({
			message: result ? "updated successfully" : "No updates effected",
			status: "success",
			statusCode: 200,
		});
	} catch (err) {
		customError("something went wrong", 500, res);
	}
};

export const updateEmailPreference = (request: Request, response: Response) => {
	try {
		const data = request.body;
		const tenantId = parseInt(request.query.tenantId.toString())
		const updated = appsettings.updateEmailPreference(tenantId, data);
		response.send(updated);
	} catch (err) {
		responseError(response);
	}
};

export const updateRegistrationFields = async (request: Request, response: Response) => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString())
		const result = await appsettings.updateRegistrationFields(tenantId, request.body);
		if (result === true) {
			response.send({ message: "fields updated successfully", statusCode: 200, status: "success" });
		} else {
			response.send({ message: "fields update failed", statusCode: "error", status: "error" });
		}
	} catch (err) {
		logger.error(err);
		responseError(response);
	}
};

export const getRegistrationSettings = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId.toString())
		let result = await appsettings.getRegistrationSettings(tenantId);
		if (result.length > 0) {
			result = result[0]["fields"];
			if (result !== "{}") {
				res.send(JSON.parse(result));
			}
			else {
				res.send(result);
			}
		} else {
			res.send({});
		}
	} catch (err) {
		responseError(res);
	}
};

export const addTax = (req: Request, res: Response) => {
	tax.addTax(req, res);
};

export const getTax = (req: Request, res: Response) => {
	tax.getTax(req, res);
};

export const updateTax = (req: Request, res: Response) => {
	tax.updateTax(req, res);
};

export const changeTaxStatus = (req: Request, res: Response) => {
	tax.changeTaxStatus(req, res);
};

export const deleteTax = (req: Request, res: Response) => {
	tax.deleteTax(req, res);
};

export const getResultSettings = async (req: Request, response: Response) => {
	try {
		const { tenantId } = req.query;
		const resultSettings = await result.getResultSettings(parseInt(tenantId.toString()));
		response.send(resultSettings);
	} catch (err) {
		responseError(response);
	}
};

export const updateResultSettings = (req: Request, res: Response) => {
	result.updateResultSettings(req, res);
};



// RESULT ENTRY SETTINGS



export const validateUserRole = async (employeeid: string | string[], tenantId: number): Promise<boolean> => {
	const parsedEmployeeid = parseInt(employeeid.toString());
	const parsedTenantId = parseInt(tenantId.toString());
	const role = await new User(null, null, null, null, null).getUserRole(parsedEmployeeid, parsedTenantId);
	const validRoles = ["manager", "admin", "scientist"];
	return validRoles.includes(role.toLowerCase());
};

const handleInvalidRequest = (response: Response) => {
	response.send({ status: false, message: OperationsFailures.invalidResquestQuery });
};

export const resultEntrySettingsHandler = async (request: Request, response: Response) => {
	try {
		const { employeeid, tenantId } = request.query;

		if (!employeeid) return handleInvalidRequest(response);

		if (!(await validateUserRole(employeeid as any, parseInt(tenantId.toString())))) {
			response.send({ status: false, message: OperationsFailures.dontHavePermission });
		} else {
			const settings = await ResultSettings.getResultEntrySettings(parseInt(tenantId.toString()));
			response.send({ result: settings });
		}
	} catch (err) {

		responseError(response);
	}
};

export const resultEntrySettingsUpdateHandler = async (request: Request, response: Response) => {
	try {
		const { employeeid, tenantId } = request.query;

		if (!employeeid) return handleInvalidRequest(response);

		if (!(await validateUserRole(employeeid as any, parseInt(tenantId.toString())))) {
			response.send({ status: false, message: OperationsFailures.dontHavePermission });
		} else {
			const result = await ResultSettings.updateResultEntrySettings(parseInt(tenantId.toString()), request.body);
			response.send({ status: result });
		}
	} catch (err) {
		responseError(response);
	}
};



export const TableFiltering = async (request: Request<{ tablename: string }, {}, {}, TableFilteringType>, response: Response) => {
	try {
		const tablename = request.params;
		const { value, original = '', limit = 10, tenantId } = request.query

		if (!tablename.tablename || !value || value.trim().length <= 0 || isNaN(limit)) {
			return customError(OperationsFailures.invalidRequestParams, 404, response);
		}
		const columnName = original && original.trim().length > 0 && original.trim() != "undefined" ? original : null
		const tenantIdP: number = parseInt(request.query.tenantId as string, 10);
		const result = await TiifuWorkingClass.filterDatabaseTable(tenantIdP,
			tablename.tablename, columnName, value, parseInt(limit.toString()));
		response.send(result)
	} catch (err) {
		if (err && err?.code == OperationsFailures.ER_NO_SUCH_TABLE) {
			response.send({ status: false, message: OperationsFailures.ER_NO_SUCH_TABLE })
		} else {
			responseError(response);
		}
	}
}


export const columnFiltering = async (request: Request<{ column: string }>, response: Response) => {
	try {
		const tablename = request.params;
		const { tenantId } = request.query
		if (tablename.column && typeof tablename.column === "string" && tablename.column.trim().length > 0) {
			const tenantIdP: number = parseInt(tenantId.toString(), 10);

			let columns = await TiifuWorkingClass.getTableColumns(tenantIdP, tablename.column);
			if (columns.length > 0) {
				columns = columns.map((item) => ({
					value: item.Field,
					field: item.Field.replace(/[^\w\s]|_/g, ' ')
				}));
			}
			response.send(columns);
		} else {
			return customError(OperationsFailures.invalidRequestParams, 400, response);
		}
	} catch (err) {
		responseError(response);
	}
}


export const getCategoryColumns = async (request: Request<{}, {}, {}, {
	category: smsTemplatePlaceholdersOptions, tenantId: string
}>, response: Response) => {
	try {
		const { category, tenantId } = request.query;
		if (!category || category.trim().length <= 3) {
			return customError(OperationsFailures.invalidResquestQuery, 400, response);
		}
		const tableName = categoryColumnMapper[category]
		if (tableName) {
			const tenantIdP: number = parseInt(tenantId, 10);

			let columns = await TiifuWorkingClass.getTableColumns(tenantIdP, tableName);
			if (columns.length > 0) {
				columns = columns.map((item) => ({
					value: item.Field,
					field: item.Field.replace(/[^\w\s]|_/g, ' ')
				}));
			}
			response.send(columns);
		} else {
			return customError("Invalid category provided", 404, response);
		}
	} catch (err) {
		responseError(response);
	}
}


export const initializeBillingHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as string, 10);
		const {
			entityId,
			entityType,
			isPackageUsed,
			packageid,
			patientId,
			referalCode,
			billingid,
			branchid,
			nhisMemberId,
			claimCheckCode,
			ispricingcheckout,
		} = req.query;

		const parsePatientId = parseInt(patientId as string, 10);
		const parseBillingId = billingid ? parseInt(billingid as string, 10) : undefined;
		const parseBranchId = branchid ? parseInt(branchid as string, 10) : undefined
		let validatedEntityType = entityType as EntityType;
		let parseEntityId = parseInt(entityId as string, 10);
		const parsePackageId = packageid ? parseInt(packageid as string, 10) : undefined
		const parseIsPackageUsed =
			typeof isPackageUsed === "string"
				? isPackageUsed === "true" || isPackageUsed === "1"
				: !!isPackageUsed;
		const billingSource = req.query.billingSource ? parseInt(req.query.billingSource as string, 10) : undefined;
		if (billingSource == 4 && (!nhisMemberId || !claimCheckCode)) {
			return res.status(400).json({ success: false, message: 'Missing NHIS membership ID or claims check code' });
		}
		const pricingcheckout = ispricingcheckout ? ispricingcheckout === "true" : false;
		let referalData = null;
		if (referalCode) {
			referalData = await CustomerBillingCheckout.getInstance(tenantId).getReferralByCode(referalCode as string);
			if (!referalData) {
				return res.status(400).json({ success: false, message: 'Invalid referal code' });
			}
			referalData.entity_id && (parseEntityId = parseInt(referalData.entity_id.toString(), 10));
			referalData.entity_type && (validatedEntityType = referalData.entity_type);
		}
		const parsed = {
			entityId: parseEntityId,
			entityType: validatedEntityType,
			patientId: parsePatientId,
			isPackageUsed: parseIsPackageUsed,
			billingid: parseBillingId,
			packageid: parsePackageId,
			includeServices: req.query.includeServices ? req.query.includeServices === "true" : false,
			branchid: parseBranchId,
			billingSource: billingSource,
			claimscheckcode: claimCheckCode ? parseInt(claimCheckCode as string, 10) : undefined,
			nhismembershipid: nhisMemberId ? parseInt(nhisMemberId as string, 10) : undefined,
			pricingcheckout,
			referalCode: referalCode ? referalCode as string : undefined
		};

		const billingInit = CustomerBillingInit.getInstance(tenantId);
		const result = await billingInit.init(parsed);
		if (typeof result === "object" && result.hasOwnProperty('testList')) {
			res.send(result);
		} else {
			res.status(200).send({
				status: false,
				message: result
			}
			)

		}
	} catch (err) {
		console.error(err);
		responseError(res, err);
	}
};

export const checkoutBillingHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as string, 10);
		if (!tenantId) return res.status(400).json({ success: false, message: 'Missing tenantId' });

		const {
			patientId,
			billingid,
			cart,
			servicesList,
			paymentDetails,
			branchid,
			billingSource,
			referalCode,
			entityid,
			ispricingcheckout,
			entitytype,
			promoCode,
			isPromo,
			isPackageUsed,
			packageid
		} = req.body;

		const result = await CustomerBillingCheckout.checkoutCustomerBilling({
			patientId,
			billingid,
			cart,
			servicesList,
			paymentDetails,
			branchid,
			billingSource,
			entitytype,
			ispricingcheckout,
			entityid,
			referalCode,
			promoCode,
			isPromo,
			isPackageUsed,
			packageid,
			tenantId
		});
		if (result.success) {
			return res.status(200).json(result);
		} else {
			return res.status(400).json(result);
		}
	} catch (err) {
		console.error(err);
		responseError(res, err);
	}
};

export const submitBillingHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as string, 10);
		const {
			amountPayable,
			cart,
			servicesProvided,
			billingSource,
			paid,
			status,
			isConditionsUnderstood,
			patientid,
			employeeid,
			isPackageUsed,
			hasNightAdjustment,
			samplingCenter,
			payments,
			isPromo,
			isPayAll,
			promoMethod,
			patientId,
			billingid,
			paymentDetails,
			branchid,
			referalCode,
			promoCode,
			packageid,
			servicesList,
			entitytype,
			entityId,
			additionalinformation,
			isAdjustment,
			writeOffOutstanding,
			adjustmentType,
			adjustmentReason,
			nhismembershipid,
			claimscheckcode
		} = req.body;

		const result = await new SubmitCustomerBilling({
			tenantId,
			amountPayable,
			cart,
			servicesProvided,
			billingSource,
			paid,
			status,
			additionalinformation,
			isAdjustment,
			adjustmentType,
			adjustmentReason,
			isConditionsUnderstood,
			patientId: patientid ?? patientId,
			employeeid,
			isPackageUsed,
			entitytype,
			writeOffOutstanding,
			hasNightAdjustment,
			samplingCenter,
			entityId: entityId ? parseInt(entityId.toString(), 10) : undefined,
			entityid: entityId ? parseInt(entityId.toString(), 10) : undefined,
			payments,
			isPromo,
			promoMethod,
			billingid,
			paymentDetails,
			branchid,
			referalCode,
			isPayAll,
			promoCode,
			packageid,
			servicesList,
			nhismembershipid,
			claimscheckcode
		}, tenantId).submit();
		res.send(result)
	} catch (err) {
		console.error(err);
		responseError(res, err);
	}
};


export const correctRefererErrorPostRegistrationHandler = async (req: Request, res: Response) => {
	try {
		const tenantId = parseInt(req.query.tenantId as string, 10);
		const { entity_type, entity_id, branchid, billingid, employeeId } = req.body;
		if (!entity_type || !entity_id || !employeeId || !billingid || !branchid) {
			return res.status(400).json({ success: false, message: 'Missing entity_type or entity_id or employeeId or billingid or branchid' });
		}

		const isvalid_entity_id = !isNaN(parseInt(entity_id.toString(), 10));
		if (!isvalid_entity_id) {
			return res.status(400).json({ success: false, message: 'Invalid entity_id' });
		}
		const pEmployeeId = parseInt(employeeId.toString(), 10);
		const result = await CustomerBillingCheckout.correctRefererErrorPostRegistration(tenantId, pEmployeeId, entity_type, parseInt(entity_id.toString(), 10), billingid, branchid);

		if (typeof result === 'string') {
			return res.status(400).json({ success: false, message: result });
		}

		res.send(result);
	} catch (err) {
		console.error(err);
		responseError(res, err);
	}
};