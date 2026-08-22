import { promisifyQuery } from '../hooks/helper';
import KnexConnection from './KnexConnections';
import { q_tiifu_add_new_column, q_tiifu_find_many_using_list_in, q_tiifu_findColumn, q_tiifu_findColumn_many } from './queries';
export class TiifuWorkingClass {
     public tableName: string;
     private connection: any;
     constructor(tablename: string) {
          this.tableName = tablename;
          this.connection = promisifyQuery
     }


     checkColumnExists = async (columnName: string): Promise<boolean> => {
          const query = q_tiifu_findColumn.replace("tableName", this.tableName).replace("columnName", columnName);
          const result = await this.connection(1, query);
          return result.length > 0;
     }




     createColumnIfNotExists = async (tenantId: number, columnName: string, constraint: string): Promise<void> => {
          const columnExists = await this.checkColumnExists(columnName);
          if (!columnExists) {
               await TiifuWorkingClass.AddColumn(tenantId, this.tableName, columnName, constraint);
          }
     }
     public static removeCountryCodeFromMobile(mobile: number | string, countryCode: string): string {
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
          if (mobileStr.startsWith(countryCode)) return mobileStr.slice(countryCode.length);
          return mobileStr;
     }

     public async findOne(tenantId: number, columnName: string, value: (number | string | boolean)): Promise<any | null> {
          const connection =  await KnexConnection(tenantId);
          const result = await connection(this.tableName).where(columnName, value).first();
          return result ? result : null
     }

     public async findMany(tenantId: number, columnName: string, value: (number | string | boolean)) {
          const connection = await KnexConnection(tenantId);
          const result = await connection(this.tableName).where(columnName, value);
          return result ? result : []
     }

     public async findList(tenantId: number, columnName: string, list: string[] | number[] | boolean[]) {
          if (list && Array.isArray(list) && list.length > 0) {
               const liststring = list.toString();

               const query = q_tiifu_find_many_using_list_in.replace('tableName', this.tableName).replace('columnName', columnName).replace("list", liststring)

               return await promisifyQuery(tenantId, query);
          }
          return [];
     }

     public static reduceListInOF(data: any[], target: string) {
          if (Array.isArray(data) && data.length > 0 && target) {
               return data.reduce((item, current) => item + current[target], 0)
          }
          return null;
     }

     public static reduceArrayN(data: number[]) {
          if (Array.isArray(data) && data.length) {
               return data.reduce((item, current) => item + current, 0)
          }
          return null;
     }
     static isJson(value: string) {
          try {
               JSON.parse(value);
               return true;
          } catch (e) {
               return false;
          }
     }
     public static async AddColumn(tenantId: number, tablename: string, columnName: string, constraint: string) {
          let query = q_tiifu_add_new_column.replace("tablename", tablename)
               .replace("columnName", columnName)
               .replace("constraint", constraint ? constraint : "");
          return await promisifyQuery(tenantId, query)
     }

     static splitByCapitalLetters(input: string): string[] {
          return input.split(/(?=[A-Z])/).map(word => word.toLowerCase());
     }

     static combineWordsWithUppercase(words: string[]): string {
          return words
               .map((word, index) => {
                    return word.charAt(0).toUpperCase() + word.slice(1);
               })
               .join('');
     }

     static async getTableColumns(tenantId: number, tableName: string) {
          const columns = await promisifyQuery(tenantId, `SHOW COLUMNS FROM ${tableName}`);
          return columns
     }

     static async filterDatabaseTable(
          tenantId: number,
          tablename: string,
          columnName: string,
          filteringString: string,
          limit: number
     ) {
          const sensitiveTableAndColumns = [
               {
                    tablename: 'roles',
                    sensitiveColumns: ["password", "permissions", "refresh_token",]
               }
          ];

          const tableSensitiveConfig = sensitiveTableAndColumns.find(
               table => table.tablename === tablename
          );

          const columns = await promisifyQuery(tenantId, `SHOW COLUMNS FROM ${tablename}`);
          let columnNames = columns.map((col:any) => col.Field);

          if (tableSensitiveConfig) {
               columnNames = columnNames.filter(
                    (column:any) => !tableSensitiveConfig.sensitiveColumns.includes(column)
               );
          }

          if (columnNames.length === 0) {
               throw new Error("No accessible columns available for this table.");
          }

          let query = `SELECT ${columnNames.join(", ")} FROM ${tablename} WHERE `;

          if (columnName && columnNames.includes(columnName)) {
               query += `${columnName} LIKE ?`;
          } else {
               query += columnNames.map((col: string) => `${col} LIKE ?`).join(' OR ');
          }

          const escapedString = `%${filteringString}%`;
          const queryParams = columnName ? [escapedString] : Array(columnNames.length).fill(escapedString);

          if (limit) {
               query += ` LIMIT ?`;
               queryParams.push(limit);
          }

          const rows = await promisifyQuery(tenantId, query, queryParams);
          const sanitizedRows = rows.map((row: any) => {
               if (tableSensitiveConfig) {
                    tableSensitiveConfig
                         .sensitiveColumns.forEach(col => delete row[col]);
               }
               return row;
          });
          return sanitizedRows;
     }

     static isNumberPhoneNumber(phoneNumber: number | string) {
          return /^0\d{9}$/.test(phoneNumber.toString());
     }

     static isEmailValidEmail(email: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
     }


     static validatePhoneNumber(phone: string): { isValid: boolean; formattedNumber: string | null; error?: string } {
          if (!phone) {
               return {
                    isValid: false,
                    formattedNumber: null,
                    error: 'Phone number is required'
               }
          }
          let digits = phone.replace(/\D/g, '')
          if (digits.startsWith('00')) {
               digits = digits.slice(2)
          }
          let formattedNumber: string | null = null
          if (digits.length === 9) {
               formattedNumber = '0' + digits
          } else if (digits.startsWith('233') && digits.length === 12) {
               formattedNumber = '0' + digits.slice(3)
          } else if (digits.length === 10) {
               formattedNumber = digits.startsWith('0') ? digits : '0' + digits
          }
          if (!formattedNumber || !/^0\d{9}$/.test(formattedNumber)) {
               return {
                    isValid: false,
                    formattedNumber: null,
                    error: 'Invalid phone number format'
               }
          }
          return {
               isValid: true,
               formattedNumber
          }
     }


}
