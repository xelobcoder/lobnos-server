import ExcelJS from 'exceljs';

export class ExcelHelper {
	workbook: ExcelJS.Workbook;
	worksheet: ExcelJS.Worksheet | null = null;

	constructor() {
		this.workbook = new ExcelJS.Workbook();
	}

	async load(filePath: string, sheetIndex = 0) {
		await this.workbook.xlsx.readFile(filePath);
		this.worksheet = this.workbook.worksheets[sheetIndex];
		if (!this.worksheet) throw new Error('Worksheet not found');
	}

	getHeaderRow(): string[] {
		if (!this.worksheet) throw new Error('Worksheet not loaded');
		return (this.worksheet.getRow(1).values as string[]).slice(1);
	}

	validateColumns(requiredColumns: string[]): string[] {
		const header = this.getHeaderRow();
		return requiredColumns.filter(col => !header.includes(col));
	}

	getRowsAsObjects(): Record<string, any>[] {
		if (!this.worksheet) throw new Error('Worksheet not loaded');
		const header = this.getHeaderRow();
		const data: Record<string, any>[] = [];
		this.worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			const obj: Record<string, any> = {};
			const values = Array.isArray(row.values) ? row.values.slice(1) : [];
			values.forEach((val, idx) => {
				obj[header[idx]] = val;
			});
			data.push(obj);
		});
		return data;
	}

	validateRows(fields: { label: string; required: boolean }[]): { row: number; missing: string[] }[] {
		if (!this.worksheet) throw new Error('Worksheet not loaded');
		const header = this.getHeaderRow();
		const results: { row: number; missing: string[] }[] = [];
		this.worksheet.eachRow((row, rowNumber) => {
			if (rowNumber === 1) return;
			const values = Array.isArray(row.values) ? row.values.slice(1) : [];
			const obj: Record<string, any> = {};
			values.forEach((val, idx) => {
				obj[header[idx]] = val;
			});
			const missing: string[] = [];
			for (const field of fields) {
				if (field.required && (!obj[field.label] || obj[field.label] === '')) {
					missing.push(field.label);
				}
			}
			if (missing.length > 0) {
				results.push({ row: rowNumber, missing });
			}
		});
		return results;
	}
}
