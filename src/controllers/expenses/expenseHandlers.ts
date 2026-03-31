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
		const expensesInstance = initializeExpense(req.query as unknown as ExpenseQueryType);
		const requestBody = req.body;

		if (Array.isArray(requestBody)) {
			if (requestBody.length === 0) {
				return customError("Expenses array cannot be empty", 400, res);
			}

			if (requestBody.length > 50) {
				return customError("Maximum 50 expenses can be created at once", 400, res);
			}

			const result = await expensesInstance.generateBulkExpenses(requestBody);
			res.send(result);
		} else if (typeof requestBody === 'object' && requestBody !== null) {
			const expenseId = await expensesInstance.generateNewExpense(requestBody);
			res.send({ status: expenseId });
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
		const result = await expensesInstance.getExpensesByGroup(Number(tenantId), groupId);
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
		const { expenseid, tenantId } = request.query;
		const expenseData = request.body;

		if (!expenseid || !expenseData.employeeid || !expenseData.branchid) {
			return customError("Missing required identifiers", 404, response);
		}

		const expenses = initializeExpense({
			employeeid: expenseData.employeeid,
			branchid: expenseData.branchid,
			tenantId: parseInt(tenantId.toString()),
			expenseId: parseInt(expenseid.toString())
		});

		const result = await expenses.updateExpenseRecord(expenseData as unknown as PrimeLimsTableexpensesrecord);

		if (typeof result === "string") {
			return customError(result, 400, response);
		}

		response.send({ status: result });
	} catch (err: any) {
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

export const updateExpenseDecision = async (req: Request<{}, {}, {
	expenseid: number;
	status: string;
	information?: string;
	employeeid: number;
	branchid: number;
}, { tenantId: string, employeeid?: string, branchid?: string }>, res: Response) => {
	try {
		const { expenseid, employeeid, status, information, branchid } = req.body;
		const { tenantId } = req.query;

		if (Array.isArray(req.body)) {
			const decisions = req.body;

			if (decisions.length === 0) {
				return customError("Decisions array cannot be empty", 400, res);
			}

			if (decisions.length > 50) {
				return customError("Maximum 50 decisions can be processed at once", 400, res);
			}

			for (const decision of decisions) {
				if (!decision.expenseid || !decision.status) {
					return customError("Each decision must have expenseid and status", 400, res);
				}
				if (!['pending', 'approved', 'rejected'].includes(decision.status)) {
					return customError("Status must be 'pending', 'approved', or 'rejected'", 400, res);
				}
			}

			const decisionsByStatus: Record<string, Array<{ expenseid: number, information: string, employeeid: number, status: string }>> = {};
			for (const decision of decisions) {
				if (!decisionsByStatus[decision.status]) {
					decisionsByStatus[decision.status] = [];
				}
				decisionsByStatus[decision.status].push(decision);
			}

			const expenses = initializeExpense({
				employeeid: parseInt(employeeid?.toString() || req.query.employeeid?.toString() || '0'),
				branchid: parseInt(branchid?.toString() || req.query.branchid?.toString() || '0'),
				tenantId: parseInt(tenantId?.toString() || '0'),
				expenseId: null
			});

			let approverEmployeeId = parseInt(employeeid?.toString() || req.query.employeeid?.toString() || '0');
			let approverBranchId = parseInt(branchid?.toString() || req.query.branchid?.toString() || '0');

			if (approverEmployeeId === 0 && decisions.length > 0) {
				const firstExpenseQuery = 'SELECT employeeid, branchid FROM expensesrecord WHERE id = ?';
				const firstExpense = await promisifyQuery(parseInt(tenantId.toString()), firstExpenseQuery, [decisions[0].expenseid]);
				if (firstExpense.length > 0) {
					approverEmployeeId = firstExpense[0].employeeid;
					approverBranchId = firstExpense[0].branchid;
				}
			}

			const results = [];
			for (const [status, statusDecisions] of Object.entries(decisionsByStatus)) {
				const decisionsForService = statusDecisions.map(({ status: _, ...rest }) => rest);
				const result = await expenses.updateExpenseDecision(parseInt(tenantId.toString()), status, decisionsForService);

				if (status === 'approved' && result) {
					try {
						const invoiceRepo = new ExpenseInvoiceRepo(
							approverEmployeeId,
							approverBranchId,
							parseInt(tenantId.toString())
						);

						const approvedExpenseIds = statusDecisions.map(d => d.expenseid);
						const invoiceResults = await createInvoicesForApprovedExpenses(invoiceRepo, approvedExpenseIds, true);

						results.push({
							status,
							success: true,
							count: statusDecisions.length,
							invoices: invoiceResults,
							message: "Expenses approved and invoices created"
						});
					} catch (invoiceError: any) {
						results.push({
							status,
							success: true,
							count: statusDecisions.length,
							message: "Expenses approved, but invoice creation failed",
							error: invoiceError.message
						});
					}
				} else {
					results.push({ status, success: result, count: statusDecisions.length });
				}
			}

			res.send({ results });
		} else if (!Array.isArray(req.body) && 'decisions' in req.body && Array.isArray(req.body.decisions)) {
			const { status, decisions } = req.body as { status: string; decisions: Array<any> };

			if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
				return customError("Valid status is required for bulk decisions", 400, res);
			}

			if (decisions.length === 0) {
				return customError("Decisions array cannot be empty", 400, res);
			}

			if (decisions.length > 50) {
				return customError("Maximum 50 decisions can be processed at once", 400, res);
			}

			for (const decision of decisions) {
				if (!decision.expenseid || typeof decision.employeeid !== 'number') {
					return customError("Each decision must have expenseid and employeeid", 400, res);
				}
			}

			const expenses = initializeExpense({
				employeeid: parseInt(employeeid?.toString() || req.query.employeeid?.toString() || '0'),
				branchid: parseInt(branchid?.toString() || req.query.branchid?.toString() || '0'),
				tenantId: parseInt(tenantId?.toString() || '0'),
				expenseId: null
			});

			let approverEmployeeId = parseInt(employeeid?.toString() || req.query.employeeid?.toString() || '0');
			let approverBranchId = parseInt(branchid?.toString() || req.query.branchid?.toString() || '0');

			if (approverEmployeeId === 0 && decisions.length > 0) {
				const firstExpenseQuery = 'SELECT employeeid, branchid FROM expensesrecord WHERE id = ?';
				const firstExpense = await promisifyQuery(parseInt(tenantId.toString()), firstExpenseQuery, [decisions[0].expenseid]);
				if (firstExpense.length > 0) {
					approverEmployeeId = firstExpense[0].employeeid;
					approverBranchId = firstExpense[0].branchid;
				}
			}

			const result = await expenses.updateExpenseDecision(parseInt(tenantId.toString()), status, decisions);

			if (status === 'approved' && result) {
				try {
					const invoiceRepo = new ExpenseInvoiceRepo(
						approverEmployeeId,
						approverBranchId,
						parseInt(tenantId.toString())
					);
					const approvedExpenseIds = decisions.map((d: { expenseid: number }) => d.expenseid);

					const invoiceResults = await createInvoicesForApprovedExpenses(invoiceRepo, approvedExpenseIds, true);

					res.send({
						success: true,
						count: decisions.length,
						invoices: invoiceResults,
						message: "Expenses approved and invoices created"
					});
				} catch (invoiceError: any) {
					res.send({
						success: true,
						count: decisions.length,
						message: "Expenses approved, but invoice creation failed",
						error: invoiceError.message
					});
				}
			} else {
				res.send({ success: result, count: decisions.length });
			}
		} else {
			if (!employeeid || !branchid || !expenseid || !status) {
				return customError("Missing required decision parameters", 400, res);
			}

			const expenses = initializeExpense({
				employeeid: parseInt(employeeid.toString()),
				branchid: parseInt(branchid.toString()),
				tenantId: parseInt(tenantId?.toString() || '0'),
				expenseId: parseInt(expenseid.toString())
			});

			const decisions = [{ expenseid: parseInt(expenseid.toString()), information: information || '', employeeid: parseInt(employeeid.toString()) }];
			const result = await expenses.updateExpenseDecision(
				parseInt(tenantId?.toString() || '0'),
				status,
				decisions
			);

			if (status === 'approved' && result) {
				try {
					const invoiceRepo = new ExpenseInvoiceRepo(
						parseInt(employeeid.toString()),
						parseInt(branchid.toString()),
						parseInt(tenantId?.toString() || '0')
					);

					const invoiceResults = await createInvoicesForApprovedExpenses(invoiceRepo, [parseInt(expenseid.toString())], false);

					res.send({
						success: true,
						invoices: invoiceResults,
						message: "Expense approved and invoice created"
					});
				} catch (invoiceError: any) {
					res.send({
						success: true,
						message: "Expense approved, but invoice creation failed",
						error: invoiceError.message
					});
				}
			} else {
				res.send({ success: result });
			}
		}
	} catch (err) {
		console.log(err);
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
		const { tenantId, employeeid, branchid, page, count, status, from, to, sortby } = req.query;

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
		const { tenantId, employeeid, branchid } = req.query;
		const paymentData = req.body;

		if (!tenantId || !employeeid || !branchid || !paymentData) {
			return customError("Required parameters missing", 400, res);
		}

		const invoiceRepo = new ExpenseInvoiceRepo(parseInt(employeeid.toString()), parseInt(branchid.toString()), parseInt(tenantId.toString()));
		const result = await invoiceRepo.addPayment(paymentData);
		res.send({ status: result });
	} catch (err: any) {
		console.log('Payment creation error:', err.message);

		// Handle specific error types gracefully
		if (err.message.includes('not found in the system')) {
			return customError(`Payment cannot be processed: ${err.message}`, 404, res);
		} else if (err.message.includes('must be approved first')) {
			return customError(`Payment cannot be processed: ${err.message}`, 400, res);
		} else if (err.message.includes('Unauthorized')) {
			return customError('You do not have permission to add payment for this expense', 403, res);
		} else if (err.message.includes('Required fields are missing')) {
			return customError('Payment data is incomplete. Please provide all required fields.', 400, res);
		} else {
			// For unexpected errors, return a generic message but don't crash the server
			return customError('An error occurred while processing the payment. Please try again later.', 500, res);
		}
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