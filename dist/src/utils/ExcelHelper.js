"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelHelper = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const stream_1 = require("stream");
class ExcelHelper {
    constructor() {
        this.worksheet = null;
        this.workbook = new exceljs_1.default.Workbook();
    }
    isEmpty(value) {
        return value === undefined || value === null || String(value).trim() === '';
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
        const header = this.worksheet.getRow(1).values;
        return header.slice(1).map(h => h === null || h === void 0 ? void 0 : h.toString().trim().toLowerCase());
    }
    validateColumns(requiredColumns) {
        const header = this.getHeaderRow();
        return requiredColumns.filter(col => !header.includes(col.toLowerCase()));
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
    targetFields(target) {
        switch (target.toLowerCase()) {
            case 'clinician':
                return [
                    { field: 'name', required: true },
                    { field: 'location', required: false },
                    { field: 'address', required: false },
                    { field: 'occupation', required: false },
                    { field: 'organization', required: false },
                    { field: 'phone', required: true },
                    { field: 'email', required: false },
                    { field: 'identifier', required: true }
                ];
            case 'organization':
                return [
                    { field: 'name', required: true },
                    { field: 'location', required: false },
                    { field: 'street', required: false },
                    { field: 'mobile', required: true },
                    { field: 'address', required: false },
                    { field: 'email', required: false },
                    { field: 'region', required: false },
                    { field: 'gpsmapping', required: false },
                    { field: 'website', required: false },
                    { field: 'type', required: false }
                ];
            case 'registration':
                return [
                    { field: 'fullpatientid', required: true },
                    { field: 'designation', required: false },
                    { field: 'firstname', required: true },
                    { field: 'email', required: false },
                    { field: 'dob', required: false },
                    { field: 'age', required: true },
                    { field: 'gender', required: false },
                    { field: 'marital_status', required: false },
                    { field: 'mobile_number', required: false },
                    { field: 'agetype', required: true },
                    { field: 'occupation', required: false },
                    { field: 'date', required: true },
                    { field: 'activation_status', required: true },
                    { field: 'lastname', required: true },
                    { field: 'middlename', required: false },
                    { field: 'organization', required: false },
                    { field: 'contactpointer', required: true },
                    { field: 'whatappcontact', required: false }
                ];
            case 'outsource':
            case 'outsourcingorganization':
                return [
                    { field: 'name', required: true },
                    { field: 'organizationtype', required: false },
                    { field: 'email', required: false },
                    { field: 'address', required: false },
                    { field: 'billingaddress', required: false },
                    { field: 'contactnumber', required: true },
                    { field: 'contactperson', required: false },
                    { field: 'addedon', required: false },
                    { field: 'updatedon', required: false },
                    { field: 'outsourcecreatedby', required: true }
                ];
            default:
                throw new Error(`Unknown target: ${target}`);
        }
    }
    async filterValidData(data, target) {
        const fields = this.targetFields(target);
        const valid = [];
        for (const obj of data) {
            let isValid = true;
            for (const fieldDef of fields) {
                const val = obj[fieldDef.field.toLowerCase()];
                if (fieldDef.required && this.isEmpty(val)) {
                    isValid = false;
                    break;
                }
            }
            if (isValid)
                valid.push(obj);
        }
        return valid;
    }
    async parseBuffer(buffer, minHeaderColumns = 2) {
        const stream = new stream_1.Readable();
        stream.push(buffer);
        stream.push(null);
        await this.workbook.xlsx.read(stream);
        this.worksheet = this.workbook.worksheets[0];
        if (!this.worksheet)
            throw new Error('Worksheet not found');
        let headerRowNum = 1;
        let header = [];
        for (let i = 1; i <= this.worksheet.rowCount; i++) {
            const row = this.worksheet.getRow(i);
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            if (values.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length >= minHeaderColumns) {
                headerRowNum = i;
                header = values.map(v => (v !== null && v !== undefined ? String(v).trim().toLowerCase() : ''));
                break;
            }
        }
        if (header.length === 0) {
            for (let i = 1; i <= this.worksheet.rowCount; i++) {
                const row = this.worksheet.getRow(i);
                const values = Array.isArray(row.values) ? row.values.slice(1) : [];
                if (values.some(v => v !== null && v !== undefined && String(v).trim() !== '')) {
                    headerRowNum = i;
                    header = values.map(v => (v !== null && v !== undefined ? String(v).trim().toLowerCase() : ''));
                    break;
                }
            }
        }
        if (header.length === 0) {
            return { header: [], data: [] };
        }
        const data = [];
        for (let i = headerRowNum + 1; i <= this.worksheet.rowCount; i++) {
            const row = this.worksheet.getRow(i);
            const values = Array.isArray(row.values) ? row.values.slice(1) : [];
            if (values.every(v => v === null || v === undefined || String(v).trim() === ''))
                continue;
            const obj = {};
            for (let idx = 0; idx < header.length; idx++) {
                obj[header[idx]] = values[idx];
            }
            data.push(obj);
        }
        return { header, data };
    }
    async loadAndFilterValidData(buffer, target) {
        const { data } = await this.parseBuffer(buffer);
        return this.filterValidData(data, target);
    }
}
exports.ExcelHelper = ExcelHelper;
