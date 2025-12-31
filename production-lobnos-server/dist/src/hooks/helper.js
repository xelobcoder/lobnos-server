"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryableTransaction = exports.rowAffected = exports.handleOverLoad = exports.paginationQuery = exports.removeHtmlTags = exports.hasSpecialCharacters = exports.NotFound = exports.promisifyQuery = exports.responseError = exports.convertKeysToLowerCase = exports.customError = void 0;
const tenantConnections_1 = require("../models/Tenancy/tenantConnections");
const connection_1 = require("./../database/connection");
const configuration_1 = require("./configuration");
const logger_1 = __importDefault(require("./logger"));
function customError(message, statusCode, response) {
    if (!response)
        throw new TypeError("Http response object required");
    response.status(statusCode || 500).send({
        message: message || "something wrong occurred",
        statusCode: statusCode || 500,
        status: "error",
    });
}
exports.customError = customError;
function DuplicateError(response) {
    return customError(`Duplicate, item already exists`, 409, response);
}
function responseError(response, err = null, statusCode) {
    const errorMessage = err
        ? (typeof err === "string" ? err : (err.message || err.toString() || "something wrong occurred"))
        : "something wrong occurred";
    response.status(statusCode || 500).send({
        message: errorMessage,
        statusCode: 500,
        status: "error",
    });
    if (err)
        logger_1.default.error(err);
}
exports.responseError = responseError;
const removeHtmlTags = (string) => {
    const removeTags = (string, starter, ended) => {
        const _stringArray = string.trim().split("");
        let start = 0;
        let end = 0;
        for (let i = 0; i < _stringArray.length; i++) {
            if (_stringArray[i] === starter)
                start = i;
            if (_stringArray[i] === ended) {
                end = i;
                break;
            }
        }
        const unmatched = _stringArray.map((item, index) => !(index >= start && index <= end) ? item : undefined);
        const result = unmatched.join("");
        if (unmatched.includes(starter) || unmatched.includes(ended)) {
            return removeTags(result, starter, ended);
        }
        return result.toLowerCase();
    };
    return string;
};
exports.removeHtmlTags = removeHtmlTags;
function convertKeysToLowerCase(obj) {
    if (typeof obj !== "object" || Array.isArray(obj)) {
        throw new Error("Input must be an object");
    }
    const result = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            result[key.toLowerCase()] = obj[key];
        }
    }
    return result;
}
exports.convertKeysToLowerCase = convertKeysToLowerCase;
function NotFound(response) {
    response.send({ message: "Data not found", status: "error" });
}
exports.NotFound = NotFound;
async function promisifyQuery(tenantId, query, values = []) {
    if (!query || typeof query !== "string") {
        throw new Error("Query must be provided and of string type");
    }
    let connection;
    try {
        const pool = configuration_1.configuration.isMultiTenant
            ? await (0, tenantConnections_1.primeTenancyConnector)(tenantId)
            : connection_1.databaseConnectionPool;
        connection = await pool.getConnection();
        const [result] = await connection.query(query, values);
        return result;
    }
    catch (error) {
        console.log(error);
        logger_1.default.error("Database query error:", error);
        throw error;
    }
    finally {
        if (connection) {
            connection.release();
        }
    }
}
exports.promisifyQuery = promisifyQuery;
async function retryableTransaction(fn, maxRetries = 3, delayBetweenRetries = 1000) {
    let retries = 0;
    async function attempt() {
        try {
            await fn();
        }
        catch (error) {
            if (error.code === "ER_LOCK_WAIT_TIMEOUT" && retries < maxRetries) {
                retries++;
                await new Promise((resolve) => setTimeout(resolve, delayBetweenRetries));
                return attempt();
            }
            else {
                throw error;
            }
        }
    }
    await attempt();
}
exports.retryableTransaction = retryableTransaction;
async function paginationQuery(pageQuery, query, values = [], tenantId) {
    const useQuery = { count: (pageQuery === null || pageQuery === void 0 ? void 0 : pageQuery.count) || 10, page: (pageQuery === null || pageQuery === void 0 ? void 0 : pageQuery.page) || 1 };
    const { count, page } = useQuery;
    const pageSize = parseInt(`${count}`);
    const currentPage = parseInt(`${page}`) - 1;
    const offset = currentPage * pageSize;
    const newValues = [...values, pageSize, offset];
    return await promisifyQuery(tenantId, query, newValues);
}
exports.paginationQuery = paginationQuery;
const rowAffected = (result) => result.affectedRows > 0;
exports.rowAffected = rowAffected;
const hasSpecialCharacters = (param, exclude) => {
    if (exclude && !(typeof exclude === "string" || Array.isArray(exclude))) {
        throw new TypeError("Exclude should be a string or an array");
    }
    if (typeof exclude === "string")
        exclude = exclude.split("");
    let hasCharacter = false;
    const specialCharacters = [
        "!",
        "@",
        "#",
        "$",
        "%",
        "^",
        "&",
        "*",
        "(",
        ")",
        "-",
        "_",
        "=",
        "+",
        "[",
        "]",
        "{",
        "}",
        ";",
        ":",
        '"',
        "'",
        "\\",
        "|",
        ",",
        ".",
        "<",
        ">",
        "/",
        "?",
        "`",
        "~",
    ];
    for (const char of param) {
        if (specialCharacters.includes(char)) {
            hasCharacter = exclude && exclude.includes(char) ? false : true;
        }
    }
    return hasCharacter;
};
exports.hasSpecialCharacters = hasSpecialCharacters;
const handleOverLoad = (func) => {
    return async (req, res, next) => {
        try {
            await func(req, res, next);
        }
        catch (error) {
            next(error);
        }
    };
};
exports.handleOverLoad = handleOverLoad;
