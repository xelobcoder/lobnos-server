import {validateTypedResult} from '../TestCreation/parameterDefinition';
import { createHmac } from 'crypto';
import { decrypt_value, ENCRYPTION_KEY } from '../../utils/encryptionModels';

const reject = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const id = (value: any) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const text = (value: any) => value == null ? '' : String(value);

/** One current row per parameter in an ordered test. Repeats belong to distinct ascensions
 * or distinct parameter IDs, never to an array position or a display name. */
export function validateResultFields(fields: any[]) {
    if (!Array.isArray(fields) || !fields.length) throw reject('Result parameters are required', 400);
    const seen = new Set<number>();
    for (const field of fields) {
        if (!id(field?.fieldid)) throw reject('Every result parameter requires a valid field ID', 400);
        const key = Number(field.fieldid);
        if (seen.has(key)) throw reject('Repeated result parameter identity in this save. Review the editor parameters; no data was saved.');
        seen.add(key);
        if (field.value == null || field.originalvalue == null) throw reject('Result parameter values must be explicit (empty text is allowed)', 400);
        if ([field.value, field.originalvalue].some(value => !['string', 'number'].includes(typeof value) ||
            (typeof value === 'number' && !Number.isFinite(value))))
            throw reject('Result parameter values must be text or finite numbers', 400);
    }
}

export type ResultSaveContext = { ascensionid: number; testid: number; billingid: number; patientid: number; employeeid: number };

export function resultRequestHash(request: any) {
    const fields = request.fields.map((field: any) => ({
        fieldid: Number(field.fieldid), field: text(field.field), value: text(field.value),
        originalvalue: text(field.originalvalue), entrymode: field.entrymode || 'manual',
    })).sort((a: any, b: any) => a.fieldid - b.fieldid);
    const drugs = request.hasDrugs ? request.drugs.map((drug: any) => ({
        drugid: Number(drug.id), reaction: text(drug.sensitivity),
    })).sort((a: any, b: any) => a.drugid - b.drugid) : [];
    // Keyed digest: receipts contain neither result values nor an unkeyed low-entropy clinical hash.
    return createHmac('sha256', ENCRYPTION_KEY).update(JSON.stringify({
        fields, comments: text(request.comments), hasDrugs: !!request.hasDrugs, drugs,
        expected_revision: request.expected_revision ?? null,
    })).digest('hex');
}

/** Must run inside the write transaction, before any reads of current results or revisions. */
export async function beginResultSave(trx: any, context: ResultSaveContext, request: any) {
    const { ascensionid, testid, billingid, patientid, employeeid } = context;
    const ascension = await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
    // Legacy comments are billing/test-scoped, so sibling repeat ascensions share this lock.
    const bill = await trx('billing').where({ billingid }).forUpdate().first();
    if (!ascension || Number(ascension.testid) !== testid || Number(ascension.billingid) !== billingid ||
        Number(bill?.patientid) !== patientid) throw reject('Ordered test does not belong to this request', 403);
    const rows = await trx('test_results').where({ ascensionid, testid });
    const seen = new Set<number>();
    for (const row of rows) {
        if (!id(row.fieldid) || seen.has(Number(row.fieldid)))
            throw reject('Existing duplicate or unidentified result parameters require reviewed repair. No data was changed; contact the laboratory administrator.');
        seen.add(Number(row.fieldid));
        if (Number(row.billingid) !== billingid || Number(row.patientid) !== patientid)
            throw reject('Stored result ownership requires administrator review', 409);
    }
    const rules = await trx('testcreationrules').where({ testid }).select('id','name','result_type');
    const allowed = new Set(rules.map((rule: any) => Number(rule.id)));
    if (request.fields.some((field: any) => !allowed.has(Number(field.fieldid))))
        throw reject('A result parameter does not belong to this test', 400);
    for(const field of request.fields){const rule=rules.find((row:any)=>Number(row.id)===Number(field.fieldid));if(rule)validateTypedResult(rule,field.originalvalue);}
    if (request.hasDrugs) {
        if (!Array.isArray(request.drugs)) throw reject('Drug results must be an array', 400);
        const drugIds = request.drugs.map((drug: any) => Number(drug.id));
        if (drugIds.some((key: number) => !id(key)) || new Set(drugIds).size !== drugIds.length)
            throw reject('Repeated or invalid drug result identity; review the submitted results', 400);
    }
    const comments = await trx('result_comments').where({ billingid, testid });
    if (comments.length > 1) throw reject('Existing duplicate result comments require reviewed repair');
    const storedDrugs = await trx('resultentrydrugsreaction').where({ ascensionid, testid });
    if (new Set(storedDrugs.map((drug: any) => Number(drug.drugid))).size !== storedDrugs.length)
        throw reject('Existing duplicate drug results require reviewed repair');
    const requestId = request.request_id;
    if (requestId !== undefined && (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId)))
        throw reject('Invalid result save request identity', 400);
    const hash = resultRequestHash(request);
    if (requestId) {
        let receipt;
        try {
            receipt = await trx('lab_result_save_requests').where({ ascensionid, request_id: requestId }).first();
        } catch (error) {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_NO_SUCH_TABLE') {
                throw Object.assign(new Error('Results could not be saved because the service is temporarily unavailable. No changes were saved. Please contact your administrator.'), {
                    statusCode: 503, code: 'RESULT_SAVE_SCHEMA_REQUIRED', cause: error,
                });
            }
            throw error;
        }
        if (receipt) {
            if (Number(receipt.employeeid) !== employeeid || receipt.request_hash !== hash)
                throw reject('Result save request identity was already used for a different operation');
            return { rows, hash, replayed: true };
        }
    }
    return { rows, hash, replayed: false };
}

export async function resultSaveHasChanges(trx: any, context: ResultSaveContext, request: any, fields: any[], rows: any[]) {
    validateResultFields(fields);
    const { ascensionid, testid, billingid } = context;
    for (const field of fields) {
        const row = rows.find(row => Number(row.fieldid) === Number(field.fieldid));
        if (!row || text(row.field) !== text(field.field) || (row.entrymode || 'manual') !== (field.entrymode || 'manual') ||
            decrypt_value(row.value) !== text(field.value) || decrypt_value(row.originalvalue) !== text(field.originalvalue)) return true;
    }
    const comments = await trx('result_comments').where({ billingid, testid });
    if (comments.length > 1) throw reject('Existing duplicate result comments require reviewed repair');
    if (!comments.length || text(comments[0].comments) !== text(request.comments)) return true;
    if (request.hasDrugs) {
        const drugs = await trx('resultentrydrugsreaction').where({ ascensionid, testid });
        if (new Set(drugs.map((drug: any) => Number(drug.drugid))).size !== drugs.length)
            throw reject('Existing duplicate drug results require reviewed repair');
        if (drugs.length !== request.drugs.length || request.drugs.some((drug: any) =>
            !drugs.some((row: any) => Number(row.drugid) === Number(drug.id) && text(row.reaction) === text(drug.sensitivity)))) return true;
    }
    return false;
}

export async function recordResultSaveRequest(trx: any, context: ResultSaveContext, request: any, hash: string) {
    if (!request.request_id) return;
    await trx('lab_result_save_requests').insert({
        ascensionid: context.ascensionid, request_id: request.request_id, employeeid: context.employeeid,
        request_hash: hash, created_at: new Date(),
    });
}
