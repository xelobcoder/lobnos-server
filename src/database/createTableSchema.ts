import fs from 'fs';
import path from 'path';
import { promisifyQuery } from '../hooks/helper';


function mapMySqlToTsType(dataType: string): string {
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


export async function createSchema(tenantId:number,providedPath: string, migrationFileName: string) {
    const q_table_information: string = `
        SELECT COLUMN_NAME, 
               DATA_TYPE, 
               IS_NULLABLE, 
               COLUMN_KEY, 
               COLUMN_DEFAULT, 
               EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = ?;
    `;

    const q_all_db_tables: string = `
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'limsdb';
    `;

    try {
        const tables = await promisifyQuery(tenantId,q_all_db_tables);

        if (Array.isArray(tables) && tables.length > 0) {
            let typescriptCode = `// Generated types for database tables\n\n`;

            for (const _singleTable of tables) {
                const columns = await promisifyQuery(tenantId,q_table_information, [_singleTable.TABLE_NAME]);

                if (Array.isArray(columns) && columns.length > 0) {
                    const tableName = 'PrimeLimsTable' + _singleTable.TABLE_NAME;
                    typescriptCode += `export type ${tableName} = {\n`;

                    const columnNames: Set<string> = new Set();

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

            const filePath = path.join(providedPath, migrationFileName);
            fs.writeFileSync(filePath, typescriptCode);
        }
    } catch (error) {
        console.error('Error executing query:', error);
    }
}

