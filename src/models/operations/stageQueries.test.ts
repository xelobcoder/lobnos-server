import { describe, expect, it } from "vitest";
import {
     currentResultPrintAvailabilityCondition,
     currentResultReleaseCondition,
     OperationsStages,
     q_get_all_result_entry_base,
     q_get_all_test_ready_for_various_stages,
} from "./queries";

describe("lab stage queries", () => {
     it.each([OperationsStages.PROCESSING, OperationsStages.COMPLETED])('honors collection and sample-validation bypass in %s', stage => {
          const sql = q_get_all_test_ready_for_various_stages(q_get_all_result_entry_base, stage, false,
               {bypassCollection:true,bypassSampleValidation:true})!;
          expect(sql).toContain('WHERE 1 = 1 AND 1 = 1');
          expect(sql).toContain('LEFT JOIN samplestatus');
          expect(sql).toContain('tp.id = ta.testid');
          expect(sql).toContain('ta.resultEntryEnd IS NULL');
     });
     it('keeps enabled prerequisites when bypass is off', () => {
          const sql = q_get_all_test_ready_for_various_stages(q_get_all_result_entry_base, OperationsStages.PROCESSING)!;
          expect(sql).toContain('ss.approvalstatus = 1');
          expect(sql).toContain('ta.collectionStartDate IS NOT NULL');
     });
     it.each([OperationsStages.SIGN_RELEASE, OperationsStages.RELEASED])('filters %s by current signed revision and required manager approval', stage => {
          const sql = q_get_all_test_ready_for_various_stages(q_get_all_result_entry_base, stage, false, {requireManagerApproval:true})!;
          expect(sql).toContain('re.revision = COALESCE(dta.approval_revision, 0)');
          expect(sql).toContain('rv.signed_by IS NOT NULL');
          expect(sql).toContain('lab_result_manager_approval_events');
          expect(sql.includes('AND NOT ((EXISTS')).toBe(stage === OperationsStages.SIGN_RELEASE);
     });
     it('does not queue signing when explicit result release is disabled', () => {
          const signRelease = q_get_all_test_ready_for_various_stages(q_get_all_result_entry_base, OperationsStages.SIGN_RELEASE, false,
               {requireExplicitResultRelease:false})!;
          const released = q_get_all_test_ready_for_various_stages(q_get_all_result_entry_base, OperationsStages.RELEASED, false,
               {requireExplicitResultRelease:false})!;
          expect(signRelease).toContain('AND 1 = 0');
          expect(signRelease).not.toContain('lab_result_release_events');
          expect(released).not.toContain('lab_result_release_events');
     });
     it('checks release records against the supplied current revision', () => {
          const sql = currentResultReleaseCondition('ta.id', 'current_revision', true);
          expect(sql).toContain('re.ascensionid = ta.id AND re.revision = current_revision');
          expect(sql).toContain('rv.ascensionid = ta.id AND rv.revision = current_revision AND rv.signed_by IS NOT NULL');
          expect(sql).toContain('ma.ascensionid = ta.id AND ma.revision = current_revision');
     });
     it('treats a validated result as print-ready when sign-off is optional and still checks required manager approval', () => {
          const optional = currentResultPrintAvailabilityCondition('ta.id', 'current_revision', false);
          expect(optional).toContain('ta.resultEntryEnd IS NOT NULL');
          expect(optional).toContain('approval.isapproved = 1');
          expect(optional).not.toContain('lab_result_release_events');

          const optionalWithManagerApproval = currentResultPrintAvailabilityCondition('ta.id', 'current_revision', false, true);
          expect(optionalWithManagerApproval).toContain('ma.ascensionid = ta.id AND ma.revision = current_revision');

          const required = currentResultPrintAvailabilityCondition('ta.id', 'current_revision', true);
          expect(required).toContain('lab_result_release_events');
     });
     it.each([OperationsStages.VALIDATION, OperationsStages.VALIDATED])('keeps saved results visible in %s after collection bypass', stage => {
          const sql = q_get_all_test_ready_for_various_stages(q_get_all_result_entry_base, stage)!;
          expect(sql).not.toContain('WHERE ss.approvalstatus = 1');
          expect(sql).not.toContain('ta.collectionStartDate IS NOT NULL');
          expect(sql).toContain('ta.resultEntryEnd IS NOT NULL');
          expect(sql).toContain('ds.isDeleted = 0');
          expect(sql).toContain('LEFT JOIN samplestatus');
          expect(sql).toContain('tp.id = ta.testid');
          expect(sql).toContain('rdel.ascensionid = ta.id');
     });
     it('routes processing-bypassed requests to result entry without fabricating timestamps', () => {
          const completed = q_get_all_test_ready_for_various_stages('', OperationsStages.COMPLETED, true)!;
          expect(completed).toContain('ta.resultEntryEnd IS NULL');
          expect(completed).not.toContain('processingStartDate');
          expect(completed).not.toContain('processingEndDATE');
          expect(completed).toContain("d.department <> 'ultrasound'");
          expect(q_get_all_test_ready_for_various_stages('', OperationsStages.PROCESSING, true)).toContain('AND 1 = 0');
     });
     it('still requires processing timestamps when processing is enabled', () => {
          const sql = q_get_all_test_ready_for_various_stages('', OperationsStages.COMPLETED, false)!;
          expect(sql).toContain('ta.processingStartDate IS NOT NULL');
          expect(sql).toContain('ta.processingEndDATE IS NOT NULL');
     });
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
