import { describe, expect, it } from "vitest";
import { OperationsStages, q_get_all_test_ready_for_various_stages } from "./queries";

describe("lab stage queries", () => {
     // Lab result saves record resultEntryEnd only; requiring resultEntryStart hid tests from validation.
     it.each([OperationsStages.VALIDATION, OperationsStages.VALIDATED])(
          "%s depends on resultEntryEnd, not resultEntryStart",
          (stage) => {
               const sql = q_get_all_test_ready_for_various_stages("", stage)!;
               expect(sql).toContain("ta.resultEntryEnd IS NOT NULL");
               expect(sql).not.toContain("resultEntryStart");
          },
     );

     it("COMPLETED lists tests whose results have not been saved", () => {
          const sql = q_get_all_test_ready_for_various_stages("", OperationsStages.COMPLETED)!;
          expect(sql).toContain("ta.resultEntryEnd IS NULL");
          expect(sql).not.toContain("resultEntryStart");
     });
     it("keeps saved amended results in validation even when processing timestamps were bypassed", () => {
          const sql = q_get_all_test_ready_for_various_stages("", OperationsStages.VALIDATION)!;
          expect(sql).toContain("dta.requires_revalidation = 1");
          expect(sql).not.toContain("processingStartDate");
          expect(sql).not.toContain("processingEndDATE");
          expect(q_get_all_test_ready_for_various_stages("", OperationsStages.VALIDATED)).toContain(
               "dta.requires_revalidation = 0",
          );
     });
});
