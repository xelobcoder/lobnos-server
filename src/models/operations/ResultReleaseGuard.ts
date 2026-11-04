import { controlsFail } from "./LabAccessPolicy";
import { assertCriticalRelease } from "./CriticalActionService";
import { assertResultPaymentPolicy } from './ResultPaymentPolicy';
export async function captureReportRevision(db: any, ascensionid: number) {
     const order = await db('test_ascension').where({ id: ascensionid }).first('resultEntryEnd');
     if (!order?.resultEntryEnd) return controlsFail('Save the test results before release', 409);
     const approval = await db("dbotestresultapproval").where({ ascensionid }).first();
     const validators = new Set(String(approval?.approvedBy ?? '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0));
     const minimum = Number(approval?.minvalidation);
     const approved = Number(approval?.isapproved) === 1 || Number.isInteger(minimum) && minimum > 0 && validators.size >= minimum;
     if (!approval || !approved || Number(approval.requires_revalidation) === 1)
          return controlsFail("This result requires validation before release", 409);
     return Number(approval.approval_revision || 0);
}
export async function assertReportRevision(
     db: any,
     ascensionid: number,
     revision: number,
     channel: "print" | "release",
) {
     const current = await captureReportRevision(db, ascensionid);
     if (current !== revision)
          return controlsFail(
               "The result changed while the report was loading. Reload and review the current revision.",
               409,
          );
     if (channel === 'print') await assertResultPaymentPolicy(db, ascensionid, 'print');
     await assertCriticalRelease(db, ascensionid, channel);
}
