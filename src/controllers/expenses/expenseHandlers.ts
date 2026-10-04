function parseDateParam(dateStr: unknown): string | null {
	if (!dateStr) return null;
	const str = String(dateStr).trim();
	if (!str) return null;

	const yyyymmdd = str.match(/^(d{4})[/-](d{1,2})[/-](d{1,2})/);
	if (yyyymmdd) {
		const y = yyyymmdd[1];
		const m = yyyymmdd[2].padStart(2, '0');
		const d = yyyymmdd[3].padStart(2, '0');
		return y + '-' + m + '-' + d;
	}

	const ddmmyyyy = str.match(/^(d{1,2})[/-](d{1,2})[/-](d{4})/);
	if (ddmmyyyy) {
		const d = ddmmyyyy[1].padStart(2, '0');
		const m = ddmmyyyy[2].padStart(2, '0');
		const y = ddmmyyyy[3];
		return y + '-' + m + '-' + d;
	}

	return str;
}

import { Request, Response } from "express";
import Expenses from "../../models/Expenses/ExpenseService";
import ExpenseInvoiceRepo from "../../models/Expenses/ExpenseInvoiceRepo";
import path, { parse } from "node:path";
import { customError, responseError, promisifyQuery } from "../../hooks/helper";
import { RECEIPTS_PATH } from "../../models/Expenses/queries";
import { PrimeLimsTableexpensesrecord } from "../../database/DatabaseTableSchema";
import ExpenseAuditLog from "../../models/Expenses/ExpenseAuditLog";
import expenseMerchants, { ExpenseMerchant } from "../../models/Expenses/expenseMerchants";
import logger from "../../hooks/logger";
import { request } from "node:http";
import OutsourcedCases from "../../models/organization/outsourcingOrganization/outsourcedCases";
import { SupplierPaymentExpenseSync } from "../../models/inventory/SupplierPaymentExpenseSync";
import User from "../../LobnosAuth/user";
import { ExpenseData } from "../../models/Expenses/interfaces/types";
import { PayrollReversalService } from "../../services/payroll/PayrollReversalService";
import { TiifuWorkingClass } from "../../database/TiifuWorkingClass";
import { getAuthUser } from "../../middleware/authority";
import { ExpenseDecisionInput, ExpenseWorkflowService } from "../../models/Expenses/ExpenseWorkflowService";
import { ExpensePaymentWorkflowService } from "../../models/Expenses/ExpensePaymentWorkflowService";

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

export const createExpenses = async (req: Request, res: Response) => {
	try {
		const actor = getAuthUser(req);
		if (!actor || actor.branch === null) return customError('Authenticated employee branch is required', 403, res);
		const expensesInstance = initializeExpense({ employeeid: actor.employeeid, branchid: actor.branch, tenantId: actor.tenantId, expenseId: null });
		const requestBody = req.body;

		if (Array.isArray(requestBody)) {
			if (requestBody.length === 0) {
				return customError("Expenses array cannot be empty", 400, res);
			}

			if (requestBody.length > 50) {
				return customError("Maximum 50 expenses can be created at once", 400, res);
			}

			const sanitized = requestBody.map((expense: any) => ({ ...expense, employeeid: actor.employeeid, branchid: actor.branch }));
			const result = await expensesInstance.generateBulkExpenses(sanitized);
			res.send(result);
		} else if (typeof requestBody === 'object' && requestBody !== null) {
			const expenseId = await expensesInstance.generateNewExpense({ ...requestBody, employeeid: actor.employeeid, branchid: actor.branch });
			res.send({ status: expenseId, expenseId, workflowStatus: 'pending_approval' });
		} else {
			return customError("Invalid request body. Expected expense object or array of expenses", 400, res);
		}
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const generateBulkExpenses = async (req: Request, res: Response) => {
	try {
		const { expenses, groupId } = req.body;

		if (!Array.isArray(expenses) || expenses.length === 0) {
			return customError("Expenses array is required and cannot be empty", 400, res);
		}

		if (expenses.length > 50) {
			return customError("Maximum 50 expenses can be created at once", 400, res);
		}

		const expensesInstance = initializeExpense(req.query as unknown as ExpenseQueryType);
		const result = await expensesInstance.generateBulkExpenses(expenses, groupId);
		res.send(result);
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const getExpensesByGroup = async (req: Request, res: Response) => {
	try {
		const { groupId } = req.params;
		const { tenantId, employeeid, branchid } = req.query;

		if (!groupId) {
			return customError("Group ID is required", 400, res);
		}

		if (!tenantId || !employeeid || !branchid) {
			return customError("Required query parameters missing", 400, res);
		}

		const expensesInstance = initializeExpense({
			employeeid: parseInt(employeeid.toString()),
			branchid: parseInt(branchid.toString()),
			tenantId: parseInt(tenantId.toString()),
			expenseId: null
		});
		const result = await expensesInstance.getExpensesByGroup(Number(tenantId), groupId as any);
		res.send({ expenses: result });
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


		const formatedDateFrom = parseDateParam(from);
		const formatedDateTo = parseDateParam(to) || formatedDateFrom;


		console.log({ formatedDateFrom, formatedDateTo })

		const records = await expenses.getExpensesRecord(
			parseInt(tenantId.toString()),
			parseInt(employeeid.toString()),
			parseInt(branchid.toString()),
			status?.toString(),
			{ page: parseInt(page?.toString() || "1"), count: parseInt(count?.toString() || "10") },
			formatedDateFrom,
			formatedDateTo
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


export const getExpenseLog = async (request: Request<{ expenseId: string | number }, {}, {}, { tenantId: string }>, response: Response) => {
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

export const updateExpenseRecord = async (request: Request<{}, {}, ExpenseData, { tenantId: string, expenseid: string }>, response: Response) => {
	try {
		const { expenseid } = request.query;
		const actor = getAuthUser(request);
		if (!actor || actor.branch === null) return customError('Authenticated employee branch is required', 403, response);
		const expenseData = { ...request.body, employeeid: actor.employeeid, branchid: actor.branch };

		if (!expenseid) {
			return customError("Missing required identifiers", 404, response);
		}

		const expenses = initializeExpense({
			employeeid: expenseData.employeeid,
			branchid: expenseData.branchid,
			tenantId: actor.tenantId,
			expenseId: parseInt(expenseid.toString())
		});

		const result = await expenses.updateExpenseRecord(expenseData as unknown as PrimeLimsTableexpensesrecord);

		if (typeof result === "string") {
			return customError(result, 400, response);
		}

		response.send({ status: result });
	} catch (err: any) {
		console.log(err);
		responseError(response, err);
	}
};

export const uploadReceipts = async (req: Request, res: Response) => {
	try {
		res.send({ status: "success" });
	} catch (err: any) {
		responseError(res, err);
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
		const result = await expenses.getExpenseImageList(expenseid.toString());
		res.send(result);
	} catch (err: any) {
		customError("Error Loading images", 404, res);
	}
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

export const updateExpenseDecision = async (req: Request<{}, {}, {
	expenseid: number;
	status: string;
	information?: string;
	employeeid: number;
	branchid: number;
}, { tenantId: string, employeeid?: string, branchid?: string }>, res: Response) => {
	try {
		const actor = getAuthUser(req);
		if (!actor) return customError('Authentication required', 401, res);

		const body: any = req.body;
		let decisions: ExpenseDecisionInput[];
		let isSingle = false;
		if (Array.isArray(body)) {
			decisions = body.map((decision: any) => ({ expenseid: Number(decision.expenseid), status: decision.status, information: decision.information }));
		} else if (Array.isArray(body?.decisions)) {
			decisions = body.decisions.map((decision: any) => ({ expenseid: Number(decision.expenseid), status: body.status, information: decision.information }));
		} else {
			isSingle = true;
			decisions = [{ expenseid: Number(body?.expenseid), status: body?.status, information: body?.information }];
		}

		const decisionResults = await new ExpenseWorkflowService(actor.tenantId).decide(actor, decisions);
		const approvedByBranch = new Map<number, number[]>();
		for (const result of decisionResults.filter((result) => result.status === 'approved')) {
			approvedByBranch.set(result.branchid, [...(approvedByBranch.get(result.branchid) || []), result.expenseid]);
		}

		const invoices: any[] = [];
		const invoiceErrors: Array<{ branchid: number; message: string }> = [];
		for (const [expenseBranchId, expenseIds] of approvedByBranch) {
			try {
				const invoiceRepo = new ExpenseInvoiceRepo(actor.employeeid, expenseBranchId, actor.tenantId);
				const branchInvoices = await createInvoicesForApprovedExpenses(invoiceRepo, expenseIds, !isSingle);
				invoices.push(...branchInvoices);
				const invoicedExpenseIds = new Set(branchInvoices.flatMap((invoice) => invoice.expenseIds));
				const missingInvoiceExpenseIds = expenseIds.filter((expenseId) => !invoicedExpenseIds.has(expenseId));
				if (missingInvoiceExpenseIds.length) {
					invoiceErrors.push({ branchid: expenseBranchId, message: `Invoice could not be created for approved expense(s): ${missingInvoiceExpenseIds.join(', ')}` });
				}
			} catch (invoiceError: any) {
				invoiceErrors.push({ branchid: expenseBranchId, message: invoiceError.message });
			}
		}

		const response = {
			success: true,
			count: decisionResults.length,
			decisions: decisionResults,
			invoices,
			...(invoiceErrors.length ? { invoiceErrors, message: 'Expense decisions succeeded, but some invoices require retry' } : {}),
		};
		return res.send(isSingle ? { ...response, decision: decisionResults[0] } : response);
	} catch (err: any) {
		logger.warn('Expense decision rejected', { error: err?.message || String(err) });
		const message = err?.message || 'Expense decision failed';
		const statusCode = /not found/i.test(message) ? 404
			: /cannot|already|paid|rejected|approved/i.test(message) ? 409
				: /authority|delegated|own expense|branch|capped|limit|duplicate active authority/i.test(message) ? 403
					: 400;
		return customError(message, statusCode, res);
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


export const updateExpenseMerchant = async (req: Request<{}, {}, {
	name: string;
	employeeid: number;
	branchid: number;
	id: number;
}, { tenantId: string }>, res: Response) => {
	try {
		const { name, employeeid, branchid, id } = req.body;
		const { tenantId } = req.query;
		if (!employeeid || !branchid || !name || !id) return customError("Required update parameters missing", 404, res);
		const repo = await new expenseMerchants(parseInt(tenantId.toString())).update(req.body);

		if (!repo) return customError("Merchant not found", 404, res);
		res.send({ status: "success", message: "Merchant updated successfully" });

	} catch (err: any) {
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


export const markOutsourceCasesAsExpenseHandler = async (request: Request<{}, {}, {}, { tenantId: string }>, response: Response) => {
	try {
		const { tenantId } = request.query;
		const result = await OutsourcedCases.countUnmarkedOutsourcedCases(parseInt(tenantId.toString()));
		response.send({ count: result });
	} catch (err) {
		responseError(response);
	}
}



export const markOutsourceCasesAsExpense = async (request: Request<{}, {}, {
	testid: number;
	serviceid: number;
	tracking_id: string;
	employeeid: number;
	branchid: number;
	outsourcedid: number;
}, { tenantId: string }>, response: Response): Promise<any> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		const { testid, serviceid, tracking_id, employeeid, branchid, outsourcedid } = request.body;

		if (!testid || !serviceid || !employeeid || !branchid) return customError("Required parameters missing", 400, response);

		const result = await OutsourcedCases.markOutsourceCasesAsExpense(tenantId, {
			serviceid: serviceid,
			testid: testid,
			trackingid: parseInt(tracking_id.toString()),
			branchid,
			employeeid,
			outsourcedid
		});
		response.send({ status: result });
	} catch (err: any) {
		customError(err?.message || "An error occurred while marking outsource case as expense", 500, response);
	}
};



export const markCaseAsDone = async (request: Request<{}, {}, {
	trackingId: number;
	employeeid: number;
	comments?: string;
}, { tenantId: string }>, response: Response): Promise<any> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		const { trackingId, employeeid, comments } = request.body;

		if (!trackingId || !employeeid) return customError("Required parameters missing", 400, response);

		const result = await OutsourcedCases.markOutsourceTrackingDone(tenantId, {
			trackingId,
			employeeId: employeeid,
			comments,

		});
		response.send({ status: result });
	} catch (err: any) {
		console.log(err);
		responseError(response);
	}
};

export const createExpensesAndInvoice = async (req: Request, res: Response) => {
	try {
		const { tenantId, employeeid, branchid } = req.query;
		const { expenses, invoiceData } = req.body;

		if (!tenantId || !employeeid || !branchid || !expenses) {
			return customError("Required parameters missing", 400, res);
		}

		const invoiceRepo = new ExpenseInvoiceRepo(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
		const result = await invoiceRepo.createExpensesAndInvoice(
			expenses,
			invoiceData || {}
		);
		res.send({ status: result });
	} catch (err: any) {
		console.log(err);
		responseError(res);
	}
};

export const createInvoice = async (req: Request, res: Response) => {
	try {
		const { tenantId, employeeid, branchid } = req.query;
		const invoiceData = req.body;

		if (!tenantId || !employeeid || !branchid || !invoiceData) {
			return customError("Required parameters missing", 400, res);
		}

		const invoiceRepo = new ExpenseInvoiceRepo(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
		const result = await invoiceRepo.createInvoice(invoiceData);
		res.send({ status: result });
	} catch (err: any) {
		console.log('Invoice creation error:', err.message);

		// Handle specific error types gracefully
		if (err.message.includes('not found')) {
			return customError(`Invoice cannot be created: ${err.message}`, 404, res);
		} else if (err.message.includes('must be approved')) {
			return customError(`Invoice cannot be created: ${err.message}`, 400, res);
		} else if (err.message.includes('Unauthorized')) {
			return customError('You do not have permission to create this invoice', 403, res);
		} else if (err.message.includes('Required fields are missing')) {
			return customError('Invoice data is incomplete. Please provide all required fields.', 400, res);
		} else if (err.message.includes('must be unique')) {
			return customError('Invoice number must be unique', 409, res);
		} else {
			return customError('An error occurred while creating the invoice. Please try again later.', 500, res);
		}
	}
};

export const getInvoices = async (req: Request, res: Response) => {
	try {
		const { tenantId, employeeid, branchid, page, count, status, from, to, sortby, invoiceId, expenseId } = req.query;

		if (!tenantId || !employeeid || !branchid) {
			return customError("Required parameters missing", 400, res);
		}

		const invoiceRepo = new ExpenseInvoiceRepo(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
		const sortByValue = sortby?.toString().toUpperCase();
		const validSortBy = (sortByValue === 'ASC' || sortByValue === 'DESC') ? sortByValue as 'ASC' | 'DESC' : 'DESC';

		const result = await invoiceRepo.getInvoices({
			page: page ? parseInt(page.toString()) : 1,
			count: count ? parseInt(count.toString()) : 10,
			status: status ? status.toString() : undefined,
			from: from ? from.toString() : undefined,
			to: to ? to.toString() : undefined,
			invoiceId: invoiceId ? parseInt(invoiceId.toString()) : undefined,
			expenseId: expenseId ? parseInt(expenseId.toString()) : undefined,
			sortby: validSortBy,
		});
		res.send(result);
	} catch (err: any) {
		console.log('Invoice retrieval error:', err.message);
		if (err.message.includes('Unauthorized')) {
			return customError('You do not have permission to view these invoices', 403, res);
		} else {
			return customError('An error occurred while retrieving invoices. Please try again later.', 500, res);
		}
	}
};

export const addPayment = async (req: Request, res: Response) => {
	try {
		const actor = getAuthUser(req);
		if (!actor) return customError('Authentication required', 401, res);
		const paymentData: any = req.body || {};
		const result = await new ExpensePaymentWorkflowService(actor.tenantId).record(actor, {
			expenseId: Number(paymentData.expense_id ?? paymentData.expenseId),
			invoiceId: paymentData.invoice_id ?? paymentData.invoiceId ?? null,
			paymentAccountId: Number(paymentData.payment_account_id ?? paymentData.paymentAccountId),
			amount: Number(paymentData.amount),
			paymentDate: paymentData.payment_date ?? paymentData.paymentDate,
			paymentMethod: paymentData.method ?? paymentData.payment_method ?? paymentData.paymentMethod,
			paymentReference: paymentData.payment_reference ?? paymentData.paymentReference,
			supportingDocument: paymentData.supporting_document ?? paymentData.supportingDocument,
			idempotencyKey: paymentData.idempotency_key ?? paymentData.idempotencyKey,
		});
		return res.send({ success: true, status: result, data: result });
	} catch (err: any) {
		logger.warn('Expense payment rejected', { error: err?.message || String(err) });
		const message = err?.message || 'Payment could not be processed';
		const statusCode = /not found/i.test(message) ? 404
			: /not authorized|authority|approver cannot|branch/i.test(message) ? 403
				: /already fully paid|exceeds|must be approved/i.test(message) ? 409
					: 400;
		return customError(message, statusCode, res);
	}
};

export const getPayments = async (req: Request, res: Response) => {
	try {
		const { tenantId, employeeid, branchid, invoice_id, expense_id, status, page, count } = req.query;

		if (!tenantId || !employeeid || !branchid) {
			return customError("Required parameters missing", 400, res);
		}

		const invoiceRepo = new ExpenseInvoiceRepo(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
		const result = await invoiceRepo.getPayments({
			invoice_id: invoice_id ? parseInt(invoice_id.toString()) : undefined,
			expense_id: expense_id ? parseInt(expense_id.toString()) : undefined,
			status: status ? status.toString() : undefined,
			page: page ? parseInt(page.toString()) : 1,
			count: count ? parseInt(count.toString()) : 10,
		});
		res.send(result);
	} catch (err: any) {
		if (err.message.includes('Unauthorized')) {
			return customError('You do not have permission to view these payments', 403, res);
		} else {
			// For unexpected errors, return a generic message
			return customError('An error occurred while retrieving payments. Please try again later.', 500, res);
		}
	}
};

async function createInvoicesForApprovedExpenses(invoiceRepo: ExpenseInvoiceRepo, expenseIds: number[], isBulkApproval: boolean = false): Promise<Array<{ invoiceId: number, invoiceNumber: string, expenseIds: number[], groupId?: string }>> {
	const invoiceResults: Array<{ invoiceId: number, invoiceNumber: string, expenseIds: number[], groupId?: string }> = [];

	const groupQuery = `SELECT id, groupId FROM expensesrecord WHERE id IN (${expenseIds.map(() => '?').join(',')})`;
	const expensesWithGroups = await promisifyQuery(invoiceRepo['tenantId'], groupQuery, expenseIds);

	const expensesByGroup: Record<string, number[]> = {};
	const expensesWithoutGroup: number[] = [];

	for (const expense of expensesWithGroups) {
		const groupId = expense.groupId;
		if (groupId) {
			if (!expensesByGroup[groupId]) {
				expensesByGroup[groupId] = [];
			}
			expensesByGroup[groupId].push(expense.id);
		} else {
			expensesWithoutGroup.push(expense.id);
		}
	}

	for (const [groupId, groupExpenseIds] of Object.entries(expensesByGroup)) {
		const existingInvoicesQuery = `
			SELECT DISTINCT ie.invoice_id, i.invoice_number
			FROM invoice_expenses ie
			JOIN invoices i ON ie.invoice_id = i.id
			JOIN expensesrecord er ON ie.expense_id = er.id
			WHERE er.groupId = ?
		`;
		const existingInvoices = await promisifyQuery(invoiceRepo['tenantId'], existingInvoicesQuery, [groupId]);

		if (existingInvoices.length > 0) {
			const invoiceId = existingInvoices[0].invoice_id;
			const invoiceNumber = existingInvoices[0].invoice_number;

			const invoicedExpenseIdsQuery = `
				SELECT expense_id FROM invoice_expenses ie
				JOIN expensesrecord er ON ie.expense_id = er.id
				WHERE er.groupId = ?
			`;
			const invoicedExpenses = await promisifyQuery(invoiceRepo['tenantId'], invoicedExpenseIdsQuery, [groupId]);
			const invoicedExpenseIds = new Set(invoicedExpenses.map((row: any) => row.expense_id));
			const uninvoicedExpenseIds = groupExpenseIds.filter(id => !invoicedExpenseIds.has(id));

			if (uninvoicedExpenseIds.length > 0) {
				try {
					await invoiceRepo.addExpensesToInvoice(invoiceId, uninvoicedExpenseIds);
				} catch (error) {
					logger.log(`Failed to add expenses to existing invoice ${invoiceId} for group ${groupId}:`, error);
					continue;
				}
			}

			invoiceResults.push({
				invoiceId,
				invoiceNumber,
				expenseIds: groupExpenseIds,
				groupId
			});
		} else {
			try {
				const invoiceResult = await invoiceRepo.createInvoice({
					invoice_date: new Date().toISOString().split('T')[0],
					expense_ids: groupExpenseIds
				});
				invoiceResults.push({
					invoiceId: invoiceResult.invoiceId,
					invoiceNumber: invoiceResult.invoice_number,
					expenseIds: groupExpenseIds,
					groupId
				});
			} catch (error) {
				logger.log(`Failed to create invoice for group ${groupId}:`, error);
			}
		}
	}

	for (const expenseId of expensesWithoutGroup) {
		const existingInvoicesQuery = `
			SELECT ie.invoice_id, i.invoice_number
			FROM invoice_expenses ie
			JOIN invoices i ON ie.invoice_id = i.id
			WHERE ie.expense_id = ?
		`;
		const existingInvoices = await promisifyQuery(invoiceRepo['tenantId'], existingInvoicesQuery, [expenseId]);

		if (existingInvoices.length > 0) {
			invoiceResults.push({
				invoiceId: existingInvoices[0].invoice_id,
				invoiceNumber: existingInvoices[0].invoice_number,
				expenseIds: [expenseId]
			});
		} else {
			try {
				const invoiceResult = await invoiceRepo.createInvoice({
					invoice_date: new Date().toISOString().split('T')[0],
					expense_ids: [expenseId]
				});
				invoiceResults.push({
					invoiceId: invoiceResult.invoiceId,
					invoiceNumber: invoiceResult.invoice_number,
					expenseIds: [expenseId]
				});
			} catch (error) {
				logger.log(`Failed to create invoice for expense ${expenseId}:`, error);
			}
		}
	}

	return invoiceResults;
}

export const markSupplierPaymentAsExpense = async (request: Request<{}, {}, { paymentId: string; employeeid: number; branchid: number }, { tenantId: string }>, response: Response): Promise<any> => {
	try {
		const tenantId = parseInt(request.query.tenantId.toString());
		const { paymentId, employeeid, branchid } = request.body;

		if (!paymentId || !employeeid || !branchid) {
			return customError("Required parameters missing: paymentId, employeeid, branchid", 400, response);
		}

		const result = await SupplierPaymentExpenseSync.markSupplierPaymentAsExpense(tenantId, {
			paymentId,
			employeeid,
			branchid
		});

		console.log('Supplier payment expense sync result:', result);
		response.send({ status: result });
	} catch (err) {
		console.log('Error in markSupplierPaymentAsExpense:', err);
		responseError(response);
	}
};

export const reverseExpensePayment = async (request: Request, response: Response): Promise<any> => {
	try {
		const { tenantId, employeeid } = request.query;
		const { paymentId, reversalReason } = request.body;

		// Validate required parameters
		if (!tenantId || !paymentId) {
			return customError("Missing required parameters: tenantId and paymentId", 400, response);
		}

		if (!employeeid) {
			return customError("employeeid is required", 400, response);
		}

		// Check if user is admin
		const pTenantId = parseInt(tenantId.toString());
		const pEmployeeid = parseInt(employeeid.toString());

		const userdata = await new User().getUserRole(pEmployeeid, pTenantId);
		const role = userdata ? userdata.toLowerCase().trim() : '';
		const allowedRoles = ['admin', 'super-admin'];

		if (!allowedRoles.includes(role)) {
			return customError("Only administrators can reverse payments", 403, response);
		}

		// Get branchid from query or use 0 as default
		const branchid = request.query.branchid ? parseInt(request.query.branchid.toString()) : 0;

		const paymentRow = await promisifyQuery(
			pTenantId,
			`SELECT id, expense_id, invoice_id FROM expense_payments WHERE id = ?`,
			[parseInt(paymentId.toString())]
		);

		if (!paymentRow || paymentRow.length === 0) {
			return customError(`Payment reversal failed: Payment with ID ${paymentId} not found`, 404, response);
		}

		const payment = paymentRow[0];
		const payrollPeriod = await promisifyQuery(
			pTenantId,
			`
				SELECT id
				FROM payroll_periods
				WHERE expense_payment_id = ?
					OR (? IS NOT NULL AND expense_invoice_id = ?)
					OR (? IS NOT NULL AND expense_id = ?)
				ORDER BY id DESC
				LIMIT 1
			`,
			[
				payment.id,
				payment.invoice_id,
				payment.invoice_id,
				payment.expense_id,
				payment.expense_id
			]
		);

		if (payrollPeriod && payrollPeriod.length > 0) {
			const payrollService = new PayrollReversalService(pTenantId);
			const result = await payrollService.reversePayrollPeriod({
				payroll_period_id: payrollPeriod[0].id,
				reversed_by: pEmployeeid,
				branchid,
				reason: reversalReason
			});

			return response.send({
				status: "success",
				data: result,
				message: "Payroll payment reversed successfully"
			});
		}

		const invoiceRepo = new ExpenseInvoiceRepo(pEmployeeid, branchid, pTenantId);
		const result = await invoiceRepo.reversePayment(parseInt(paymentId.toString()), reversalReason);

		response.send({
			status: "success",
			data: result,
			message: "Payment reversed successfully"
		});
	} catch (err: any) {
		console.log('Error in reverseExpensePayment:', err);

		if (err.message.includes('not found')) {
			return customError(`Payment reversal failed: ${err.message}`, 404, response);
		}

		return customError(`An error occurred while reversing the payment: ${err.message}`, 500, response);
	}
};

export const getReversedPayments = async (request: Request, response: Response): Promise<any> => {
	try {
		const { tenantId, expenseId, invoiceId, page = '1', limit = '10' } = request.query;

		// Validate required parameters
		if (!tenantId) {
			return customError("Missing required parameter: tenantId", 400, response);
		}

		const pTenantId = parseInt(tenantId.toString());
		const pageNum = Math.max(1, parseInt(page.toString()) || 1);
		const limitNum = Math.max(1, Math.min(100, parseInt(limit.toString()) || 10));
		const offset = (pageNum - 1) * limitNum;

		const invoiceRepo = new ExpenseInvoiceRepo(0, 0, pTenantId);

		let query = `
			SELECT
				epr.id AS reversal_id,
				epr.payment_id,
				epr.expense_id,
				epr.invoice_id,
				epr.reversed_amount,
				epr.reversed_by,
				epr.reversal_reason,
				epr.reversed_on,
				epr.reversal_method,
				epr.created_at,
				r.username AS reversed_by_name,
				ep.payment_date,
				ep.amount AS original_amount,
				ep.status AS original_status,
				ep.method AS payment_method,
				er.name AS expense_name,
				er.amount AS expense_amount,
				i.invoice_number,
				i.status AS invoice_status
			FROM expense_payment_reversals epr
			LEFT JOIN roles r ON epr.reversed_by = r.employeeid
			LEFT JOIN expense_payments ep ON epr.payment_id = ep.id
			LEFT JOIN expensesrecord er ON epr.expense_id = er.id
			LEFT JOIN invoices i ON epr.invoice_id = i.id
			WHERE 1=1
		`;

		const params: any[] = [];

		if (expenseId) {
			query += ` AND epr.expense_id = ?`;
			params.push(parseInt(expenseId.toString()));
		}

		if (invoiceId) {
			query += ` AND epr.invoice_id = ?`;
			params.push(parseInt(invoiceId.toString()));
		}

		// Get total count
		const countQuery = `SELECT COUNT(*) as total FROM (${query}) as cnt`;
		const countResult = await promisifyQuery(pTenantId, countQuery, params);
		const total = countResult[0]?.total || 0;

		// Get paginated data
		query += ` ORDER BY epr.reversed_on DESC LIMIT ? OFFSET ?`;
		params.push(limitNum, offset);

		const result = await promisifyQuery(pTenantId, query, params);

		response.send({
			status: "success",
			data: result,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total: total,
				totalPages: Math.ceil(total / limitNum)
			},
			message: "Reversed payments retrieved successfully"
		});
	} catch (err: any) {
		console.log('Error in getReversedPayments:', err);
		return customError(`An error occurred while retrieving reversed payments: ${err.message}`, 500, response);
	}
};
