"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiifuWorkingClass = void 0;
const helper_1 = require("../hooks/helper");
const KnexConnections_1 = __importDefault(require("./KnexConnections"));
const queries_1 = require("./queries");
class TiifuWorkingClass {
    constructor(tablename) {
        this.checkColumnExists = async (columnName) => {
            const query = queries_1.q_tiifu_findColumn.replace("tableName", this.tableName).replace("columnName", columnName);
            const result = await this.connection(1, query);
            return result.length > 0;
        };
        this.createColumnIfNotExists = async (tenantId, columnName, constraint) => {
            const columnExists = await this.checkColumnExists(columnName);
            if (!columnExists) {
                await TiifuWorkingClass.AddColumn(tenantId, this.tableName, columnName, constraint);
            }
        };
        this.tableName = tablename;
        this.connection = helper_1.promisifyQuery;
    }
    static removeCountryCodeFromMobile(mobile, countryCode) {
        const mobileStr = String(mobile).trim();
        const isCountryCodeProvided = countryCode && countryCode.trim().length > 0;
        if (!isCountryCodeProvided) {
            const countryCodePattern = /^\+?\d{1,3}/;
            const match = mobileStr.match(countryCodePattern);
            if (match) {
                const detectedCountryCode = match[0];
                return mobileStr.slice(detectedCountryCode.length);
            }
        }
        if (mobileStr.startsWith(countryCode))
            return mobileStr.slice(countryCode.length);
        return mobileStr;
    }
    async findOne(tenantId, columnName, value) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection(this.tableName).where(columnName, value).first();
        return result ? result : null;
    }
    async findMany(tenantId, columnName, value) {
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const result = await connection(this.tableName).where(columnName, value);
        return result ? result : [];
    }
    async findList(tenantId, columnName, list) {
        if (list && Array.isArray(list) && list.length > 0) {
            const liststring = list.toString();
            const query = queries_1.q_tiifu_find_many_using_list_in.replace('tableName', this.tableName).replace('columnName', columnName).replace("list", liststring);
            return await (0, helper_1.promisifyQuery)(tenantId, query);
        }
        return [];
    }
    static reduceListInOF(data, target) {
        if (Array.isArray(data) && data.length > 0 && target) {
            return data.reduce((item, current) => item + current[target], 0);
        }
        return null;
    }
    static reduceArrayN(data) {
        if (Array.isArray(data) && data.length) {
            return data.reduce((item, current) => item + current, 0);
        }
        return null;
    }
    static isJson(value) {
        try {
            JSON.parse(value);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    static async AddColumn(tenantId, tablename, columnName, constraint) {
        let query = queries_1.q_tiifu_add_new_column.replace("tablename", tablename)
            .replace("columnName", columnName)
            .replace("constraint", constraint ? constraint : "");
        return await (0, helper_1.promisifyQuery)(tenantId, query);
    }
    static splitByCapitalLetters(input) {
        return input.split(/(?=[A-Z])/).map(word => word.toLowerCase());
    }
    static combineWordsWithUppercase(words) {
        return words
            .map((word, index) => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
            .join('');
    }
    static async getTableColumns(tenantId, tableName) {
        const columns = await (0, helper_1.promisifyQuery)(tenantId, `SHOW COLUMNS FROM ${tableName}`);
        return columns;
    }
    static async filterDatabaseTable(tenantId, tablename, columnName, filteringString, limit) {
        const sensitiveTableAndColumns = [
            {
                tablename: 'roles',
                sensitiveColumns: ["password", "permissions", "refresh_token",]
            }
        ];
        const tableSensitiveConfig = sensitiveTableAndColumns.find(table => table.tablename === tablename);
        const columns = await (0, helper_1.promisifyQuery)(tenantId, `SHOW COLUMNS FROM ${tablename}`);
        let columnNames = columns.map(col => col.Field);
        if (tableSensitiveConfig) {
            columnNames = columnNames.filter(column => !tableSensitiveConfig.sensitiveColumns.includes(column));
        }
        if (columnNames.length === 0) {
            throw new Error("No accessible columns available for this table.");
        }
        let query = `SELECT ${columnNames.join(", ")} FROM ${tablename} WHERE `;
        if (columnName && columnNames.includes(columnName)) {
            query += `${columnName} LIKE ?`;
        }
        else {
            query += columnNames.map((col) => `${col} LIKE ?`).join(' OR ');
        }
        const escapedString = `%${filteringString}%`;
        const queryParams = columnName ? [escapedString] : Array(columnNames.length).fill(escapedString);
        if (limit) {
            query += ` LIMIT ?`;
            queryParams.push(limit);
        }
        const rows = await (0, helper_1.promisifyQuery)(tenantId, query, queryParams);
        const sanitizedRows = rows.map((row) => {
            if (tableSensitiveConfig) {
                tableSensitiveConfig
                    .sensitiveColumns.forEach(col => delete row[col]);
            }
            return row;
        });
        return sanitizedRows;
    }
    static isNumberPhoneNumber(phoneNumber) {
        return /^0\d{9}$/.test(phoneNumber.toString());
    }
    static isEmailValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    static validatePhoneNumber(phone) {
        if (!phone) {
            return {
                isValid: false,
                formattedNumber: null,
                error: 'Phone number is required'
            };
        }
        let digits = phone.replace(/\D/g, '');
        if (digits.startsWith('00')) {
            digits = digits.slice(2);
        }
        let formattedNumber = null;
        if (digits.length === 9) {
            formattedNumber = '0' + digits;
        }
        else if (digits.startsWith('233') && digits.length === 12) {
            formattedNumber = '0' + digits.slice(3);
        }
        else if (digits.length === 10) {
            formattedNumber = digits.startsWith('0') ? digits : '0' + digits;
        }
        if (!formattedNumber || !/^0\d{9}$/.test(formattedNumber)) {
            return {
                isValid: false,
                formattedNumber: null,
                error: 'Invalid phone number format'
            };
        }
        return {
            isValid: true,
            formattedNumber
        };
    }
}
exports.TiifuWorkingClass = TiifuWorkingClass;
