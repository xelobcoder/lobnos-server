"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.allFieldsHasValues = exports.getCategory = exports.postCategory = exports.putCategory = exports.deleteCategory = void 0;
const logger_1 = __importDefault(require("../hooks/logger"));
const helper_1 = require("../hooks/helper");
const queries_1 = require("./queries");
function allFieldsHasValues(req) {
    const values = Object.values(req.body).filter((value) => value === "");
    return values.length === 0;
}
exports.allFieldsHasValues = allFieldsHasValues;
async function categoryExists(tenantId, category) {
    const packets = await (0, helper_1.promisifyQuery)(tenantId, queries_1.QUERIES.SELECT_CATEGORY_BY_ID, [category]);
    return packets.length > 0;
}
const postCategory = async (req, res) => {
    if (allFieldsHasValues(req)) {
        const tenantId = parseInt(req.query.tenantId.toString());
        try {
            const exists = await categoryExists(tenantId, req.body.category);
            if (exists) {
                res.status(409).send({
                    statusCode: 409,
                    message: "Category already exists",
                });
            }
            else {
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.QUERIES.INSERT_CATEGORY, [req.body.category, req.body.description]);
                res.status(201).send({
                    statusCode: 201,
                    status: "success",
                    message: "Category created successfully",
                });
            }
        }
        catch (err) {
            logger_1.default.error(err);
            res.status(500).send({ message: "Internal server error" });
        }
    }
    else {
        res.status(400).send({
            message: "All fields are required",
        });
    }
};
exports.postCategory = postCategory;
const getCategory = async (req, res) => {
    try {
        if (Object.keys(req.query).length > 0) {
            const { id } = req.query;
            const tenantId = parseInt(req.query.tenantId.toString());
            if (isNaN(Number(id))) {
                res.status(400).send({
                    message: "Id must be a number",
                });
            }
            else {
                const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.QUERIES.SELECT_CATEGORY_BY_ID, [id]);
                res.send(result);
            }
        }
        else {
            const tenantId = parseInt(req.query.tenantId.toString());
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.QUERIES.SELECT_ALL_CATEGORIES);
            res.send(result);
        }
    }
    catch (err) {
        logger_1.default.error(err);
        res.status(500).send({ message: "Internal server error" });
    }
};
exports.getCategory = getCategory;
const putCategory = async (req, res) => {
    const { category, description } = req.body;
    const { id } = req.params;
    if (!category || !description) {
        res.status(400).send({
            message: "All fields are required",
        });
    }
    else {
        if (allFieldsHasValues(req)) {
            try {
                const tenantId = parseInt(req.query.tenantId.toString());
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.QUERIES.UPDATE_CATEGORY, [category, description, id]);
                res.send({
                    message: "Category updated successfully",
                });
            }
            catch (err) {
                logger_1.default.error(err);
                res.status(500).send({ message: "Internal server error" });
            }
        }
        else {
            res.status(400).send({
                message: "All fields must have values",
            });
        }
    }
};
exports.putCategory = putCategory;
const deleteCategory = async (req, res) => {
    try {
        if (Object.keys(req.query).length > 0) {
            const { id } = req.query;
            const tenantId = parseInt(req.query.tenantId.toString());
            if (isNaN(Number(id))) {
                res.status(400).send({
                    message: "Id must be a number",
                });
            }
            else {
                await (0, helper_1.promisifyQuery)(tenantId, queries_1.QUERIES.DELETE_CATEGORY, [id]);
                res.send({
                    message: "Category deleted successfully",
                });
            }
        }
    }
    catch (err) {
        logger_1.default.error(err);
        res.status(500).send({ message: "Internal server error" });
    }
};
exports.deleteCategory = deleteCategory;
