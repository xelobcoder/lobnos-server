import { beforeEach, describe, expect, it, vi } from "vitest";
import { transactionalDatabase } from "../../testSupport/transactionalDatabase";
vi.mock("../../database/KnexConnections", () => ({ default: vi.fn() }));
vi.mock("../application/appsettings/result-settings/resultSettings", () => ({
     default: { canStaffApproveResult: vi.fn().mockResolvedValue(true) },
}));
vi.mock("./imaging/ImagingResultAuditRepository", () => ({
     default: { isImagingTest: vi.fn().mockResolvedValue(false) },
}));
import KnexConnection from "../../database/KnexConnections";
import { ResultApprovalService, invalidateResultApprovals, applyResultValidationBypass } from "./ResultApprovalService";

function setup(overrides: any = {}) {
     const store = transactionalDatabase({
          test_ascension: [{ id: 1, billingid: 2, testid: 3, resultEntryEnd: new Date(), ...overrides }],
          billing: [{ billingid: 2, branchid: 4 }],
          test_results: [{ ascensionid: 1, fieldid: 10, value: "100" }],
          dbotestresultapproval: [
               {
                    id: 1,
                    ascensionid: 1,
                    approvedBy: null,
                    minvalidation: 2,
                    maxvalidation: 3,
                    approval_revision: 5,
                    requires_revalidation: 0,
               },
          ],
     });
     const db: any = () => ({ where: () => ({ first: async () => store.rows("test_ascension")[0] }) });
     db.transaction = store.db.transaction;
     vi.mocked(KnexConnection).mockResolvedValue(db);
     return { store, service: new ResultApprovalService(1) };
}
beforeEach(() => vi.clearAllMocks());
describe("result validation integrity", () => {
     it("preserves simultaneous validators and finalizes only after the minimum is reached", async () => {
          const { store, service } = setup();
          await Promise.all([service.approve(1, 7, 4, 5), service.approve(1, 8, 4, 5)]);
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({ approvedBy: "7,8", isapproved: 1 });
          expect(store.rows("lab_result_approval_events").map((row) => [row.revision, row.employeeid])).toEqual([
               [5, 7],
               [5, 8],
          ]);
     });
     it("records an identical concurrent retry once", async () => {
          const { store, service } = setup();
          await Promise.all([service.approve(1, 7, 4, 5), service.approve(1, 7, 4, 5)]);
          expect(store.rows("lab_result_approval_events")).toHaveLength(1);
          expect(store.rows("dbotestresultapproval")[0].isapproved).toBe(0);
     });
     it("rejects another branch without changing validation", async () => {
          const { store, service } = setup();
          await expect(service.approve(1, 7, 5, 5)).rejects.toThrow("another branch");
          expect(store.rows("lab_result_approval_events")).toHaveLength(0);
     });
     it("does not approve a test before result entry is completed", async () => {
          const { store, service } = setup({ resultEntryEnd: null });
          await expect(service.approve(1, 7, 4, 5)).rejects.toThrow("Save the test results");
          expect(store.rows("lab_result_approval_events")).toHaveLength(0);
     });
     it("invalidates previous approvals on a new result revision while preserving approval history", async () => {
          const { store, service } = setup();
          await service.approve(1, 7, 4, 5);
          await store.db.transaction((trx) => invalidateResultApprovals(trx, 1, 9));
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({
               approvedBy: null,
               isapproved: 0,
               approval_revision: 6,
               requires_revalidation: 1,
          });
          expect(store.rows("lab_result_approval_events")).toHaveLength(1);
          await expect(service.approve(1, 7, 4, 5)).rejects.toThrow("changed");
          await service.approve(1, 7, 4, 6);
          expect(store.rows("lab_result_approval_events").map((row) => row.revision)).toEqual([5, 6]);
     });
     it("does not let automatic validation bypass release a changed result", async () => {
          const { store } = setup();
          await store.db.transaction(async (trx) => {
               await trx("test_ascension").forUpdate().first();
               await applyResultValidationBypass(trx, 1, 9, true);
          });
          expect(store.rows("dbotestresultapproval")[0].isapproved).toBe(1);
          await store.db.transaction((trx) => invalidateResultApprovals(trx, 1, 9));
          await store.db.transaction(async (trx) => {
               await trx("test_ascension").forUpdate().first();
               await applyResultValidationBypass(trx, 1, 9, true);
          });
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({
               isapproved: 0,
               approvedBy: null,
               requires_revalidation: 1,
          });
     });
     it("requires every configured validator again and only clears the flag at final approval", async () => {
          const { store, service } = setup();
          await service.approve(1, 7, 4, 5);
          await service.approve(1, 8, 4, 5);
          await store.db.transaction(async (trx) => {
               await trx("test_ascension").where({ id: 1 }).forUpdate().first();
               await trx("test_results").where({ ascensionid: 1, fieldid: 10 }).update({ value: "120" });
               await invalidateResultApprovals(trx, 1, 9);
          });
          expect(store.rows("test_results")[0].value).toBe("120");
          await service.approve(1, 7, 4, 6);
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({ isapproved: 0, requires_revalidation: 1 });
          await service.approve(1, 8, 4, 6);
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({ isapproved: 1, requires_revalidation: 0 });
          expect(store.rows("lab_result_approval_events").map((row) => row.revision)).toEqual([5, 5, 6, 6]);
     });
     it("keeps revalidation required across repeated saves even after old validators are cleared", async () => {
          const { store, service } = setup();
          await service.approve(1, 7, 4, 5);
          await store.db.transaction((trx) => invalidateResultApprovals(trx, 1, 9));
          await store.db.transaction((trx) => invalidateResultApprovals(trx, 1, 9));
          expect(store.rows("dbotestresultapproval")[0]).toMatchObject({
               requires_revalidation: 1,
               approval_revision: 7,
          });
          await expect(service.approve(1, 7, 4, 6)).rejects.toThrow("changed");
     });
     it("rejects approvals that do not identify the revision reviewed", async () => {
          const { service } = setup();
          await expect(service.approve(1, 7, 4)).rejects.toThrow("changed");
     });
});
