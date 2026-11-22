import {assertResultLinearity} from '../results/ResultLinearityService';
import KnexConnection from '../../database/KnexConnections';
import ResultSettings from '../application/appsettings/result-settings/resultSettings';
import { roleAllowed } from '../../middleware/roles';
import { controlsFail } from './LabAccessPolicy';
import { captureReportRevision } from './ResultReleaseGuard';
import { archiveLaboratoryReport, clinicalReportHash } from '../result/LaboratoryReportVersions';

export interface ResultReleaseActor {
     tenantId: number;
     employeeid: number;
     role: string;
}

function parseValidatorIds(value: unknown) {
     return new Set(String(value ?? '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0));
}

export function canStaffReleaseResult(settings: any, actor?: ResultReleaseActor) {
     if (!actor) return false;
     if (settings?.resultReleasePolicy === 'managers_only') return roleAllowed(actor.role, ['admin', 'manager']);
     if (settings?.resultReleasePolicy && settings.resultReleasePolicy !== 'selected_staff') return false;
     if (roleAllowed(actor.role, ['admin', 'manager'])) return true;
     const configured = settings?.staffQualifiedToReleaseResult;
     const staff = Array.isArray(configured) && configured.length ? configured : settings?.staffQualifiedToValidationResult;
     return Array.isArray(staff) && staff.map(Number).includes(Number(actor.employeeid));
}

export async function getResultReleaseWorkflow(db: any, tenantId: number, ascensionid: number, actor?: ResultReleaseActor) {
     const workflows = await getResultReleaseWorkflows(db, tenantId, [ascensionid], actor);
     return workflows[ascensionid];
}

export async function getResultReleaseWorkflows(
     db: any,
     tenantId: number,
     ascensionids: number[],
     actor?: ResultReleaseActor,
) {
     const ids = [...new Set(ascensionids.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
     if (!ids.length) return {} as Record<number, any>;
     const [orders, approvals, settings, authors, managerEvents, releaseEvents, signedVersions] = await Promise.all([
          db('test_ascension').whereIn('id', ids).select('id', 'resultEntryEnd'),
          db('dbotestresultapproval').whereIn('ascensionid', ids),
          ResultSettings.getResultEntrySettings(tenantId),
          db('test_results').whereIn('ascensionid', ids).whereNotNull('employeeid').select('ascensionid', 'employeeid'),
          db('lab_result_manager_approval_events').whereIn('ascensionid', ids),
          db('lab_result_release_events').whereIn('ascensionid', ids),
          db('lab_report_versions').whereIn('ascensionid', ids).whereNotNull('signed_by'),
     ]);
     const orderById = new Map<number, any>(orders.map((row: any) => [Number(row.id), row]));
     const approvalById = new Map<number, any>(approvals.map((row: any) => [Number(row.ascensionid), row]));
     const authorsById = new Map<number, Set<number>>();
     for (const author of authors) {
          const key = Number(author.ascensionid);
          if (!authorsById.has(key)) authorsById.set(key, new Set());
          authorsById.get(key)!.add(Number(author.employeeid));
     }
     const result: Record<number, any> = {};
     for (const ascensionid of ids) {
          const order = orderById.get(ascensionid);
          const approval = approvalById.get(ascensionid);
          const revision = Number(approval?.approval_revision || 0);
          const validators = parseValidatorIds(approval?.approvedBy);
          const minimum = Number(approval?.minvalidation);
          const authorIds = authorsById.get(ascensionid) || new Set<number>();
          const validationComplete = Boolean(order?.resultEntryEnd && approval &&
               (Number(approval.isapproved) === 1 || Number.isInteger(minimum) && minimum > 0 && validators.size >= minimum) &&
               Number(approval.requires_revalidation) !== 1);
          const authorValidated = [...authorIds].some(id => validators.has(id));
          const differentValidatorRequired = Boolean(settings?.requireDifferentValidatorFromResultAuthor);
          const differentValidatorSatisfied = !differentValidatorRequired || authorIds.size > 0 && !authorValidated;
          const explicitReleaseRequired=settings?.requireExplicitResultRelease!==false&&Number(settings?.requireExplicitResultRelease)!==0;
          const managerApprovalRequired = Boolean(settings?.requireManagerApprovalBeforeRelease);
          const managerApproval = managerEvents.find((event: any) =>
               Number(event.ascensionid) === ascensionid && Number(event.revision) === revision);
          const managerApproved = Boolean(managerApproval);
          const releaseEvent = releaseEvents.find((event: any) =>
               Number(event.ascensionid) === ascensionid && Number(event.revision) === revision);
          const signedVersion = releaseEvent ? null : signedVersions.find((version: any) =>
               Number(version.ascensionid) === ascensionid && Number(version.revision) === revision);
          const released = Boolean(validationComplete && differentValidatorSatisfied && (releaseEvent || signedVersion) && (!managerApprovalRequired || managerApproved));
          const releaseAuthorized = canStaffReleaseResult(settings, actor);
          const actorIsAuthor = Boolean(actor && authorIds.has(Number(actor.employeeid)));
          const supervisor = Boolean(actor && roleAllowed(actor.role, ['admin', 'manager']));
          const canRelease = Boolean(actor && validationComplete && differentValidatorSatisfied &&
               (!managerApprovalRequired || managerApproved) && !released && releaseAuthorized &&
               (!actorIsAuthor || supervisor || Boolean(settings?.allowResultAuthorToRelease)) &&
               (!settings?.requireDifferentReleaserFromValidator || !validators.has(Number(actor.employeeid))));
          const canApproveManager = Boolean(actor && roleAllowed(actor.role, ['admin', 'manager']) &&
               managerApprovalRequired && validationComplete && differentValidatorSatisfied && !managerApproved);
          let releaseStatus = 'awaiting_validation';
          if (validationComplete && !differentValidatorSatisfied) releaseStatus = 'awaiting_different_validator';
          else if (validationComplete && managerApprovalRequired && !managerApproved) releaseStatus = 'awaiting_manager_approval';
          else if (released) releaseStatus = 'released';
          else if (validationComplete) releaseStatus = explicitReleaseRequired?'awaiting_release':'release_optional';
          const releaseBlockedReason = released ? 'This result has already been signed and released.'
               : !validationComplete ? 'Complete the required result validations first.'
               : !differentValidatorSatisfied ? 'A validator who did not enter the result must approve it.'
               : managerApprovalRequired && !managerApproved ? 'Manager approval is required before release.'
               : !releaseAuthorized ? 'Your account is not authorized by the result release policy.'
               : actorIsAuthor && !supervisor && !settings?.allowResultAuthorToRelease ? 'The scientist who entered this result cannot release it under the current settings.'
               : settings?.requireDifferentReleaserFromValidator && actor && validators.has(Number(actor.employeeid)) ? 'A staff member who did not validate this result must release it.' : null;
          result[ascensionid] = {
               ascensionid, revision, viewerEmployeeId: actor?.employeeid ?? null, validationComplete, validationCount: validators.size,
               validationRequired: Number.isInteger(minimum) && minimum > 0 ? minimum : 1,
               requiresRevalidation: Number(approval?.requires_revalidation) === 1,
               enteredBy: authorIds.values().next().value ?? null, enteredByIds: [...authorIds],
               validatorIds: [...validators],
               differentReleaserRequired: Boolean(settings?.requireDifferentReleaserFromValidator),
               differentValidatorRequired, differentValidatorSatisfied,
               explicitReleaseRequired, availableForPrinting:validationComplete&&differentValidatorSatisfied&&(!managerApprovalRequired||managerApproved)&&(!explicitReleaseRequired||released),
               managerApprovalRequired, managerApproved,
               managerApprovedBy: managerApproval?.employeeid ?? null,
               managerApprovedAt: managerApproval?.created_at ?? null,
               released, releaseStatus, resultReleasePolicy: settings?.resultReleasePolicy || 'selected_staff',
               releasedBy: releaseEvent?.employeeid ?? signedVersion?.signed_by ?? null,
               releasedByName: releaseEvent?.signer_name ?? signedVersion?.signer_name ?? null,
               releasedAt: releaseEvent?.created_at ?? signedVersion?.recorded_at ?? null,
               reportVersionId: releaseEvent?.report_version_id ?? signedVersion?.id ?? null,
               canApproveManager, canRelease, releaseBlockedReason,
          };
     }
     return result;
}

export class ResultReleaseService {
     constructor(private tenantId: number) {}

     async approveByManager(ascensionid: number, actor: ResultReleaseActor, revision: number, reason: string) {
          if (actor.tenantId !== this.tenantId) return controlsFail('The approval belongs to another facility', 403);
          if (!roleAllowed(actor.role, ['admin', 'manager'])) return controlsFail('Only a manager or administrator can approve results', 403);
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
               const workflow = await getResultReleaseWorkflow(trx, this.tenantId, ascensionid, actor);
               if (workflow.revision !== revision) return controlsFail('The result changed. Reload before approving.', 409);
               if (!workflow.managerApprovalRequired) return controlsFail('Manager approval is not required for this facility', 409);
               if (!workflow.validationComplete) return controlsFail('Complete result validation before manager approval', 409);
               if (!workflow.differentValidatorSatisfied) return controlsFail('A different validator is required before manager approval', 409);
               if (workflow.managerApproved) return workflow;
               await captureReportRevision(trx, ascensionid, 'release');
               await trx('lab_result_manager_approval_events').insert({
                    ascensionid, revision, employeeid: actor.employeeid, reason, created_at: new Date(),
               });
               return getResultReleaseWorkflow(trx, this.tenantId, ascensionid, actor);
          });
     }

     async signAndRelease(
          ascensionid: number,
          actor: ResultReleaseActor,
          revision: number,
          report: any,
          reviewHash: string,
          signerName: string,
          reason: string,
     ) {
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async (trx: any) => {
               await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
               const workflow = await getResultReleaseWorkflow(trx, this.tenantId, ascensionid, actor);
               if (workflow.revision !== revision) return controlsFail('The result changed. Review the current result before releasing.', 409);
               if (!workflow.validationComplete) return controlsFail('Complete result validation before release', 409);
               if (!workflow.differentValidatorSatisfied) return controlsFail('A different validator is required before release', 409);
               if (workflow.managerApprovalRequired && !workflow.managerApproved)
                    return controlsFail('Manager approval is required before release', 409);
               if (workflow.released) return controlsFail('This result revision has already been released', 409);
               const currentSettings = await ResultSettings.getResultEntrySettings(this.tenantId);
               const actorIsAuthor = workflow.enteredByIds.includes(Number(actor.employeeid));
               if (!canStaffReleaseResult(currentSettings, actor))
                    return controlsFail('You are not authorized to release results', 403);
               if (actorIsAuthor && !roleAllowed(actor.role, ['admin', 'manager']) && !currentSettings?.allowResultAuthorToRelease)
                    return controlsFail('The result author is not authorized to release this result', 403);
               if (currentSettings?.requireDifferentReleaserFromValidator && workflow.validatorIds.includes(Number(actor.employeeid)))
                    return controlsFail('The releasing staff member must be different from the validators', 403);
               if (actor.tenantId !== this.tenantId) return controlsFail('The release belongs to another facility', 403);
               if (clinicalReportHash(report) !== reviewHash)
                    return controlsFail('The report to sign changed. Reload and review it before release.', 409);
               const currentTest=await trx('test_ascension').where({id:ascensionid}).first();
               await assertResultLinearity(trx,ascensionid,Number(currentTest?.testid));
               const currentRevision = await captureReportRevision(trx, ascensionid, 'release');
               if (currentRevision !== revision) return controlsFail('The result changed. Review the current result before releasing.', 409);
               const reportVersion = await archiveLaboratoryReport(trx, ascensionid, revision, report, 'release', undefined, false);
               const [id] = await trx('lab_result_release_events').insert({
                    ascensionid, revision, report_version_id: reportVersion.id,
                    employeeid: actor.employeeid, signer_name: signerName,
                    signature_hash: reviewHash, reason, created_at: new Date(),
               });
               const event = await trx('lab_result_release_events').where({ id }).first();
               return { ...workflow, released: true, releaseStatus: 'released',
                    releasedBy: event.employeeid, releasedByName: event.signer_name,
                    releasedAt: event.created_at, reportVersionId: event.report_version_id };
          });
     }
}
