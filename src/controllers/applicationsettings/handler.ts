import { request, Request, Response } from "express";
import logger from "../../hooks/logger";
import User from "../../LobnosAuth/user";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { categoryColumnMapper, smsTemplatePlaceholdersOptions, TableFilteringType } from "../../database/interface";
import Tax from "../../models/application/Tax";
import ResultSettings from "../../models/application/appsettings/resultSettings";
import { OperationsFailures } from "../../models/operations/types";
import ApplicationSettings from "./../../models/application/appsettings/appset";
import { responseError, customError, rowAffected } from "../../hooks/helper";
import { ApplicationBillSettings } from "../../models/application/appsettings/Type";

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