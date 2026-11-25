import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
	getOrLoad: vi.fn(async (_tenantId: number, _view: string, _parameters: Record<string, unknown>, load: () => Promise<unknown>) => load()),
	invalidate: vi.fn(),
	query: vi.fn(),
	getMasterPanels: vi.fn(),
	connection: vi.fn(),
}));

vi.mock("../services/cache/testPanelCache", () => ({
	testPanelCache: {
		getOrLoad: mocks.getOrLoad,
		invalidate: mocks.invalidate,
	},
}));

vi.mock("../hooks/helper", () => ({
	allFieldsHasValues: vi.fn(),
	customError: vi.fn(),
	promisifyQuery: (...args: unknown[]) => mocks.query(...args),
	responseError: vi.fn(),
	rowAffected: (result: { affectedRows?: number }) => Number(result?.affectedRows) > 0,
	hasSpecialCharacters: vi.fn(),
}));

vi.mock("../hooks/logger", () => ({ default: { error: vi.fn() } }));
vi.mock("./categories", () => ({ allFieldsHasValues: vi.fn() }));
vi.mock("../database/KnexConnections", () => ({ default: (...args: unknown[]) => mocks.connection(...args) }));
vi.mock("../database/appLevelTriggers", () => ({ applyTestPanelsAfterInsert: vi.fn() }));
vi.mock("./testPanelId", () => ({ generateNextTestPanelId: vi.fn(async () => 1) }));
vi.mock("../models/system-admin/MasterTestPanelRepository", () => ({
	default: class {
		getMasterPanels() {
			return mocks.getMasterPanels();
		}
	},
}));

import { testpanel } from "./testpanelList";

function response() {
	const res: Response = Object.create(express.response);
	res.send = vi.fn<Response["send"]>().mockReturnValue(res);
	res.status = vi.fn<Response["status"]>().mockReturnValue(res);
	res.json = vi.fn<Response["json"]>().mockReturnValue(res);
	return res;
}

function request<TBody, TQuery>(body: TBody, query: TQuery): Request<{}, {}, TBody, TQuery> {
	return Object.assign(Object.create(express.request), { body, query });
}

describe("test-panel cache integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.query.mockReset();
		mocks.invalidate.mockReset();
		mocks.getOrLoad.mockImplementation(async (_tenantId, _view, _parameters, load) => load());
	});

	it("caches the client list without changing the response shape", async () => {
		const rows = [{ id: 4, name: "Panel" }];
		mocks.query.mockResolvedValue(rows);
		const res = response();

		await testpanel.getPanels(
			12,
			request({}, { tenantId: "12" }),
			res
		);

		expect(mocks.getOrLoad).toHaveBeenCalledWith(12, "client-list", {}, expect.any(Function));
		expect(res.send).toHaveBeenCalledWith({
			statusCode: 200,
			status: "success",
			message: "success",
			data: rows,
		});
	});

	it("caches the client bulk list by its filters and bypasses master grouping", async () => {
		const rows = [{ id: 9, name: "Filtered panel" }];
		mocks.query.mockResolvedValue(rows);

		await expect(testpanel.getpanelsbulk(12, "client", {
			filtercategory: "name",
			searchstring: "Filtered",
		})).resolves.toBe(rows);
		expect(mocks.getOrLoad).toHaveBeenCalledWith(
			12,
			"client-bulk-list",
			{ filtercategory: "name", searchstring: "Filtered" },
			expect.any(Function)
		);

		mocks.getMasterPanels.mockResolvedValue([]);
		await testpanel.getpanelsbulk(12, "master", {});
		expect(mocks.getMasterPanels).toHaveBeenCalledOnce();
		expect(mocks.getOrLoad).toHaveBeenCalledOnce();
	});

	it("caches billing selection and single-test edit details", async () => {
		const rows = [{ id: 7 }];
		mocks.query.mockResolvedValue(rows);

		const res = response();
		await testpanel.getPanelBulKLessInformation(request({}, { tenantId: 12 }), res);
		await testpanel.getPanelEditSingle(12, 7, false, true);

		expect(mocks.getOrLoad).toHaveBeenNthCalledWith(
			1, 12, "billing-selection", {}, expect.any(Function)
		);
		expect(mocks.getOrLoad).toHaveBeenNthCalledWith(
			2, 12, "test-panel-edit", { testid: 7, withDepartment: true }, expect.any(Function)
		);
		expect(res.send).toHaveBeenCalledWith({ data: rows });
	});

	it("keeps internal clinical and device test metadata reads uncached", async () => {
		const rows = [{ id: 15 }];
		mocks.query.mockResolvedValue(rows);

		await expect(testpanel.getTestInfo(12, 15)).resolves.toBe(rows[0]);
		await testpanel.getTestDetails(12, 15);
		await testpanel.getPanelEditSingle(12, 15);
		expect(mocks.getOrLoad).not.toHaveBeenCalled();
	});

	it("waits for all bulk mutations and invalidation before sending success", async () => {
		const order: string[] = [];
		mocks.query.mockImplementation(async (_tenant, _query, values: unknown[]) => {
			order.push(`write:${values[5]}`);
			return { affectedRows: 1 };
		});
		mocks.invalidate.mockImplementation(async () => { order.push("invalidate"); });
		const res = response();
		vi.mocked(res.send).mockImplementation(() => { order.push("response"); return res; });
		const panel = [1, 2].map((id) => ({ id, name: `Panel ${id}`, price: 10, sample: "1", category: "1", qty_required: 1 }));
		await testpanel.bulkTestUpdate(request({ panel }, { tenantId: 12 }), res);
		expect(order).toEqual(["write:1", "write:2", "invalidate", "response"]);
	});

	it("invalidates a partially completed bulk update when a later write fails", async () => {
		mocks.query.mockResolvedValueOnce({ affectedRows: 1 }).mockRejectedValueOnce(new Error("Write failed"));
		const panel = [1, 2].map((id) => ({ id, name: `Panel ${id}`, price: 10, sample: "1", category: "1", qty_required: 1 }));
		const res = response();
		await testpanel.bulkTestUpdate(request({ panel }, { tenantId: 12 }), res);
		expect(mocks.invalidate).toHaveBeenCalledWith(12);
		expect(res.send).toHaveBeenCalledWith({ message: "Write failed", statusCode: "500", status: "error" });
	});

	it("invalidates single edits only after both catalogue and detail writes finish", async () => {
		const order: string[] = [];
		const trx = {
			raw: vi.fn(async (query: string) => {
				order.push(query.includes("UPDATE test_panels") ? "panel" : "details");
				return [{ affectedRows: 1 }];
			}),
			commit: vi.fn(async () => { order.push("commit"); }),
			rollback: vi.fn(),
			isCompleted: vi.fn().mockReturnValue(false),
		};
		mocks.connection.mockResolvedValue({ transaction: async () => trx });
		mocks.invalidate.mockImplementation(async () => { order.push("invalidate"); });
		const res = response();
		vi.mocked(res.send).mockImplementation(() => { order.push("response"); return res; });
		await testpanel.putSingleTestPanel(12, request({ id: 1, testid: 1 }, {}), res);
		expect(order).toEqual(["panel", "details", "commit", "invalidate", "response"]);
	});

	it("rolls back and invalidates a single edit if the detail write fails", async () => {
		const trx = {
			raw: vi.fn().mockResolvedValueOnce([{ affectedRows: 1 }]).mockRejectedValueOnce(new Error("Details failed")),
			commit: vi.fn(),
			rollback: vi.fn(),
			isCompleted: vi.fn().mockReturnValue(false),
		};
		mocks.connection.mockResolvedValue({ transaction: async () => trx });
		const res = response();
		await testpanel.putSingleTestPanel(12, request({ id: 1, testid: 1 }, {}), res);
		expect(trx.rollback).toHaveBeenCalledOnce();
		expect(trx.commit).not.toHaveBeenCalled();
		expect(mocks.invalidate).toHaveBeenCalledWith(12);
		expect(res.status).toHaveBeenCalledWith(500);
	});

	it("invalidates sample type changes and test renames, but not rejected renames", async () => {
		mocks.query.mockResolvedValue({ affectedRows: 1 });
		await testpanel.addSampleType(request({ name: "Blood" }, { tenantId: 12 }), response());
		await testpanel.deleteSampleType(request({}, { tenantId: 12, id: "1" }), response());
		mocks.query.mockResolvedValueOnce([{ name: "Old" }]).mockResolvedValueOnce({ affectedRows: 1 });
		const hasTest = vi.spyOn(testpanel, "hasTest").mockResolvedValue(false);
		await testpanel.changeTestName(12, 1, "New");
		expect(mocks.invalidate).toHaveBeenCalledTimes(3);
		await testpanel.changeTestName(12, 1, "");
		expect(mocks.invalidate).toHaveBeenCalledTimes(3);
		hasTest.mockRestore();
	});

	it("invalidates committed deletion but leaves rolled-back deletion alone", async () => {
		const builder = {
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue({ id: 1 }),
			del: vi.fn().mockResolvedValue(1),
		};
		const trx = Object.assign(vi.fn(() => builder), {
			commit: vi.fn(async () => undefined),
			rollback: vi.fn(async () => undefined),
		});
		mocks.connection.mockResolvedValue({ transaction: async () => trx });
		const order: string[] = [];
		trx.commit.mockImplementation(async () => { order.push("commit"); });
		mocks.invalidate.mockImplementation(async () => { order.push("invalidate"); });
		expect(await testpanel.dropPanelWithDependencies(12, 1)).toBe(true);
		expect(order).toEqual(["commit", "invalidate"]);
		builder.del.mockRejectedValueOnce(new Error("Deletion failed"));
		expect(await testpanel.dropPanelWithDependencies(12, 1)).toBe(false);
		expect(trx.rollback).toHaveBeenCalledOnce();
		expect(mocks.invalidate).toHaveBeenCalledOnce();
	});

	it("invalidates custom creation only after commit", async () => {
		const builder = {
			select: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			first: vi.fn().mockResolvedValue({ id: 1, price: 10, iscustom: 1 }),
			insert: vi.fn().mockResolvedValue([1]),
		};
		const order: string[] = [];
		const trx = Object.assign(vi.fn(() => builder), {
			commit: vi.fn(async () => { order.push("commit"); }),
			rollback: vi.fn(async () => undefined),
		});
		mocks.connection.mockResolvedValue({ transaction: async () => trx });
		mocks.invalidate.mockImplementation(async () => { order.push("invalidate"); });
		const hasTest = vi.spyOn(testpanel, "hasTest").mockResolvedValue(false);
		expect(await testpanel.createCustomTest(12, "New")).toBe(true);
		expect(order).toEqual(["commit", "invalidate"]);
		hasTest.mockRestore();
	});
});
