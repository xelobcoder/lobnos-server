import { Router } from 'express';
import { z } from 'zod';
import KnexConnection from '../../database/KnexConnections';
import { getAuthUser } from '../../middleware/authority';
import { requireLaboratoryWorkflowRole, requireResultValidationRole } from '../../middleware/laboratoryWorkflowAuthority';
import { CriticalActionService, controlAudit } from '../../models/operations/CriticalActionService';
import { OutsourceWorkflowService } from '../../models/operations/OutsourceWorkflowService';
import { OutsourceRequestService } from '../../models/operations/OutsourceRequestService';
import { OutsourceAssignmentService } from '../../models/operations/OutsourceAssignmentService';
import { roleAllowed } from '../../middleware/roles';
import { assertLabTestAccess, controlsFail, labAccessSettings, labSupervisor, reportAmendmentSignoffRequired } from '../../models/operations/LabAccessPolicy';
import { getResultReleaseWorkflow, ResultReleaseService } from '../../models/operations/ResultReleaseService';
import ImagingResultAuditRepository from '../../models/operations/imaging/ImagingResultAuditRepository';
import { loadLaboratoryReportData } from '../../models/result/LaboratoryReportData';
import { archiveLaboratoryReport, clinicalReportHash, readReportSnapshot, reportChanges, reportVersionMetadata, reportVersionTable } from '../../models/result/LaboratoryReportVersions';

const router = Router();
router.use((req, res, next) => {
     const actor = getAuthUser(req);
     const reportRoute = req.path.match(/^\/reports\/(\d+)(?:\/versions(?:\/\d+)?|\/amendment|\/release-preview|\/release|\/manager-approval)$/);
     if (reportRoute && actor && roleAllowed(actor.role, ['sonographer']) &&
          Number(req.query.tenantId) === Number(actor.tenantId)) {
          return requireResultValidationRole(req, res, next, reportRoute[1]);
     }
     const samplingOutsource = /^(?:\/billing\/\d+\/outsourcing|\/tests\/\d+\/outsourcing|\/outsourcing\/\d+\/requests(?:\/\d+)?)$/.test(req.path);
     if (samplingOutsource && actor && ['GET', 'PUT', 'POST'].includes(req.method) &&
          roleAllowed(actor.role, ['phlebotomist', 'phelobotomist']) && Number(req.query.tenantId) === Number(actor.tenantId)) {
          if (req.body) req.body.employeeid = actor.employeeid;
          return next();
     }
     return requireLaboratoryWorkflowRole(req, res, next);
});
router.use((req, res, next) => { const actor = getAuthUser(req)!; if (actor.branch == null && !labSupervisor(actor)) return res.status(403).json({ success: false, message: 'An operating branch is required' }); next(); });
const run = (operation: (db: any, actor: any, req: any) => Promise<any>) => async (req: any, res: any) => {
     try { const actor = getAuthUser(req)!; res.setHeader('Cache-Control', 'private, no-store'); res.json({ success: true, data: await operation(await KnexConnection(actor.tenantId), actor, req) }); }
     catch (error: any) { const status = error.name === 'ZodError' ? 400 : Number(error.statusCode) || 500; res.status(status).json({ success: false, message: status === 500 ? 'Laboratory control operation failed' : error.name === 'ZodError' ? error.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') : error.message }); }
};
async function amendmentPreview(db: any, actor: any, ascensionid: number) {
     if (!reportAmendmentSignoffRequired(await labAccessSettings(db))) {
          return controlsFail('Amendment sign-off is disabled for this facility', 409);
     }
     const latest = await db(reportVersionTable).where({ ascensionid }).orderBy('version_number', 'desc').first();
     if (!latest) return controlsFail('No original report was archived for this result', 409);
     const order = await db('test_ascension').where({ id: ascensionid }).first('billingid', 'testid');
     if (!order) return controlsFail('Ordered test not found', 404);
     const isUltrasound = await ImagingResultAuditRepository.isUltrasoundTest(db, Number(order.testid));
     const workflow = await getResultReleaseWorkflow(db, actor.tenantId, ascensionid, actor);
     if (!workflow.canRelease) return controlsFail(
          workflow.managerApprovalRequired && !workflow.managerApproved
               ? 'Manager approval is required before this amendment can be released'
               : 'You are not authorized to sign and release this result amendment',
          workflow.managerApprovalRequired && !workflow.managerApproved ? 409 : 403,
     );
     const bill = await db('billing').where({ billingid: order.billingid }).first('patientid');
     let revision = -1;
     const report = await loadLaboratoryReportData(actor.tenantId, Number(bill.patientid), Number(order.billingid), Number(order.testid), ascensionid, true, 'release', value => { revision = value; });
     if (revision <= Number(latest.revision)) return controlsFail('There is no newly validated amendment to sign', 409);
     return { report, revision, reviewHash: clinicalReportHash(report), changes: reportChanges(readReportSnapshot(latest), report), isUltrasound };
}
router.get('/reports/:ascensionid/versions', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     await assertLabTestAccess(db, actor, ascensionid);
     const rows = await db(reportVersionTable).where({ ascensionid }).orderBy('version_number', 'desc');
     const approval = await db('dbotestresultapproval').where({ ascensionid }).first();
     const order = await db('test_ascension').where({ id: ascensionid }).first('testid');
     const isUltrasound = Boolean(order && await ImagingResultAuditRepository.isUltrasoundTest(db, Number(order.testid)));
     const requireAmendmentSignoff = reportAmendmentSignoffRequired(await labAccessSettings(db));
     const workflow = await getResultReleaseWorkflow(db, actor.tenantId, ascensionid, actor);
     return { versions: rows.map(reportVersionMetadata), isUltrasound, requireAmendmentSignoff, canSign: requireAmendmentSignoff && Boolean(rows.length &&
          Number(approval?.approval_revision) > Number(rows[0].revision) && Number(approval?.isapproved) === 1 &&
          !Number(approval?.requires_revalidation) && order &&
          workflow.canRelease) };
}));
router.get('/reports/:ascensionid/versions/:version', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     const version = z.coerce.number().int().positive().parse(req.params.version);
     await assertLabTestAccess(db, actor, ascensionid);
     const row = await db(reportVersionTable).where({ ascensionid, version_number: version }).first();
     if (!row) return controlsFail('Report version not found', 404);
     const order = await db('test_ascension').where({ id: ascensionid }).first('testid');
     const isUltrasound = Boolean(order && await ImagingResultAuditRepository.isUltrasoundTest(db, Number(order.testid)));
     return { ...reportVersionMetadata(row), isUltrasound, report: readReportSnapshot(row) };
}));
router.get('/reports/:ascensionid/amendment', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     await assertLabTestAccess(db, actor, ascensionid);
     const { report, ...preview } = await amendmentPreview(db, actor, ascensionid);
     return preview;
}));
router.post('/reports/:ascensionid/amendment', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     const data = z.object({ revision: z.number().int().nonnegative(), reason: z.string().trim().min(3).max(2000),
          reviewHash: z.string().regex(/^[a-f0-9]{64}$/), confirmed: z.literal(true) }).parse(req.body);
     await assertLabTestAccess(db, actor, ascensionid);
     const preview = await amendmentPreview(db, actor, ascensionid);
     if (preview.revision !== data.revision || preview.reviewHash !== data.reviewHash) return controlsFail('The report changed. Review the new amendment before signing.', 409);
     const staff = await db('roles').where({ employeeid: actor.employeeid }).first('username');
     if (!staff?.username) return controlsFail('Could not verify the signing staff identity', 403);
     const row = await archiveLaboratoryReport(db, ascensionid, data.revision, preview.report, 'release', {
          id: actor.employeeid, name: staff.username, reason: data.reason, reviewHash: data.reviewHash,
     });
     return reportVersionMetadata(row);
}));
router.get('/reports/:ascensionid/release-preview', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     await assertLabTestAccess(db, actor, ascensionid);
     const workflow = await getResultReleaseWorkflow(db, actor.tenantId, ascensionid, actor);
     if (!workflow.validationComplete || !workflow.differentValidatorSatisfied) return { workflow, report: null, reviewHash: null };
     const order = await db('test_ascension').where({ id: ascensionid }).first('billingid', 'testid');
     if (!order) return controlsFail('Ordered test not found', 404);
     const bill = await db('billing').where({ billingid: order.billingid }).first('patientid');
     if (!bill) return controlsFail('Patient billing record not found', 404);
     let revision = -1;
     const report = await loadLaboratoryReportData(actor.tenantId, Number(bill.patientid), Number(order.billingid), Number(order.testid), ascensionid, true, 'release', value => { revision = value; });
     if (revision !== workflow.revision) return controlsFail('The result changed. Reload the release preview.', 409);
     const [validations, managerApprovals, releases] = await Promise.all([
          db('lab_result_approval_events').where({ ascensionid }).orderBy('created_at', 'desc'),
          db('lab_result_manager_approval_events').where({ ascensionid }).orderBy('created_at', 'desc'),
          db('lab_result_release_events').where({ ascensionid }).orderBy('created_at', 'desc'),
     ]);
     return { workflow, report, reviewHash: clinicalReportHash(report), history: [
          ...validations.map((event: any) => ({ action: 'Validated', revision: event.revision, employeeid: event.employeeid, at: event.created_at })),
          ...managerApprovals.map((event: any) => ({ action: 'Manager approved', revision: event.revision, employeeid: event.employeeid, at: event.created_at })),
          ...releases.map((event: any) => ({ action: 'Signed and released', revision: event.revision, employeeid: event.employeeid, at: event.created_at })),
     ].sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime()) };
}));
router.post('/reports/:ascensionid/manager-approval', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     const data = z.object({
          revision: z.number().int().nonnegative(),
          reason: z.string().trim().min(3).max(2000),
     }).parse(req.body);
     await assertLabTestAccess(db, actor, ascensionid);
     return new ResultReleaseService(actor.tenantId).approveByManager(ascensionid, actor, data.revision, data.reason);
}));
router.post('/reports/:ascensionid/release', run(async (db, actor, req) => {
     const ascensionid = z.coerce.number().int().positive().parse(req.params.ascensionid);
     const data = z.object({
          revision: z.number().int().nonnegative(),
          reviewHash: z.string().regex(/^[a-f0-9]{64}$/),
          reason: z.string().trim().min(3).max(2000),
          confirmed: z.literal(true),
     }).parse(req.body);
     await assertLabTestAccess(db, actor, ascensionid);
     const order = await db('test_ascension').where({ id: ascensionid }).first('billingid', 'testid');
     if (!order) return controlsFail('Ordered test not found', 404);
     const bill = await db('billing').where({ billingid: order.billingid }).first('patientid');
     if (!bill) return controlsFail('Patient billing record not found', 404);
     let revision = -1;
     const report = await loadLaboratoryReportData(actor.tenantId, Number(bill.patientid), Number(order.billingid), Number(order.testid), ascensionid, true, 'release', value => { revision = value; });
     if (revision !== data.revision || clinicalReportHash(report) !== data.reviewHash)
          return controlsFail('The report changed. Review the current result before signing.', 409);
     const staff = await db('roles').where({ employeeid: actor.employeeid }).first('username');
     if (!staff?.username) return controlsFail('Could not verify the signing staff identity', 403);
     return new ResultReleaseService(actor.tenantId).signAndRelease(
          ascensionid, actor, data.revision, report, data.reviewHash, staff.username, data.reason,
     );
}));
router.get('/settings', run(async (db, actor) => ({ ...(await db('lab_access_settings').where({ id: 1 }).first()), can_manage: labSupervisor(actor) })));
router.put('/settings', run(async (db, actor, req) => {
     if (!labSupervisor(actor)) return controlsFail('Only supervisors can change laboratory access settings', 403);
     const data = z.object({ visibility: z.enum(['team', 'restricted']), editing: z.enum(['team', 'assigned']), allow_claim: z.boolean(),
          allow_sonographer_amendment_signing: z.boolean().optional(), require_amendment_signoff: z.boolean().optional(),
          version: z.number().int().positive(), reason: z.string().trim().min(3).max(2000) }).parse(req.body);
     return db.transaction(async (trx: any) => {
          const old = await trx('lab_access_settings').where({ id: 1 }).forUpdate().first();
          if (Number(old.version) !== data.version) return controlsFail('Settings changed. Reload before saving.', 409);
          const { reason, ...values } = data;
          await trx('lab_access_settings').where({ id: 1 }).update({ ...values, version: data.version + 1, updated_by: actor.employeeid, updated_at: new Date() });
          await controlAudit(trx, actor.employeeid, 'lab_access', 1, 'updated', reason, { before: old, after: values }); return { version: data.version + 1 };
     });
}));
router.get('/tests/:id/critical-policies', run((db, actor, req) => new CriticalActionService(db).policies(actor, Number(req.params.id))));
router.put('/tests/:id/critical-policies/:ruleId', run((db, actor, req) => new CriticalActionService(db).savePolicy(actor, Number(req.params.id), Number(req.params.ruleId), req.body)));
router.get('/critical', run((db, actor, req) => new CriticalActionService(db).list(actor, req.query)));
router.get('/critical/legacy/:id', run(async (db, actor, req) => { const event = await db('lab_critical_events').where({ legacy_alert_id: Number(req.params.id) }).first(); if (!event) return controlsFail('Critical event not found', 404); return new CriticalActionService(db).detail(actor, event.id); }));
router.get('/critical/:id', run((db, actor, req) => new CriticalActionService(db).detail(actor, Number(req.params.id))));
router.post('/critical/:id/actions', run((db, actor, req) => new CriticalActionService(db).act(actor, Number(req.params.id), req.body)));
router.get('/billing/:id/outsourcing', run((db, actor, req) => new OutsourceAssignmentService(db).forBilling(actor, z.coerce.number().int().positive().parse(req.params.id))));
router.get('/tests/:id/outsourcing', run((db, actor, req) => new OutsourceAssignmentService(db).context(actor, z.coerce.number().int().positive().parse(req.params.id))));
router.put('/tests/:id/outsourcing', run((db, actor, req) => new OutsourceAssignmentService(db).assign(actor, z.coerce.number().int().positive().parse(req.params.id), req.body)));
router.get('/providers', run((db) => new OutsourceWorkflowService(db).providerOptions()));
router.get('/providers/:id/services', run((db, actor, req) => new OutsourceWorkflowService(db).organizationServices(actor, Number(req.params.id))));
router.put('/providers/:id/services', run((db, actor, req) => new OutsourceWorkflowService(db).saveOrganizationServices(actor, Number(req.params.id), req.body)));
router.get('/tests/:id/providers', run((db, _actor, req) => new OutsourceWorkflowService(db).providers(Number(req.params.id))));
router.put('/tests/:id/providers', run((db, actor, req) => new OutsourceWorkflowService(db).saveProviders(actor, Number(req.params.id), req.body)));
router.get('/outsourcing', run((db, actor, req) => new OutsourceWorkflowService(db).list(actor, req.query)));
router.get('/outsourcing/:id/requests', run((db, actor, req) => new OutsourceRequestService(db).context(actor, z.coerce.number().int().positive().parse(req.params.id))));
router.post('/outsourcing/:id/requests', run((db, actor, req) => new OutsourceRequestService(db).create(actor, z.coerce.number().int().positive().parse(req.params.id), req.body)));
router.get('/outsourcing/:id/requests/:requestId', run((db, actor, req) => new OutsourceRequestService(db).get(actor, z.coerce.number().int().positive().parse(req.params.id), z.coerce.number().int().positive().parse(req.params.requestId))));
router.get('/outsourcing/:id', run((db, actor, req) => new OutsourceWorkflowService(db).detail(actor, Number(req.params.id))));
router.post('/outsourcing/:id/transition', run((db, actor, req) => new OutsourceWorkflowService(db).transition(actor, Number(req.params.id), req.body)));
router.post('/outsourcing/:id/reports', run((db, actor, req) => new OutsourceWorkflowService(db).upload(actor, Number(req.params.id), req.body)));
router.get('/outsourcing/:id/reports/:reportId', async (req, res) => {
     try {
          const actor = getAuthUser(req)!; const report = await new OutsourceWorkflowService(await KnexConnection(actor.tenantId)).download(actor, Number(req.params.id), Number(req.params.reportId));
          res.setHeader('Cache-Control', 'no-store');
          if (req.query.encoding === 'base64') return res.json({ success: true, data: { filename: report.filename, mime: report.mime, base64: Buffer.from(report.content).toString('base64') } });
          res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${String(report.filename).replace(/[^a-zA-Z0-9._ -]/g, '_')}"`);
          res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.send(report.content);
     } catch (error: any) { res.status(Number(error.statusCode) || 500).json({ success: false, message: Number(error.statusCode) ? error.message : 'Report download failed' }); }
});
export default router;
