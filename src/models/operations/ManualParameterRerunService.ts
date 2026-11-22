import { v4 as uuidv4 } from 'uuid';
import KnexConnection from '../../database/KnexConnections';
import { encrypt_value, decrypt_value } from '../../utils/encryptionModels';
import { assertLabTestAccess } from './LabAccessPolicy';
import { invalidateResultApprovals } from './ResultApprovalService';
import { ensureManualParameterRerunSchema } from './ManualParameterRerunSchema';
import { evaluateCriticalActions } from './CriticalActionService';
import { TestAscension } from './ascension';
import { assertResultPaymentPolicy } from './ResultPaymentPolicy';

const fail = (message: string, statusCode = 409): never => { throw Object.assign(new Error(message), { statusCode }); };
const positiveId = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const parseIds = (value: unknown): number[] => {
     let parsed: any;
     try { parsed = typeof value === 'string' ? JSON.parse(value) : value; } catch { return []; }
     return Array.isArray(parsed) ? parsed.map(Number) : [];
};

export class ManualParameterRerunService {
     constructor(private tenantId: number) {}

     async start(actor: any, ascensionid: number, fieldIds: number[]) {
          if (!positiveId(ascensionid) || !Array.isArray(fieldIds) || !fieldIds.length ||
               fieldIds.some(id => !positiveId(id)) || new Set(fieldIds.map(Number)).size !== fieldIds.length)
               fail('Select one or more valid parameters', 400);
          const db = await KnexConnection(this.tenantId);
          await ensureManualParameterRerunSchema(db);
          await assertLabTestAccess(db, actor, ascensionid, true);
          return db.transaction(async trx => {
               const order = await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
               if (!order) fail('Ordered test not found', 404);
               await assertResultPaymentPolicy(trx, ascensionid, 'entry', true);
               const bill = await trx('billing').where({ billingid: order.billingid }).first();
               if (!positiveId(bill?.patientid)) fail('Ordered test ownership could not be verified', 409);
               const active = await trx('lab_manual_parameter_reruns').where({ ascensionid }).where('status', 'awaiting_results').first();
               if (active) fail('A parameter rerun is already awaiting results');
               const rules = await trx('testcreationrules').where({ testid: order.testid }).select('id', 'manual_rerun_enabled');
               const enabled = new Set(rules.filter((rule: any) => Number(rule.manual_rerun_enabled) === 1).map((rule: any) => Number(rule.id)));
               if (fieldIds.some(id => !enabled.has(Number(id)))) fail('A selected parameter is not enabled for manual rerun', 403);
               const current = await trx('test_results').where({ ascensionid, testid: order.testid })
                    .select('fieldid', 'billingid', 'patientid');
               if (current.some((row: any) => Number(row.billingid) !== Number(order.billingid) ||
                    Number(row.patientid) !== Number(bill.patientid)))
                    fail('Stored result ownership requires administrator review');
               const available = new Set(current.map((row: any) => Number(row.fieldid)));
               if (fieldIds.some(id => !available.has(Number(id)))) fail('A selected parameter has no current result to rerun');
               const [rerunId] = await trx('lab_manual_parameter_reruns').insert({
                    ascensionid, testid: order.testid, billingid: order.billingid, patientid: bill.patientid,
                    field_ids: JSON.stringify(fieldIds.map(Number)), confirmed_field_ids: JSON.stringify([]),
                    status: 'awaiting_results', initiated_by: actor.employeeid, created_at: new Date(), updated_at: new Date(),
               });
               await invalidateResultApprovals(trx, ascensionid, actor.employeeid);
               await trx('dbotestresultapproval').where({ ascensionid }).update({ isapproved: 0, approvedBy: null, requires_revalidation: 1 });
               // Keep resultEntryStart and processing/sample state intact. A null end date returns
               // the ordered test to the existing result/interface waiting workflow.
               await trx('test_ascension').where({ id: ascensionid }).update({ resultEntryEnd: null });
               await trx('lab_manual_parameter_rerun_events').insert({
                    rerun_id: rerunId, ascensionid, employeeid: actor.employeeid, action: 'initiated',
                    metadata: JSON.stringify({ field_ids: fieldIds.map(Number) }), created_at: new Date(),
               });
               return { rerunId: Number(rerunId), ascensionid, fieldIds: fieldIds.map(Number), status: 'awaiting_results' };
          });
     }

     /** Called by the existing device/interface result writer. No current result is modified here. */
     async stageAnalyzerResults(trx: any, ascensionid: number, testid: number, fields: any[], employeeid: number): Promise<boolean> {
          const rerun = await trx('lab_manual_parameter_reruns').where({ ascensionid, testid })
               .where('status', 'awaiting_results').forUpdate().first();
          if (!rerun) return false;
          await assertResultPaymentPolicy(trx, ascensionid, 'entry', true);
          if (fields.some(field => (field.entrymode || 'manual') !== 'automatic'))
               fail('Manual entry is paused while this rerun is active. Enter rerun values from Actions > Manual parameter rerun.');
          const selected = new Set(parseIds(rerun.field_ids));
          const staged: number[] = [];
          for (const field of fields) {
               const fieldid = Number(field.fieldid);
               if (!selected.has(fieldid)) continue;
               const value = encrypt_value(String(field.value));
               const originalvalue = encrypt_value(String(field.originalvalue));
               await trx('lab_manual_parameter_rerun_values').insert({
                    rerun_id: rerun.id, fieldid, field: String(field.field || ''),
                    value, originalvalue, entrymode: 'automatic', received_by: employeeid, received_at: new Date(),
               }).onConflict(['rerun_id', 'fieldid']).merge({
                    field: String(field.field || ''), value, originalvalue, entrymode: 'automatic',
                    received_by: employeeid, received_at: new Date(),
               });
               staged.push(fieldid);
          }
          if (!staged.length) fail('Analyzer response did not contain any selected rerun parameters', 422);
          await trx('lab_manual_parameter_rerun_events').insert({
               rerun_id: rerun.id, ascensionid, employeeid, action: 'analyzer_values_staged',
               metadata: JSON.stringify({ field_ids: staged }), created_at: new Date(),
          });
          return true;
     }

     async stageManualResults(actor: any, ascensionid: number, fields: any[]) {
          if (!positiveId(ascensionid) || !Array.isArray(fields) || !fields.length ||
               fields.some(field => !positiveId(field?.fieldid) || field?.value == null || String(field.value).trim() === '') ||
               new Set(fields.map(field => Number(field.fieldid))).size !== fields.length)
               fail('Enter a valid rerun value for one or more parameters', 400);
          const db = await KnexConnection(this.tenantId);
          await ensureManualParameterRerunSchema(db);
          await assertLabTestAccess(db, actor, ascensionid, true);
          return db.transaction(async trx => {
               const order = await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
               if (!order) fail('Ordered test not found', 404);
               await assertResultPaymentPolicy(trx, ascensionid, 'entry', true);
               const rerun = await trx('lab_manual_parameter_reruns').where({ ascensionid, testid: order.testid })
                    .where('status', 'awaiting_results').forUpdate().first();
               if (!rerun) fail('No parameter rerun is awaiting results');
               const selected = new Set(parseIds(rerun.field_ids));
               const confirmed = new Set(parseIds(rerun.confirmed_field_ids));
               if (fields.some(field => !selected.has(Number(field.fieldid))))
                    fail('A parameter is outside this rerun', 403);
               if (fields.some(field => confirmed.has(Number(field.fieldid))))
                    fail('A confirmed rerun parameter cannot be changed');

               const currentRows = await trx('test_results').where({ ascensionid, testid: order.testid })
                    .whereIn('fieldid', fields.map(field => Number(field.fieldid)))
                    .select('fieldid', 'billingid', 'patientid', 'field');
               const currentById = new Map(currentRows.map((row: any) => [Number(row.fieldid), row]));
               const stagedFieldIds: number[] = [];
               for (const field of fields) {
                    const fieldid = Number(field.fieldid);
                    const current = currentById.get(fieldid);
                    if (!current || Number(current.billingid) !== Number(rerun.billingid) ||
                         Number(current.patientid) !== Number(rerun.patientid))
                         fail('Current result ownership requires administrator review');
                    const value = String(field.value);
                    await trx('lab_manual_parameter_rerun_values').insert({
                         rerun_id: rerun.id, fieldid, field: String(current.field || field.field || ''),
                         value: encrypt_value(value), originalvalue: encrypt_value(value),
                         entrymode: 'manual', received_by: actor.employeeid, received_at: new Date(),
                    }).onConflict(['rerun_id', 'fieldid']).merge({
                         field: String(current.field || field.field || ''),
                         value: encrypt_value(value), originalvalue: encrypt_value(value),
                         entrymode: 'manual', received_by: actor.employeeid, received_at: new Date(),
                    });
                    stagedFieldIds.push(fieldid);
               }
               await trx('lab_manual_parameter_rerun_events').insert({
                    rerun_id: rerun.id, ascensionid, employeeid: actor.employeeid, action: 'manual_values_staged',
                    metadata: JSON.stringify({ field_ids: stagedFieldIds }), created_at: new Date(),
               });
               return { rerunId: Number(rerun.id), status: 'awaiting_confirmation', fieldIds: stagedFieldIds };
          });
     }

     async get(actor: any, ascensionid: number) {
          const db = await KnexConnection(this.tenantId);
          await ensureManualParameterRerunSchema(db);
          await assertLabTestAccess(db, actor, ascensionid, false);
          const rerun = await db('lab_manual_parameter_reruns').where({ ascensionid }).orderBy('id', 'desc').first();
          if (!rerun) return null;
          const rows = await db('lab_manual_parameter_rerun_values').where({ rerun_id: rerun.id });
          return {
               rerunId: Number(rerun.id), ascensionid, status: rerun.status, fieldIds: parseIds(rerun.field_ids),
               confirmedFieldIds: parseIds(rerun.confirmed_field_ids),
               staged: rows.map((row: any) => ({
                    fieldid: Number(row.fieldid), field: row.field, value: decrypt_value(row.value),
                    originalvalue: decrypt_value(row.originalvalue), entrymode: row.entrymode, receivedAt: row.received_at,
               })),
          };
     }

     async confirm(actor: any, ascensionid: number, fieldIds: number[]) {
          if (!Array.isArray(fieldIds) || !fieldIds.length || fieldIds.some(id => !positiveId(id)) ||
               new Set(fieldIds.map(Number)).size !== fieldIds.length) fail('Select staged parameters to confirm', 400);
          const db = await KnexConnection(this.tenantId);
          await ensureManualParameterRerunSchema(db);
          await assertLabTestAccess(db, actor, ascensionid, true);
          const result = await db.transaction(async trx => {
               const order = await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
               if (!order) fail('Ordered test not found', 404);
               await assertResultPaymentPolicy(trx, ascensionid, 'entry', true);
               const rerun = await trx('lab_manual_parameter_reruns').where({ ascensionid, testid: order.testid })
                    .where('status', 'awaiting_results').forUpdate().first();
               if (!rerun) fail('No analyzer rerun is awaiting confirmation');
               const selected = new Set(parseIds(rerun.field_ids));
               const confirmed = new Set(parseIds(rerun.confirmed_field_ids));
               if (fieldIds.some(id => !selected.has(Number(id)))) fail('A parameter is outside this rerun', 403);
               const stagedRows = await trx('lab_manual_parameter_rerun_values').where({ rerun_id: rerun.id }).whereIn('fieldid', fieldIds);
               if (stagedRows.length !== fieldIds.length) fail('Analyzer values are not available for every selected parameter');
               const audit: any[] = [];
               for (const staged of stagedRows) {
                    const key = { ascensionid, testid: order.testid, fieldid: Number(staged.fieldid) };
                    const prior = await trx('test_results').where(key).forUpdate().first();
                    if (!prior || Number(prior.billingid) !== Number(rerun.billingid) || Number(prior.patientid) !== Number(rerun.patientid))
                         fail('Current result ownership requires administrator review');
                    await trx('test_results').where(key).update({
                         field: staged.field, value: staged.value, originalvalue: staged.originalvalue,
                         employeeid: actor.employeeid, entrymode: staged.entrymode || 'automatic', edit_session_id: uuidv4(), updated_on: new Date(),
                    });
                    audit.push({ fieldid: Number(staged.fieldid), before: { value: prior.value, originalvalue: prior.originalvalue },
                         after: { value: staged.value, originalvalue: staged.originalvalue } });
                    confirmed.add(Number(staged.fieldid));
               }
               const confirmedFields = stagedRows.map((staged: any) => ({
                    fieldid: Number(staged.fieldid), field: staged.field,
                    value: decrypt_value(staged.value), originalvalue: decrypt_value(staged.originalvalue),
                    entrymode: staged.entrymode || 'automatic',
               }));
               await evaluateCriticalActions(trx, {
                    testid: Number(order.testid), ascensionid, billingid: Number(rerun.billingid), employeeid: actor.employeeid,
               }, confirmedFields);
               await TestAscension.incrementTestEditCount(this.tenantId, Number(rerun.billingid), ascensionid, trx);
               const complete = [...selected].every(id => confirmed.has(id));
               await trx('lab_manual_parameter_reruns').where({ id: rerun.id }).update({
                    confirmed_field_ids: JSON.stringify([...confirmed]), status: complete ? 'confirmed' : 'awaiting_results',
                    confirmed_by: actor.employeeid, updated_at: new Date(),
               });
               if (complete) await trx('test_ascension').where({ id: ascensionid }).update({ resultEntryEnd: new Date() });
               await trx('lab_manual_parameter_rerun_events').insert({
                    rerun_id: rerun.id, ascensionid, employeeid: actor.employeeid, action: 'values_confirmed',
                    // Result values remain encrypted at rest in both current data and audit metadata.
                    metadata: JSON.stringify({ fields: audit }), created_at: new Date(),
               });
               return { rerunId: Number(rerun.id), status: complete ? 'confirmed' : 'awaiting_results',
                    confirmedFieldIds: [...confirmed], remainingFieldIds: [...selected].filter(id => !confirmed.has(id)),
                    committedFields: confirmedFields, testid: Number(order.testid), billingid: Number(rerun.billingid),
                    patientid: Number(rerun.patientid) };
          });
          const { committedFields, ...response } = result;
          if (committedFields?.length) {
               const { ResultValueAnalyticsService } = await import('../result-value-analytics/ResultValueAnalyticsService');
               void ResultValueAnalyticsService.processCommittedResultEntry({
                    tenantId: this.tenantId, testid: result.testid, ascensionid,
                    patientid: result.patientid, fields: committedFields,
               }).catch(error => console.error('Result value analytics processing failed after parameter rerun'));
          }
          return response;
     }
}
