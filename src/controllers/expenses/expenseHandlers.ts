import { Request, Response } from "express";
import Expenses from "../../models/Expenses/ExpenseService";
import path from "node:path";
import { customError, responseError } from "../../hooks/helper";
import { RECEIPTS_PATH } from "../../models/Expenses/queries";


export const generateNewExpense = async (req: Request, res: Response) => {
	try {
		const { tenantId } = req.query;
		const expenses = new Expenses(null, null);
		const status = await expenses.generateNewExpense(parseInt(tenantId.toString()), req.body);
		res.send({ status });
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const getExpensesRecord = async (req: Request, res: Response) => {
	try {
		const { employeeid, branchid, count, page, status, from, to, tenantId } = req.query;
		if (!employeeid) {
			return customError("employeeid required", 404, res);
		}
		const expenses = new Expenses(null, null);
		const records = await expenses.getExpensesRecord(
			parseInt(tenantId.toString()),
			parseInt(employeeid.toString()),
			parseInt(branchid.toString()),
			status?.toString(),
			{ page: parseInt(page?.toString() || '1'), count: parseInt(count?.toString() || '10') },
			from?.toString(),
			to?.toString()
		);
		res.send(records);
	} catch (err) {
		console.log(err)
		responseError(res)
	}
};

export const getSingleExpense = async (req: Request, res: Response) => {
	try {
		const { expenseid, tenantId } = req.query;
		if (!expenseid) {
			return customError("expenseid not provided", 404, res);
		}
		const expenses = new Expenses(null, null);
		const record = await expenses.getSingleExpense(parseInt(tenantId.toString()), expenseid.toString());
		res.send(record);
	} catch (err) {
		if (err?.message) {
			res.send({ status: "error", err });
		} else {
			return responseError(res);
		}
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
		if (!imageid) {
			return customError("image not provided", 404, res);
		}
		res.sendFile(path.join(__dirname, RECEIPTS_PATH,`${imageid}`));
	} catch (err) {
		responseError(res);
	}
};

export const getExpenseImageList = async (req: Request, res: Response) => {
	const { expenseid } = req.query;
	if (!expenseid) {
		return customError("expenseid not provided", 404, res);
	}
	const expenses = new Expenses(null, null);
	const result = await expenses.getExpenseImageList(expenseid.toString());
	res.send(result);
};

export const deleteReceiptsList = async (req: Request, res: Response) => {
	const { data } = req.body;
	if (data && Array.isArray(data) && data.length > 0) {
		const expenses = new Expenses(null, null);
		const status = await expenses.deleteReceiptsList(data);
		res.send({ status: status ? "success" : "failed" });
	} else {
		return customError("image List not provided", 404, res);
	}
};

export const updateExpenseDecision = async (req: Request, res: Response) => {
	try {
		const { expenseid, employeeid, status, information } = req.body;
		const { tenantId } = req.query;
		const expenses = new Expenses(employeeid, null);
		const result = await expenses.updateExpenseDecision(parseInt(tenantId.toString()), status, expenseid, information, employeeid);
		res.send({ status: result === true ? "success" : "failed" });
	} catch (err) {
		responseError(res);
	}
};

export const createExpenseCategory = async (req: Request, res: Response) => {
	try {
		const { category, employeeid } = req.body;
		const { tenantId } = req.query;
		if (!employeeid || !category) {
			return customError("employeeid and expense category required", 404, res);
		}
		const expenses = new Expenses(employeeid, null);
		const expenseCreation = await expenses.createExpenseCategory(parseInt(tenantId.toString()), category, employeeid);
		if (typeof expenseCreation === "boolean") {
			return expenseCreation === true
				? res.send({ message: "category created successfully", statusCode: 200, status: "success" })
				: res.send({ message: "category creation failed", statusCode: 200, status: "failed" });
		}

		if (typeof expenseCreation === "string" && expenseCreation.trim() === "category exist") {
			res.send({ message: "category already exist", statusCode: 200, status: "success" });
		}
	} catch (err) {
		console.log(err);
		responseError(res);
	}
};

export const updateExpenseCategory = async (req: Request, res: Response) => {
	try {
		const { category, employeeid, editid } = req.body;
		const { tenantId } = req.query;
		if (!employeeid || !category || !editid) {
			return customError("employeeid, expense category and category id required", 404, res);
		}
		const expenses = new Expenses(employeeid, null);
		const updateExpenseCategory = await expenses.updateExpenseCategory(parseInt(tenantId.toString()), editid, category);
		res.send({ status: updateExpenseCategory });
	} catch (err) {
		responseError(res);
	}
};

export const getAllExpenseCategory = async (req: Request, res: Response) => {
	try {
		const { tenantId } = req.query;
		const expenses = new Expenses(null, null);
		const expensecategories = await expenses.getAllExpenseCategory(parseInt(tenantId.toString()));
		res.send(expensecategories);
	} catch (err) {
		responseError(res);
	}
};
