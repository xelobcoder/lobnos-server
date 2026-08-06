"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrimeSqlErrorHandler = void 0;
exports.sendFileResponse = sendFileResponse;
exports.DuplicateError = DuplicateError;
const logger_1 = __importDefault(require("./logger"));
const fs = __importStar(require("fs"));
function customError(message, statusCode, response) {
    if (!response)
        throw new TypeError("Http response object required");
    response.status(statusCode).send({ message: message || "Something went wrong", statusCode: statusCode || 500, status: "error" });
}
function sendFileResponse(filePath, res) {
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    }
    else {
        res.status(404).json({
            status: 'error',
            message: 'File not found'
        });
    }
}
function DuplicateError(response) {
    return customError("Duplicate, item already exists", 409, response);
}
class PrimeSqlErrorHandler {
    static handleError(error, response) {
        if (!error.code) {
            return this.handleGenericError(error, response);
        }
        switch (error.code) {
            case "ER_DUP_ENTRY":
                return this.handleDuplicateError(response);
            case "ER_BAD_FIELD_ERROR":
                return this.handleBadFieldError(response);
            case "ER_NO_REFERENCED_ROW_2":
                return this.handleForeignKeyError(response);
            case "ER_PARSE_ERROR":
                return this.handleParseError(response);
            case "ER_DATA_TOO_LONG":
                return this.handleDataTooLongError(response);
            case "ER_NO_DEFAULT":
                return this.handleNoDefaultError(response);
            case "ER_LOCK_WAIT_TIMEOUT":
                return this.handleLockWaitTimeoutError(response);
            case "ER_ROW_IS_REFERENCED":
                return this.handleRowIsReferencedError(response);
            case "ER_UNKNOWN_ERROR":
                return this.handleUnknownError(response);
            case "ER_TABLE_EXISTS_ERROR":
                return this.handleTableExistsError(response);
            case "ER_TABLE_NOT_LOCKED":
                return this.handleTableNotLockedError(response);
            case "ER_CANT_CREATE_TABLE":
                return this.handleCantCreateTableError(response);
            case "ER_INTERNAL_ERROR":
                return this.handleInternalError(response);
            case "ER_SYNTAX_ERROR":
                return this.handleSyntaxError(response);
            case "ER_ACCESS_DENIED_ERROR":
                return this.handleAccessDeniedError(response);
            case "ER_BAD_DB_ERROR":
                return this.handleBadDbError(response);
            case "ER_NO_SUCH_TABLE":
                return this.handleNoSuchTableError(response);
            case "ER_NON_UNIQ_ERROR":
                return this.handleNonUniqError(response);
            case "ER_USER_LIMIT_REACHED":
                return this.handleUserLimitReachedError(response);
            case "ER_QUERY_TIMEOUT":
                return this.handleQueryTimeoutError(response);
            case "ER_OUTOFMEMORY":
                return this.handleOutOfMemoryError(response);
            case "ER_TOO_MANY_USER_CONNECTIONS":
                return this.handleTooManyConnectionsError(response);
            case "ER_CON_COUNT_ERROR":
                return this.handleConnectionCountError(response);
            case "ER_UNKNOWN_TABLE":
                return this.handleUnknownTableError(response);
            case "ER_CANT_CREATE_DB":
                return this.handleCantCreateDbError(response);
            case "ER_DB_CREATE_EXISTS":
                return this.handleDbCreateExistsError(response);
            case "ER_FK_COLUMN_CANNOT_CHANGE":
                return this.handleFkColumnCannotChangeError(response);
            default:
                return this.handleUnknownError(response);
        }
    }
    static handleDuplicateError(response) {
        const message = "Duplicate entry, item already exists";
        this.logError(message);
        return this.customError(message, 409, response);
    }
    static handleBadFieldError(response) {
        const message = "Bad field error, invalid field in the query";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleForeignKeyError(response) {
        const message = "Foreign key constraint fails, invalid reference";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleParseError(response) {
        const message = "Error parsing the query";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleDataTooLongError(response) {
        const message = "Data too long for the field";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleNoDefaultError(response) {
        const message = "Field doesn't have a default value";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleLockWaitTimeoutError(response) {
        const message = "Lock wait timeout, please try again later";
        this.logError(message);
        return this.customError(message, 503, response);
    }
    static handleRowIsReferencedError(response) {
        const message = "Row is referenced by another table, cannot delete";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleUnknownError(response) {
        const message = "An unknown error occurred";
        this.logError(message);
        return this.customError(message, 500, response);
    }
    static handleTableExistsError(response) {
        const message = "Table already exists";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleTableNotLockedError(response) {
        const message = "Table is not locked";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleCantCreateTableError(response) {
        const message = "Unable to create table";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleInternalError(response) {
        const message = "Internal MySQL error";
        this.logError(message);
        return this.customError(message, 500, response);
    }
    static handleSyntaxError(response) {
        const message = "SQL syntax error";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleAccessDeniedError(response) {
        const message = "Access denied for the user";
        this.logError(message);
        return this.customError(message, 403, response);
    }
    static handleBadDbError(response) {
        const message = "Bad database error";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleNoSuchTableError(response) {
        const message = "No such table exists";
        this.logError(message);
        return this.customError(message, 404, response);
    }
    static handleNonUniqError(response) {
        const message = "Non-unique error, duplicate data";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleUserLimitReachedError(response) {
        const message = "User limit reached";
        this.logError(message);
        return this.customError(message, 429, response);
    }
    static handleQueryTimeoutError(response) {
        const message = "Query timeout, please try again";
        this.logError(message);
        return this.customError(message, 408, response);
    }
    static handleOutOfMemoryError(response) {
        const message = "Out of memory error";
        this.logError(message);
        return this.customError(message, 500, response);
    }
    static handleTooManyConnectionsError(response) {
        const message = "Too many connections, please try again later";
        this.logError(message);
        return this.customError(message, 503, response);
    }
    static handleConnectionCountError(response) {
        const message = "Too many connections, connection count exceeded";
        this.logError(message);
        return this.customError(message, 503, response);
    }
    static handleUnknownTableError(response) {
        const message = "Unknown table error";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleCantCreateDbError(response) {
        const message = "Can't create database";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleDbCreateExistsError(response) {
        const message = "Database already exists";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static handleFkColumnCannotChangeError(response) {
        const message = "Foreign key column cannot change";
        this.logError(message);
        return this.customError(message, 400, response);
    }
    static logError(message) {
        logger_1.default.error(message);
    }
    static customError(message, statusCode, response) {
        if (!response)
            throw new TypeError("Http response object required");
        response.status(statusCode).send({ message: message || "Something went wrong", statusCode: statusCode || 500, status: "error" });
    }
    static handleGenericError(error, response) {
        return customError("somethingwrongoccured", 500, response);
    }
}
exports.PrimeSqlErrorHandler = PrimeSqlErrorHandler;
