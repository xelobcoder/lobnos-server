import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import knex from "knex";
vi.mock("../application/appsettings/result-settings/resultSettings", () => ({
     default: { canStaffApproveResult: vi.fn() },
}));
import ResultSettings from "../application/appsettings/result-settings/resultSettings";
import { assertLabTestAccess, scopeLabWork } from "./LabAccessPolicy";
let db: any;
const actor: any = { employeeid: 7, tenantId: 1, branch: 4, role: "scientist" };
function setup(settings: any = {}, assigned = 8) {
     db = knex({ client: "mysql2" });
     const queries: any[] = [];
     db.client.acquireConnection = async () => ({});
     db.client.releaseConnection = async () => {};
     db.client._query = async (_: any, q: any) => {
          queries.push(q);
          q.response = [
               q.sql.includes("from `test_ascension`")
                    ? [{ id: 1, branchid: 4, assigned_employeeid: assigned }]
                    : [{ id: 1, visibility: "restricted", editing: "assigned", allow_claim: false, ...settings }],
               [],
          ];
          return q;
     };
     return queries;
}
beforeEach(() => vi.mocked(ResultSettings.canStaffApproveResult).mockResolvedValue(false));
afterEach(async () => db?.destroy());
describe("scientist assignment authorization", () => {
     it("denies another scientist private results and edits", async () => {
          const queries = setup();
          await expect(assertLabTestAccess(db, actor, 1)).rejects.toThrow("another scientist");
          await expect(assertLabTestAccess(db, actor, 1, true)).rejects.toThrow("Claim");
          expect(queries[0].sql).toContain("`ta`.`id`");
          expect(queries[0].sql).not.toContain("`test`.`id`");
     });
     it("preserves supervisor and qualified validator read access without granting reviewer edits", async () => {
          setup();
          vi.mocked(ResultSettings.canStaffApproveResult).mockResolvedValue(true);
          await expect(assertLabTestAccess(db, actor, 1)).resolves.toBeUndefined();
          await expect(assertLabTestAccess(db, actor, 1, true)).rejects.toThrow("Claim");
          await expect(assertLabTestAccess(db, { ...actor, role: "admin" }, 1, true)).resolves.toBeUndefined();
     });
     it("allows team reads and optionally unassigned claiming while keeping edits assigned", async () => {
          setup({ visibility: "team" });
          await expect(assertLabTestAccess(db, actor, 1)).resolves.toBeUndefined();
          await expect(assertLabTestAccess(db, actor, 1, true)).rejects.toThrow("Claim");
     });
     it("scopes queries before pagination without executing or exposing the result builder", async () => {
          const queries = setup();
          const q = db("test_ascension as test").select("test.id");
          await scopeLabWork(q, db, actor, "test.id");
          const compiled = q.limit(25).toSQL();
          expect(compiled.sql).toContain("exists");
          expect(compiled.bindings).toContain(7);
          expect(queries.some((q) => q.sql.includes("from `test_ascension`"))).toBe(false);
     });
     it("rejects cross-branch access even for a supervisor", async () => {
          setup();
          await expect(assertLabTestAccess(db, { ...actor, role: "admin", branch: 9 }, 1)).rejects.toThrow("branch");
     });
});
