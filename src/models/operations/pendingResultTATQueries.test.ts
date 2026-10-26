import { describe, expect, it } from "vitest";
import {
     buildPendingResultTATCountQuery,
     buildPendingResultTATPageQuery,
     buildPendingResultTATSummaryQuery,
     PENDING_RESULT_TAT_THRESHOLDS,
} from "./pendingResultTATQueries";

describe("pending result TAT queries", () => {
     it("uses the established ascension-to-result clock and requested cumulative thresholds", () => {
          const summary = buildPendingResultTATSummaryQuery();
          expect(PENDING_RESULT_TAT_THRESHOLDS).toEqual([6, 12, 24, 32, 64]);
          expect(summary.query).toContain("ta.resultEntryEnd IS NULL");
          expect(summary.query).toContain("ta.ascension_date IS NOT NULL");
          expect(summary.query).toContain("TIMESTAMPDIFF(MINUTE, ta.ascension_date, NOW())");
          expect(summary.params).toEqual([360, 720, 1440, 1920, 3840]);
     });

     it("excludes deleted, voided, refunded, and cancelled services", () => {
          const count = buildPendingResultTATCountQuery(12);
          expect(count.query).toContain("(ss.isDeleted = 0 OR ss.isDeleted IS NULL)");
          expect(count.query).toContain("NOT IN ('voided', 'refunded', 'cancelled', 'written-off')");
          expect(count.params).toEqual([720]);
     });

     it("returns stable paginated overdue rows with patient and collection context", () => {
          const page = buildPendingResultTATPageQuery(24, 25, 50);
          expect(page.query).toContain("np.fullpatientid AS patientNumber");
          expect(page.query).toContain("ta.collectionEndDate AS collectedAt");
          expect(page.query).toContain("ORDER BY elapsedMinutes DESC, ta.id ASC");
          expect(page.query).toContain("LIMIT ? OFFSET ?");
          expect(page.params).toEqual([1440, 25, 50]);
     });
});
