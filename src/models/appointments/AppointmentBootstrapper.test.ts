import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ connect: vi.fn(), warn: vi.fn(), info: vi.fn(), workflowUp: vi.fn() }));
vi.mock("../../database/KnexConnections", () => ({ default: mocks.connect }));
vi.mock("../../hooks/logger", () => ({ default: { warn: mocks.warn, info: mocks.info } }));
vi.mock("../../cron/command-line-tool-database/migrations/20261023_appointment_workflow", () => ({ up: mocks.workflowUp }));

import { bootstrapAppointmentTables } from "./AppointmentBootstrapper";

function fakeDb(options: { table?: boolean; columns?: string[]; indexes?: string[]; patientNullable?: string; patientType?: string }) {
	const columns = new Set(options.columns ?? []);
	const indexes = new Set(options.indexes ?? []);
	const ops: string[] = [];
	const builder = {
		string: (name: string, len: number) => { ops.push(`add ${name} varchar(${len})`); columns.add(name); return chain; },
		integer: (name: string) => { ops.push(`add ${name} int`); columns.add(name); return chain; },
		index: (_cols: string[], name: string) => { ops.push(`index ${name}`); indexes.add(name); },
	};
	const chain: any = { unsigned: () => chain, nullable: () => chain, defaultTo: (v: string) => { ops.push(`default ${v}`); return chain; } };
	const db = {
		schema: {
			hasTable: vi.fn(async () => options.table ?? true),
			hasColumn: vi.fn(async (_t: string, c: string) => columns.has(c)),
			alterTable: vi.fn(async (_t: string, cb: (t: typeof builder) => void) => cb(builder)),
		},
		raw: vi.fn(async (sql: string, values?: string[]) => {
			if (sql.includes("information_schema.STATISTICS")) return [indexes.has(values![1]) ? [{ 1: 1 }] : []];
			if (sql.includes("information_schema.COLUMNS")) {
				return [[{ is_nullable: options.patientNullable ?? "NO", column_type: options.patientType ?? "int unsigned" }]];
			}
			ops.push(sql);
			return [[]];
		}),
	};
	return { db, ops };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("bootstrapAppointmentTables", () => {
	it("adds metadata columns, indexes and widens patientid on a legacy table", async () => {
		const { db, ops } = fakeDb({});
		mocks.connect.mockResolvedValue(db);
		await bootstrapAppointmentTables(4);
		expect(mocks.connect).toHaveBeenCalledWith(4);
		expect(ops).toEqual([
			"add appointment_type varchar(30)", "default consultation",
			"add lead_id int", "add billingid int",
			"index idx_appointments_type", "index idx_appointments_lead", "index idx_appointments_billing", "index idx_appointments_date",
			"ALTER TABLE `appointments` MODIFY COLUMN `patientid` INT UNSIGNED NULL",
		]);
		expect(mocks.workflowUp).toHaveBeenCalledWith(db);
	});

	it("is a no-op when already migrated", async () => {
		const { db, ops } = fakeDb({
			columns: ["appointment_type", "lead_id", "billingid"],
			indexes: ["idx_appointments_type", "idx_appointments_lead", "idx_appointments_billing", "idx_appointments_date"],
			patientNullable: "YES",
		});
		mocks.connect.mockResolvedValue(db);
		await bootstrapAppointmentTables(4);
		expect(ops).toEqual([]);
		expect(db.schema.alterTable).not.toHaveBeenCalled();
	});

	it("does not modify an unexpected patientid type", async () => {
		const { db, ops } = fakeDb({ patientType: "varchar(20)" });
		mocks.connect.mockResolvedValue(db);
		await bootstrapAppointmentTables(4);
		expect(ops.some((op) => op.includes("MODIFY"))).toBe(false);
		expect(mocks.warn).toHaveBeenCalled();
	});

	it("skips tenants without an appointments table", async () => {
		const { db } = fakeDb({ table: false });
		mocks.connect.mockResolvedValue(db);
		await bootstrapAppointmentTables(4);
		expect(db.schema.alterTable).not.toHaveBeenCalled();
		expect(db.raw).not.toHaveBeenCalled();
		expect(mocks.workflowUp).not.toHaveBeenCalled();
	});
});
