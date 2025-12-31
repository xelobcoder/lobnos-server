"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSchema = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helper_1 = require("../hooks/helper");
function mapMySqlToTsType(dataType) {
    switch (dataType) {
        case 'int':
        case 'bigint':
        case 'smallint':
        case 'tinyint':
        case 'mediumint':
        case 'float':
        case 'double':
        case 'decimal':
            return 'number';
        case 'varchar':
        case 'char':
        case 'text':
        case 'mediumtext':
        case 'longtext':
        case 'enum':
        case 'set':
            return 'string';
        case 'date':
        case 'datetime':
        case 'timestamp':
            return 'Date | string';
        case 'time':
            return 'string';
        case 'bit':
        case 'boolean':
            return 'boolean';
        case 'blob':
        case 'mediumblob':
        case 'longblob':
            return 'Buffer';
        case 'json':
            return 'object';
        default:
            return 'any';
    }
}
async function createSchema(tenantId, providedPath, migrationFileName) {
    const q_table_information = `
        SELECT COLUMN_NAME, 
               DATA_TYPE, 
               IS_NULLABLE, 
               COLUMN_KEY, 
               COLUMN_DEFAULT, 
               EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?;
    `;
    const q_all_db_tables = `
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'limsdb';
    `;
    try {
        const tables = await (0, helper_1.promisifyQuery)(tenantId, q_all_db_tables);
        if (Array.isArray(tables) && tables.length > 0) {
            let typescriptCode = `// Generated types for database tables\n\n`;
            for (const _singleTable of tables) {
                const columns = await (0, helper_1.promisifyQuery)(tenantId, q_table_information, [_singleTable.TABLE_NAME]);
                if (Array.isArray(columns) && columns.length > 0) {
                    const tableName = 'PrimeLimsTable' + _singleTable.TABLE_NAME;
                    typescriptCode += `export type ${tableName} = {\n`;
                    const columnNames = new Set();
                    for (const column of columns) {
                        const columnName = column.COLUMN_NAME;
                        if (columnNames.has(columnName)) {
                            continue;
                        }
                        columnNames.add(columnName);
                        const dataType = column.DATA_TYPE.toLowerCase();
                        let tsType = mapMySqlToTsType(dataType);
                        if (column.IS_NULLABLE === 'YES') {
                            tsType = `${tsType} `;
                            typescriptCode += `  ${columnName}?: ${tsType};\n`;
                        }
                        else {
                            typescriptCode += `  ${columnName}: ${tsType};\n`;
                        }
                    }
                    typescriptCode += `};\n\n`;
                }
            }
            const filePath = path_1.default.join(providedPath, migrationFileName);
            fs_1.default.writeFileSync(filePath, typescriptCode);
        }
    }
    catch (error) {
        console.error('Error executing query:', error);
    }
}
exports.createSchema = createSchema;
