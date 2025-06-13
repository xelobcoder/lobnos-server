import { Response } from "express";
import logger from "./logger";
import * as fs from 'fs';


function customError(message: string, statusCode: number, response: Response) {
    if (!response) throw new TypeError("Http response object required");
    response.status(statusCode).send({ message: message || "Something went wrong", statusCode: statusCode || 500, status: "error" });
}

export function sendFileResponse(filePath: string, res: Response) {
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({
            status: 'error',
            message: 'File not found'
        });
    }
}

export function DuplicateError(response: Response) {
    return customError("Duplicate, item already exists", 409, response);
}

export class PrimeSqlErrorHandler {
    static handleError(error: any, response: Response) {
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

    private static handleDuplicateError(response: Response) {
        const message = "Duplicate entry, item already exists";
        this.logError(message);
        return this.customError(message, 409, response);
    }

    private static handleBadFieldError(response: Response) {
        const message = "Bad field error, invalid field in the query";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleForeignKeyError(response: Response) {
        const message = "Foreign key constraint fails, invalid reference";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleParseError(response: Response) {
        const message = "Error parsing the query";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleDataTooLongError(response: Response) {
        const message = "Data too long for the field";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleNoDefaultError(response: Response) {
        const message = "Field doesn't have a default value";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleLockWaitTimeoutError(response: Response) {
        const message = "Lock wait timeout, please try again later";
        this.logError(message);
        return this.customError(message, 503, response);
    }

    private static handleRowIsReferencedError(response: Response) {
        const message = "Row is referenced by another table, cannot delete";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleUnknownError(response: Response) {
        const message = "An unknown error occurred";
        this.logError(message);
        return this.customError(message, 500, response);
    }

    private static handleTableExistsError(response: Response) {
        const message = "Table already exists";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleTableNotLockedError(response: Response) {
        const message = "Table is not locked";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleCantCreateTableError(response: Response) {
        const message = "Unable to create table";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleInternalError(response: Response) {
        const message = "Internal MySQL error";
        this.logError(message);
        return this.customError(message, 500, response);
    }

    private static handleSyntaxError(response: Response) {
        const message = "SQL syntax error";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleAccessDeniedError(response: Response) {
        const message = "Access denied for the user";
        this.logError(message);
        return this.customError(message, 403, response);
    }

    private static handleBadDbError(response: Response) {
        const message = "Bad database error";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleNoSuchTableError(response: Response) {
        const message = "No such table exists";
        this.logError(message);
        return this.customError(message, 404, response);
    }

    private static handleNonUniqError(response: Response) {
        const message = "Non-unique error, duplicate data";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleUserLimitReachedError(response: Response) {
        const message = "User limit reached";
        this.logError(message);
        return this.customError(message, 429, response);
    }

    private static handleQueryTimeoutError(response: Response) {
        const message = "Query timeout, please try again";
        this.logError(message);
        return this.customError(message, 408, response);
    }

    private static handleOutOfMemoryError(response: Response) {
        const message = "Out of memory error";
        this.logError(message);
        return this.customError(message, 500, response);
    }

    private static handleTooManyConnectionsError(response: Response) {
        const message = "Too many connections, please try again later";
        this.logError(message);
        return this.customError(message, 503, response);
    }

    private static handleConnectionCountError(response: Response) {
        const message = "Too many connections, connection count exceeded";
        this.logError(message);
        return this.customError(message, 503, response);
    }

    private static handleUnknownTableError(response: Response) {
        const message = "Unknown table error";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleCantCreateDbError(response: Response) {
        const message = "Can't create database";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleDbCreateExistsError(response: Response) {
        const message = "Database already exists";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static handleFkColumnCannotChangeError(response: Response) {
        const message = "Foreign key column cannot change";
        this.logError(message);
        return this.customError(message, 400, response);
    }

    private static logError(message: string) {
        logger.error(message); 
    }

    private static customError(message: string, statusCode: number, response: Response) {
        if (!response) throw new TypeError("Http response object required");
        response.status(statusCode).send({ message: message || "Something went wrong", statusCode: statusCode || 500, status: "error" });
    }

    static handleGenericError(error:any, response:Response) {
        return customError("somethingwrongoccured", 500, response);
    }
}
