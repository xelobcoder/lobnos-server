import {assertResultLinearity} from '../results/ResultLinearityService';
import KnexConnection from '../../database/KnexConnections';
import ResultSettings from '../application/appsettings/result-settings/resultSettings';
import { OperationsFailures } from './types';
import ImagingResultAuditRepository from './imaging/ImagingResultAuditRepository';
import { assertResultPaymentPolicy, canPerformResultAction } from './ResultPaymentPolicy';
import { DeltaCheckBlockedError, evaluateResultDeltas, recordDeltaEvents } from '../results/ResultDeltaService';
import { normalizeRole } from '../../middleware/roles';
import { InstrumentMaintenanceService } from '../QualityControl/InstrumentMaintenanceService';

export async function invalidateResultApprovals(trx: any, ascensionid: number, employeeid: number) {
     const previous = await trx('dbotestresultapproval').where({ ascensionid }).forUpdate().first();
     if (!previous) throw Object.assign(new Error('Result approval configuration is missing'), { statusCode: 409 });
     const revision = Number(previous.approval_revision || 0) + 1;
     await trx('dbotestresultapproval').where({ ascensionid }).update({ approvedBy: null, isapproved: 0, approval_revision: revision, requires_revalidation: Number(previous.requires_revalidation) === 1 || Number(previous.isapproved) === 1 || !!previous.approvedBy ? 1 : 0, lastupdatedon: new Date() });
     await trx('lab_work_actions').insert({ ascensionid, employeeid, action: 'result_saved', reason: null,
          metadata: JSON.stringify({ revision, invalidated_validators: previous.approvedBy || null }), created_at: new Date() });
     return revision;
}

/** Initial-entry bypass must never release an amended result awaiting revalidation. */
export async function applyResultValidationBypass(trx: any, ascensionid: number, employeeid: number, enabled: boolean, tenantId: number) {
     if (!enabled) return;
     const test=await trx('test_ascension').where({id:ascensionid}).first();
     try{await assertResultLinearity(trx,ascensionid,Number(test?.testid));}catch(error:any){if(error.code==='LINEARITY_CHECK_BLOCKED')return;throw error;}
     const bill=await trx('billing').where({billingid:test?.billingid}).first();
     const delta=await evaluateResultDeltas(trx,{tenantId,ascensionid,testid:Number(test?.testid),patientid:Number(bill?.patientid||0)});
     if(delta.blocking.length)return;
     if(delta.violations.length)await recordDeltaEvents(trx,{ascensionid,testid:Number(test?.testid),patientid:Number(bill?.patientid||0)},delta.violations,employeeid);
     const settings = await ResultSettings.getResultEntrySettings(tenantId);
     if (typeof settings === 'object' && settings?.requireDifferentValidatorFromResultAuthor) return;
     if (!await canPerformResultAction(trx, ascensionid, 'validation', true)) return;
     await trx('dbotestresultapproval').where({ ascensionid }).where('requires_revalidation', 0)
          .update({ isapproved: 1, approvedBy: employeeid, lastupdatedon: new Date() });
}

export class ResultApprovalService {
     constructor(private tenantId: number) { }
     async approve(ascensionid: number, employeeid: number, branchid?: number | null, expectedRevision?: number, deltaAcknowledgementReason?: string, actorRole?: string): Promise<boolean | string> {
          const entrySettings = await ResultSettings.getResultEntrySettings(this.tenantId);
          const canValidate = await ResultSettings.canStaffApproveResult(this.tenantId, employeeid);
          const isSonographer = normalizeRole(actorRole) === 'sonographer';
          if (!canValidate && !isSonographer) return OperationsFailures.dontHaveAccessPermission;
          const db = await KnexConnection(this.tenantId);
          const reference = await db('test_ascension').where({ id: ascensionid }).first();
          if (!reference) throw Object.assign(new Error('Ordered test not found'), { statusCode: 404 });
          const ultrasound = isSonographer && await ImagingResultAuditRepository.isUltrasoundTest(db, Number(reference.testid));
          if (!canValidate && !ultrasound) return OperationsFailures.dontHaveAccessPermission;
          const imaging = await ImagingResultAuditRepository.isImagingTest(db, reference.testid);
          if (imaging) await ImagingResultAuditRepository.ensureTable(this.tenantId);
          return db.transaction(async trx => {
               const ascension = await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
               await new InstrumentMaintenanceService(this.tenantId).assertAscensionClear(trx, ascensionid);
               const bill = await trx('billing').where({ billingid: ascension.billingid }).first();
               if (branchid != null && Number(bill?.branchid) !== Number(branchid)) throw Object.assign(new Error('Ordered test belongs to another branch'), { statusCode: 403 });
               if (!ascension.resultEntryEnd) throw Object.assign(new Error('Save the test results before approval'), { statusCode: 409 });
               if (typeof entrySettings === 'object' && entrySettings?.requireDifferentValidatorFromResultAuthor) {
                    const authors = await trx('test_results').where({ ascensionid }).whereNotNull('employeeid').distinct('employeeid');
                    if (!authors.length) throw Object.assign(new Error('The result author could not be verified. Contact your laboratory administrator.'), { statusCode: 409 });
                    if (authors.some((author: any) => Number(author.employeeid) === employeeid))
                         throw Object.assign(new Error('A result author cannot validate their own result under the current facility policy.'), { statusCode: 403 });
               }
               if (!canValidate && ultrasound && !await ImagingResultAuditRepository.isResultAuthor(trx, ascensionid, Number(ascension.testid), employeeid)) {
                    throw Object.assign(new Error('A sonographer can validate only an ultrasound report they have saved'), { statusCode: 403 });
               }
               await assertResultPaymentPolicy(trx, ascensionid, 'validation', true);

               await assertResultLinearity(trx,ascensionid,Number(ascension.testid));
               // Delta checks run inside the approval transaction. A blocking rule needs an explicit
               // supervisor acknowledgement reason; warnings are audited and allowed.
               const delta = await evaluateResultDeltas(trx, {
                    tenantId: this.tenantId,
                    ascensionid,
                    testid: Number(ascension.testid),
                    patientid: Number(bill?.patientid || 0),
               });
               if (delta.blocking.length && !String(deltaAcknowledgementReason || '').trim()) {
                    throw new DeltaCheckBlockedError(delta.blocking);
               }
               if (delta.violations.length) {
                    await recordDeltaEvents(trx, {
                         ascensionid,
                         testid: Number(ascension.testid),
                         patientid: Number(bill?.patientid || 0),
                    }, delta.violations, employeeid, String(deltaAcknowledgementReason || '').trim() || null);
               }
               const previous = await trx('dbotestresultapproval').where({ ascensionid }).forUpdate().first();
               if (!previous) throw Object.assign(new Error('Result approval configuration is missing'), { statusCode: 409 });
               if (!Number.isSafeInteger(expectedRevision) || Number(expectedRevision) !== Number(previous.approval_revision || 0)) throw Object.assign(new Error('The result has changed. Reload and review the latest result before validating.'), { statusCode: 409 });
               const validators = [...new Set(String(previous.approvedBy || '').split(',').map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
               if (validators.includes(employeeid)) return true; // An identical retry is already applied.
               const maximum = Number(previous.maxvalidation);
               const minimum = Number(previous.minvalidation);
               if (!Number.isInteger(minimum) || minimum < 1 || !Number.isInteger(maximum) || maximum < minimum) throw Object.assign(new Error('Invalid minimum/maximum result approval configuration'), { statusCode: 409 });
               if (validators.length >= maximum) return OperationsFailures.maximumResultValidation;
               validators.push(employeeid);
               const approved = validators.length >= minimum ? 1 : 0;
               const revision = Number(previous.approval_revision || 0);
               await trx('lab_result_approval_events').insert({ ascensionid, revision, employeeid, created_at: new Date() });
               await trx('dbotestresultapproval').where({ ascensionid }).update({ approvedBy: validators.join(','), isapproved: approved, requires_revalidation: approved ? 0 : Number(previous.requires_revalidation || 0), lastupdatedon: new Date() });
               if (imaging) await ImagingResultAuditRepository.record(trx, [
                    { ascensionid, testid: ascension.testid, billingid: ascension.billingid, entityType: 'APPROVAL', entityId: ascensionid,
                         action: approved ? 'FINALIZE' : 'UPDATE', employeeid, fieldName: 'approvedBy', oldValue: String(previous.approvedBy || ''), newValue: validators.join(',') },
               ]);
               return true;
          });
     }
}
