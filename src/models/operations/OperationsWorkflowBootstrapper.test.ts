import { describe, it, expect, vi } from 'vitest';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import { ensureOperationsWorkflowSchema } from './OperationsWorkflowBootstrapper';
describe('QC session scope schema upgrades', () => {
	it.each([['branchid'], ['device_id'], []])('repairs partially installed scope columns: %j', async (...input) => {
		const existing = new Set(input as string[]), added: string[] = [];
		const db: any = () => ({ columnInfo: async () => ({ maxLength: 2048 }) });
		db.raw = async () => [[{ Type: "enum('accepted','bypassed','rejected')" }]];
		db.schema = {
			hasTable: async () => true, hasColumn: async (table: string, column: string) => table === 'qc_sessions' ? existing.has(column) : true, alterTable: async (table: string, work: any) => {
				expect(table).toBe('qc_sessions'); const column: any = { unsigned: () => column, nullable: () => column }; const add = (name: string) => { if (existing.has(name)) throw Error('Duplicate column'); existing.add(name); added.push(name); return column; }; work({ integer: add, string: add });
			}
		};
		await ensureOperationsWorkflowSchema(db);
		expect(existing.has('branchid')).toBe(true); expect(existing.has('device_id')).toBe(true);
		await ensureOperationsWorkflowSchema(db); expect(added.length).toBe(2 - input.length);
	});
});
