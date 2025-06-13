"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiifuWorkingClass = void 0;
const helper_1 = require("../hooks/helper");
const queries_1 = require("./queries");
class TiifuWorkingClass {
    constructor(tablename) {
        this.tableName = tablename;
        this.connection = helper_1.promisifyQuery;
    }
    async findOne(tenantId, columnName, value) {
        const query = queries_1.q_tiifu_findColumn.replace('tableName', this.tableName).replace('columnName', columnName);
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [value]);
        return result.length > 0 ? result[0] : null;
    }
    async findMany(tenantId, columnName, value) {
        const query = queries_1.q_tiifu_findColumn_many.replace('tableName', this.tableName).replace('columnName', columnName);
        return await (0, helper_1.promisifyQuery)(tenantId, query, [value]);
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
                tableSensitiveConfig.sensitiveColumns.forEach(col => delete row[col]);
            }
            return row;
        });
        console.log(sanitizedRows);
        return sanitizedRows;
    }
    static isNumberPhoneNumber(phoneNumber) {
        return /^0\d{9}$/.test(phoneNumber.toString());
    }
    static isEmailValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
}
exports.TiifuWorkingClass = TiifuWorkingClass;
