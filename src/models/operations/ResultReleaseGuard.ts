import { controlsFail } from './LabAccessPolicy';
import { assertCriticalRelease } from './CriticalActionService';
export async function captureReportRevision(db: any, ascensionid: number) {
     const approval = await db('dbotestresultapproval').where({ ascensionid }).first();
     if (!approval || Number(approval.requires_revalidation) === 1) return controlsFail('This result requires validation before release', 409);
     return Number(approval.approval_revision || 0);
}
export async function assertReportRevision(db: any, ascensionid: number, revision: number, channel: 'print' | 'release') {
     const current = await captureReportRevision(db, ascensionid);
     if (current !== revision) return controlsFail('The result changed while the report was loading. Reload and review the current revision.', 409);
     await assertCriticalRelease(db, ascensionid, channel);
}
