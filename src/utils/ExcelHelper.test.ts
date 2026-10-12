import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { ExcelHelper, ExcelImportLimitError } from './ExcelHelper';

async function createWorkbookBuffer(): Promise<Buffer> {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Import');
	worksheet.addRow(['name', 'phone', 'identifier']);
	worksheet.addRow(['Clinician One', '12345', 'CL-1']);
	return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('ExcelHelper', () => {
	it('parses rows once and filters valid records from parsed data', async () => {
		const helper = new ExcelHelper();
		const parsed = await helper.parseBuffer(await createWorkbookBuffer());

		expect(parsed.header).toEqual(['name', 'phone', 'identifier']);
		expect(await helper.filterValidData(parsed.data, 'clinician')).toEqual([
			{ name: 'Clinician One', phone: '12345', identifier: 'CL-1' },
		]);
	});

	it('rejects worksheets that exceed configured row or column limits', async () => {
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet('Import');
		worksheet.getCell('D4').value = 'outside limits';

		await expect(
			new ExcelHelper().parseBuffer(Buffer.from(await workbook.xlsx.writeBuffer()), 2, {
				maxRows: 3,
				maxColumns: 3,
			}),
		).rejects.toBeInstanceOf(ExcelImportLimitError);
	});
});
