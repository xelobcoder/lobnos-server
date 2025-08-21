import { Request, Response } from "express";
import Expenses from "../../models/Expenses/ExpenseService";
import path from "node:path";
import { customError, responseError } from "../../hooks/helper";
import { RECEIPTS_PATH } from "../../models/Expenses/queries";
import { PrimeLimsTableexpensesrecord } from "../../database/DatabaseTableSchema";
import ExpenseAuditLog from "../../models/Expenses/ExpenseAuditLog";
import expenseMerchants, { ExpenseMerchant } from "../../models/Expenses/expenseMerchants";
import logger from "../../hooks/logger";
import { request } from "node:http";
import OutsourcedCases from "../../models/organization/outsourcingOrganization/outsourcedCases";

type ExpenseQueryType = {
	employeeid: number;
	branchid: number;
	tenantId: number;
	expenseId: number | null;
};

const initializeExpense = (requestQuery: ExpenseQueryType) => {
	const { employeeid, branchid, tenantId, expenseId } = requestQuery;
	const pTenantId = parseInt(tenantId.toString());
	const pEmployeeid = parseInt(employeeid.toString());
	const pBranchId = parseInt(branchid.toString());
	return new Expenses(pEmployeeid, pBranchId, pTenantId, expenseId);
};

export const generateNewExpense = async (req: Request, res: Response) => {
	try {
		const expenses = initializeExpense(req.query as unknown as ExpenseQueryType);
		const status = await expenses.generateNewExpense(req.body);
		res.send({ status });
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const getExpensesRecord = async (req: Request, res: Response) => {
	try {
		const { employeeid, branchid, count, page, status, from, to, tenantId } = req.query;

		if (!employeeid || !branchid || !tenantId) {
			return customError("Required query parameters missing", 400, res);
		}

		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: null
		});

		const records = await expenses.getExpensesRecord(
			parseInt(tenantId.toString()),
			parseInt(employeeid.toString()),
			parseInt(branchid.toString()),
			status?.toString(),
			{ page: parseInt(page?.toString() || "1"), count: parseInt(count?.toString() || "10") },
			from?.toString(),
			to?.toString()
		);

		res.send(records);
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const getSingleExpense = async (req: Request, res: Response) => {
	try {
		const { expenseid, tenantId, employeeid, branchid } = req.query;

		if (!expenseid || !tenantId || !employeeid || !branchid) {
			return customError("Required parameters not provided", 404, res);
		}

		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: parseInt(expenseid.toString())
		});

		const record = await expenses.getSingleExpense(parseInt(tenantId.toString()), expenseid.toString());
		res.send(record);
	} catch (err) {
		console.log(err);
		responseError(res, err);
	}
};


export const getExpenseLog = async (request: Request, response: Response) => {
	try {
		const { tenantId } = request.query;
		const pTenantId = parseInt(tenantId.toString());
		const expenseId = parseInt(request.params.expenseId.toString());
		const audits = await new ExpenseAuditLog(pTenantId, expenseId).getExpenseAuditLogInformation();
		response.send(audits);
	} catch (err) {
		responseError(response);
	}
}

export const updateExpenseRecord = async (request: Request, response: Response) => {
	try {
		const { expenseid, tenantId } = request.query;
		const expenseData = request.body;

		if (!expenseid || !tenantId || !expenseData.employeeid || !expenseData.branchid) {
			return customError("Missing required identifiers", 404, response);
		}

		const expenses = initializeExpense({
			employeeid: expenseData.employeeid,
			branchid: expenseData.branchid,
			tenantId: parseInt(tenantId.toString()),
			expenseId: parseInt(expenseid.toString())
		});

		const result = await expenses.updateExpenseRecord(expenseData);

		if (typeof result === "string") {
			return response.send({ status: false, message: result })
		}

		response.send({ status: result });
	} catch (err) {
		console.log(err);
		responseError(response, err);
	}
};

export const uploadReceipts = async (req: Request, res: Response) => {
	try {
		res.send({ status: "success" });
	} catch (err) {
		console.log(err);
	}
};

export const getReceiptImage = async (req: Request, res: Response) => {
	try {
		const { imageid } = req.query;
		if (!imageid) return customError("imageid not provided", 404, res);
		res.sendFile(path.join(__dirname, RECEIPTS_PATH, `${imageid}`));
	} catch (err) {
		responseError(res);
	}
};

export const getExpenseImageList = async (req: Request, res: Response) => {
	const { expenseid, tenantId, employeeid, branchid } = req.query;

	if (!expenseid || !tenantId || !employeeid || !branchid) {
		return customError("Required parameters not provided", 404, res);
	}

	const expenses = initializeExpense({
		employeeid: parseInt(employeeid.toString()),
		branchid: parseInt(branchid.toString()),
		tenantId: parseInt(tenantId.toString()),
		expenseId: parseInt(expenseid.toString())
	});

	const result = await expenses.getExpenseImageList(expenseid.toString());
	res.send(result);
};

export const deleteReceiptsList = async (req: Request, res: Response) => {
	const { data } = req.body;
	const { employeeid, branchid, tenantId } = req.query;

	if (!employeeid || !branchid || !tenantId) {
		return customError("Required identifiers missing", 404, res);
	}

	if (data && Array.isArray(data) && data.length > 0) {
		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: null
		});
		const status = await expenses.deleteReceiptsList(data);
		res.send({ status: status ? "success" : "failed" });
	} else {
		return customError("image list not provided", 404, res);
	}
};

export const updateExpenseDecision = async (req: Request, res: Response) => {
	try {
		const { expenseid, employeeid, status, information, branchid } = req.body;
		const { tenantId } = req.query;

		if (!employeeid || !branchid || !expenseid || !status) {
			return customError("Missing required decision parameters", 400, res);
		}

		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: parseInt(expenseid.toString())
		});

		const result = await expenses.updateExpenseDecision(
			parseInt(tenantId.toString()),
			status,
			expenseid,
			information,
			employeeid
		);

		res.send({ status: result });
	} catch (err) {
		responseError(res);
	}
};

export const createExpenseCategory = async (req: Request, res: Response) => {
	try {
		const { category, employeeid, branchid } = req.body;
		const { tenantId } = req.query;

		if (!employeeid || !category || !branchid || !tenantId) {
			return customError("employeeid, branchid, category and tenantId required", 404, res);
		}

		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: null
		});

		const result = await expenses.createExpenseCategory(parseInt(tenantId.toString()), category, employeeid);

		if (typeof result === "boolean") {
			return result
				? res.send({ message: "category created successfully", statusCode: 200, status: "success" })
				: res.send({ message: "category creation failed", statusCode: 200, status: "failed" });
		}

		if (typeof result === "string" && result.trim() === "category exist") {
			res.send({ message: "category already exist", statusCode: 200, status: "success" });
		}
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const updateExpenseCategory = async (req: Request, res: Response) => {
	try {
		const { category, employeeid, branchid, editid } = req.body;
		const { tenantId } = req.query;

		if (!employeeid || !branchid || !category || !editid || !tenantId) {
			return customError("Required update parameters missing", 404, res);
		}

		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: null
		});

		const result = await expenses.updateExpenseCategory(parseInt(tenantId.toString()), editid, category);
		res.send({ status: result });
	} catch (err) {
		responseError(res);
	}
};

export const getAllExpenseCategory = async (req: Request, res: Response) => {
	try {
		const { tenantId, employeeid, branchid } = req.query;

		if (!tenantId || !employeeid || !branchid) {
			return customError("Required query parameters missing", 404, res);
		}

		const expenses = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: null
		});

		const result = await expenses.getAllExpenseCategory();
		res.send(result);
	} catch (err) {
		responseError(res);
	}
};



export const createExpenseMerchant = async (req: Request, res: Response) => {
	try {
		const { employeeid, branchid, tenantId, name, email, phone, address, website, notes } = req.body;
		if (!employeeid || !branchid || !name) {
			return customError("employeeid, branchid, name, and address are required", 400, res);
		}
		const repo = new expenseMerchants(employeeid)
		const existing = await repo.findByMerchantName(name);
		if (existing) {
			return res.send({ message: "Merchant already exists", statusCode: 200, status: "success" });
		}
		const merchantData: ExpenseMerchant = { name, email, phone, address, website, notes, created_by: employeeid };
		const created = await repo.create(merchantData);
		res.send({ message: "Merchant created successfully", statusCode: 200, status: "success", merchant: created });
	} catch (err) {
		responseError(res);
	}
};


export const updateExpenseMerchant = async (req: Request, res: Response) => {
	try {
		const { name, employeeid, branchid, id } = req.body;
		const { tenantId } = req.query;
		if (!employeeid || !branchid || !name || !id) return customError("Required update parameters missing", 404, res);
		const repo = await new expenseMerchants(parseInt(tenantId.toString())).update(req.body);

		if (!repo) return customError("Merchant not found", 404, res);
		res.send({ status: "success", message: "Merchant updated successfully" });

	} catch (err) {
		logger.log(err);
		responseError(res);
	}
};


export const getAllExpenseMerchants = async (req: Request, res: Response) => {
	try {
		const { tenantId, employeeid, branchid, page, count } = req.query;
		if (!employeeid || !branchid) return customError("Required query parameters missing", 404, res);
		const repo = new expenseMerchants(tenantId as unknown as number);
		const result = await repo.findAll(parseInt(count as string), parseInt(page as string));
		res.send(result);
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};




export const markOutsourceCasesAsExpense = async (request: Request, response: Response): Promise<any> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		const { testid, serviceid, tracking_id, employeeid, branchid } = request.body;

		if (!testid || !serviceid || !employeeid || !branchid) return customError("Required parameters missing", 400, response);

		const result = await OutsourcedCases.markOutsourceCasesAsExpense(tenantId, {
			serviceid: serviceid,
			testid: testid,
			trackingid: tracking_id,
			branchid,
			employeeid
		});

		console.log(result);
		response.send({ status: result });
	} catch (err) {
		console.log(err);
		responseError(response);
	}
};



export const markCaseAsDone = async (request: Request, response: Response): Promise<any> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		const { trackingId, employeeid, comments } = request.body;

		if (!trackingId || !employeeid) return customError("Required parameters missing", 400, response);

		const result = await OutsourcedCases.markOutsourceTrackingDone(tenantId, {
			trackingId,
			employeeId: employeeid,
			comments,

		});

		console.log(result);
		response.send({ status: result });
	} catch (err) {
		console.log(err);
		responseError(response);
	}
};