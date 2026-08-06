"use strict";
/**
 * MySQL Error Code Mappings for Human-Readable Messages
 * For security purposes, these messages avoid exposing sensitive database details.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlErrorMappings = void 0;
exports.getMySqlErrorMessage = getMySqlErrorMessage;
exports.mysqlErrorMappings = {
    // Duplicate entry errors
    'ER_DUP_ENTRY': {
        statusCode: 409,
        message: 'Duplicate entry - this item already exists.'
    },
    // Field-related errors
    'ER_BAD_FIELD_ERROR': {
        statusCode: 400,
        message: 'Invalid field specified in the request.'
    },
    'ER_NO_SUCH_COLUMN': {
        statusCode: 400,
        message: 'Invalid field specified in the request.'
    },
    // Foreign key constraint errors
    'ER_NO_REFERENCED_ROW_2': {
        statusCode: 400,
        message: 'Cannot perform this action due to related data constraints.'
    },
    'ER_ROW_IS_REFERENCED': {
        statusCode: 409,
        message: 'Cannot delete this item as it is referenced by other records.'
    },
    'ER_ROW_IS_REFERENCED_2': {
        statusCode: 409,
        message: 'Cannot delete this item as it is referenced by other records.'
    },
    // Syntax and parsing errors
    'ER_PARSE_ERROR': {
        statusCode: 400,
        message: 'Invalid query syntax.'
    },
    'ER_SYNTAX_ERROR': {
        statusCode: 400,
        message: 'Invalid query syntax.'
    },
    // Data length and type errors
    'ER_DATA_TOO_LONG': {
        statusCode: 400,
        message: 'Data provided exceeds the allowed length.'
    },
    'ER_TRUNCATED_WRONG_VALUE': {
        statusCode: 400,
        message: 'Invalid data format provided.'
    },
    'ER_WRONG_VALUE_FOR_TYPE': {
        statusCode: 400,
        message: 'Invalid data format provided.'
    },
    // Missing or default value errors
    'ER_NO_DEFAULT': {
        statusCode: 400,
        message: 'Required field is missing.'
    },
    'ER_NO_DEFAULT_FOR_FIELD': {
        statusCode: 400,
        message: 'Required field is missing.'
    },
    // Table and database errors
    'ER_TABLE_EXISTS_ERROR': {
        statusCode: 409,
        message: 'Table already exists.'
    },
    'ER_NO_SUCH_TABLE': {
        statusCode: 404,
        message: 'Requested table does not exist.'
    },
    'ER_BAD_TABLE_ERROR': {
        statusCode: 404,
        message: 'Requested table does not exist.'
    },
    // Access and permission errors
    'ER_ACCESS_DENIED_ERROR': {
        statusCode: 403,
        message: 'Access denied to database.'
    },
    'ER_DBACCESS_DENIED_ERROR': {
        statusCode: 403,
        message: 'Access denied to database.'
    },
    // Connection and timeout errors
    'ER_LOCK_WAIT_TIMEOUT': {
        statusCode: 408,
        message: 'Database operation timed out. Please try again.'
    },
    'ER_LOCK_DEADLOCK': {
        statusCode: 409,
        message: 'Database conflict occurred. Please try again.'
    },
    // Transaction errors
    'ER_CHECK_CONSTRAINT_VIOLATION': {
        statusCode: 400,
        message: 'Data validation failed.'
    },
    'ER_CONSTRAINT_VIOLATION': {
        statusCode: 400,
        message: 'Data validation failed.'
    },
    // Index and key errors
    'ER_DUP_KEY': {
        statusCode: 409,
        message: 'Duplicate key value.'
    },
    'ER_KEY_NOT_FOUND': {
        statusCode: 404,
        message: 'Referenced key does not exist.'
    },
    // General database errors
    'ER_UNKNOWN_ERROR': {
        statusCode: 500,
        message: 'An unexpected database error occurred.'
    },
    'ER_INTERNAL_ERROR': {
        statusCode: 500,
        message: 'An internal database error occurred.'
    },
    // Connection errors
    'ER_BAD_DB_ERROR': {
        statusCode: 500,
        message: 'Database connection error.'
    },
    'ER_SERVER_SHUTDOWN': {
        statusCode: 503,
        message: 'Database server is temporarily unavailable.'
    },
    // Additional common errors
    'ER_TOO_MANY_CONNECTIONS': {
        statusCode: 503,
        message: 'Database is currently overloaded. Please try again later.'
    },
    'ER_OUT_OF_MEMORY': {
        statusCode: 500,
        message: 'Database memory error.'
    },
    'ER_DISK_FULL': {
        statusCode: 500,
        message: 'Database storage is full.'
    }
};
/**
 * Function to get human-readable error message for a given MySQL error code
 * @param errorCode - The MySQL error code (e.g., 'ER_DUP_ENTRY')
 * @returns Object with statusCode and message, or default if not found
 */
function getMySqlErrorMessage(errorCode) {
    return exports.mysqlErrorMappings[errorCode] || {
        statusCode: 500,
        message: 'An unexpected error occurred.'
    };
}
