import { controlsFail } from "./LabAccessPolicy";
import { assertCriticalRelease } from "./CriticalActionService";
import { assertResultPaymentPolicy } from './ResultPaymentPolicy';

async function resultEntryPolicy(db: any) {
     const row = await db('resultsettings').where({ id: 1 }).first('resultsEntrySettings');
     if (!row?.resultsEntrySettings) return {};
     try {
          return JSON.parse(row.resultsEntrySettings);
     } catch {
          return controlsFail('Result authorization settings are invalid. Contact your administrator.', 503);
     }
}

export async function explicitResultReleaseRequired(db:any){const policy=await resultEntryPolicy(db);return policy.requireExplicitResultRelease!==false&&policy.requireExplicitResultRelease!==0;}

function validatorIds(value: unknown) {
     return new Set(String(value ?? '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0));
}

function printReleaseFail(message: string): never {
     throw Object.assign(new Error(message), { statusCode: 409, code: 'RESULT_NOT_RELEASED' });
}

export async function captureReportRevision(db: any, ascensionid: number, channel: 'print' | 'release' = 'print') {
     const order = await db('test_ascension').where({ id: ascensionid }).first('resultEntryEnd');
     if (!order?.resultEntryEnd) return controlsFail('Save the test results before release', 409);
     const approval = await db("dbotestresultapproval").where({ ascensionid }).first();
     const validators = validatorIds(approval?.approvedBy);
     const minimum = Number(approval?.minvalidation);
     const approved = Number(approval?.isapproved) === 1 || Number.isInteger(minimum) && minimum > 0 && validators.size >= minimum;
     if (!approval || !approved || Number(approval.requires_revalidation) === 1)
          return controlsFail("This result requires validation before release", 409);
     const policy = await resultEntryPolicy(db);
     if (policy.requireDifferentValidatorFromResultAuthor) {
          const authors = await db('test_results').where({ ascensionid }).whereNotNull('employeeid').distinct('employeeid');
          if (!authors.length)
               return controlsFail('The result author could not be verified. Contact your laboratory administrator.', 409);
          if (authors.some((author: any) => validators.has(Number(author.employeeid))))
               return controlsFail('A different validator is required before this result can be released.', 409);
     }
     if (channel === 'print') {
          const revision = Number(approval.approval_revision || 0);
          await assertResultFormallyReleased(db, ascensionid, revision);
     }
     return Number(approval.approval_revision || 0);
}
export async function assertResultFormallyReleased(db: any, ascensionid: number, revision: number) {
     const policy = await resultEntryPolicy(db);
     if (policy.requireManagerApprovalBeforeRelease === true || Number(policy.requireManagerApprovalBeforeRelease) === 1) {
          const manager = await db('lab_result_manager_approval_events').where({ ascensionid, revision }).first('id');
          if (!manager) return printReleaseFail('Manager approval is required before release.');
     }
     if(policy.requireExplicitResultRelease===false||policy.requireExplicitResultRelease===0)return;
     const event = await db('lab_result_release_events').where({ ascensionid, revision }).first('id');
     const signed = event ? null : await db('lab_report_versions').where({ ascensionid, revision }).whereNotNull('signed_by').first('id');
     if (!event && !signed) return printReleaseFail('This result has not been signed and released.');
}

export async function assertReportRevision(
     db: any,
     ascensionid: number,
     revision: number,
     channel: "print" | "release",
) {
     const current = await captureReportRevision(db, ascensionid, channel);
     if (current !== revision)
          return controlsFail(
               "The result changed while the report was loading. Reload and review the current revision.",
               409,
          );
     if (channel === 'print') await assertResultPaymentPolicy(db, ascensionid, 'print');
     await assertCriticalRelease(db, ascensionid, channel);
}
