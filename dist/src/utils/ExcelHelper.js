"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelHelper = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
class ExcelHelper {
    constructor() {
        this.worksheet = null;
        this.workbook = new exceljs_1.default.Workbook();
    }
    async load(filePath, sheetIndex = 0) {
        await this.workbook.xlsx.readFile(filePath);
        this.worksheet = this.workbook.worksheets[sheetIndex];
        if (!this.worksheet)
            throw new Error('Worksheet not found');
    }
    getHeaderRow() {
        if (!this.worksheet)
            throw new Error('Worksheet not loaded');
        // Remove first empty value (exceljs row.values is 1-based)
        return this.worksheet.getRow(1).values.slice(1);
    }
    validateColumns(requiredColumns) {
        const header = this.getHeaderRow();
        return requiredColumns.filter(col => !header.includes(col));
    }
    getRowsAsObjects() {
        if (!this.worksheet)
            throw new Error('Worksheet not loaded');
        const header = this.getHeaderRow();
        const data = [];
        this.worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1)
                return;
            const obj = {};
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            values.forEach((val, idx) => {
                obj[header[idx]] = val;
            });
            data.push(obj);
        });
        return data;
    }
}
exports.ExcelHelper = ExcelHelper;
