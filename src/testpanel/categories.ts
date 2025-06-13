import { Request, Response } from "express";
import logger from "../hooks/logger";
import { promisifyQuery } from "../hooks/helper";
import { QUERIES } from "./queries";

function allFieldsHasValues(req: Request): boolean {
	const values = Object.values(req.body).filter((value) => value === "");
	return values.length === 0;
}

async function categoryExists(tenantId: number, category: string): Promise<boolean> {
	const packets = await promisifyQuery(tenantId, QUERIES.SELECT_CATEGORY_BY_ID, [category]);
	return packets.length > 0;
}

const postCategory = async (req: Request, res: Response) => {
	if (allFieldsHasValues(req)) {
		const tenantId = parseInt(req.query.tenantId.toString());
		try {
			const exists = await categoryExists(tenantId, req.body.category);
			if (exists) {
				res.status(409).send({
					statusCode: 409,
					message: "Category already exists",
				});
			} else {
				await promisifyQuery(tenantId, QUERIES.INSERT_CATEGORY, [req.body.category, req.body.description]);
				res.status(201).send({
					statusCode: 201,
					status: "success",
					message: "Category created successfully",
				});
			}
		} catch (err) {
			logger.error(err);
			res.status(500).send({ message: "Internal server error" });
		}
	} else {
		res.status(400).send({
			message: "All fields are required",
		});
	}
};

const getCategory = async (req: Request, res: Response) => {
	try {
		if (Object.keys(req.query).length > 0) {
			const { id } = req.query;
			const tenantId = parseInt(req.query.tenantId.toString());
			if (isNaN(Number(id))) {
				res.status(400).send({
					message: "Id must be a number",
				});
			} else {
				const result = await promisifyQuery(tenantId, QUERIES.SELECT_CATEGORY_BY_ID, [id]);
				res.send(result);
			}
		} else {
			const tenantId = parseInt(req.query.tenantId.toString());
			const result = await promisifyQuery(tenantId, QUERIES.SELECT_ALL_CATEGORIES);
			res.send(result);
		}
	} catch (err) {
		logger.error(err);
		res.status(500).send({ message: "Internal server error" });
	}
};

const putCategory = async (req: Request, res: Response) => {
	const { category, description } = req.body;
	const { id } = req.params;

	if (!category || !description) {
		res.status(400).send({
			message: "All fields are required",
		});
	} else {
		if (allFieldsHasValues(req)) {
			try {
				const tenantId = parseInt(req.query.tenantId.toString());
				await promisifyQuery(tenantId, QUERIES.UPDATE_CATEGORY, [category, description, id]);
				res.send({
					message: "Category updated successfully",
				});
			} catch (err) {
				logger.error(err);
				res.status(500).send({ message: "Internal server error" });
			}
		} else {
			res.status(400).send({
				message: "All fields must have values",
			});
		}
	}
};

const deleteCategory = async (req: Request, res: Response) => {
	try {
		if (Object.keys(req.query).length > 0) {
			const { id } = req.query;
			const tenantId = parseInt(req.query.tenantId.toString());
			if (isNaN(Number(id))) {
				res.status(400).send({
					message: "Id must be a number",
				});
			} else {
				await promisifyQuery(tenantId, QUERIES.DELETE_CATEGORY, [id]);
				res.send({
					message: "Category deleted successfully",
				});
			}
		}
	} catch (err) {
		logger.error(err);
		res.status(500).send({ message: "Internal server error" });
	}
};

export { deleteCategory, putCategory, postCategory, getCategory, allFieldsHasValues };