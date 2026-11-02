import { createHash, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { PharmacyAccountingCore, accountingDate, amount, assertTransition, assertVersion, fail, stableHash, text } from './PharmacyAccountingCore';
import { mappedAccount } from './PharmacyAccountingCatalogue';
import { postPharmacyJournal } from '../PharmacyLedger';
import { json } from '../PharmacyEnterpriseCore';
import { PharmacyAccountingSubledgers } from './PharmacyAccountingSubledgers';

const uploadFields = ['id', 'filename', 'mime_type', 'byte_length', 'sha256', 'uploaded_by', 'created_at'];
/** Private immutable DB upload objects; never user-controlled filesystem paths or URLs. */
export class PharmacyAccountingEvidence extends PharmacyAccountingCore {
     async upload(input: any): Promise<any> {
          return this.atomic(input, 'evidence:upload', async trx => {
               if (typeof input.filename !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._ -]{0,149}$/.test(input.filename) || input.filename.includes('..')) fail('Use a filename without path components');
               if (typeof input.contentBase64 !== 'string' || input.contentBase64.length > 6990510 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.contentBase64)) fail('Supply canonical base64 content, maximum 5 MiB');
               const bytes = Buffer.from(input.contentBase64, 'base64');
               if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== input.contentBase64) fail('Invalid evidence size or base64 encoding');
               const mime = bytes.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
                    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
                         : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
               if (!mime || mime !== input.mimeType) fail('Evidence must be a signature-verified PDF, PNG or JPEG with matching mimeType');
               const extensions: Record<string, RegExp> = { 'application/pdf': /\.pdf$/i, 'image/png': /\.png$/i, 'image/jpeg': /\.jpe?g$/i };
               if (!extensions[mime].test(input.filename)) fail('Evidence filename extension does not match content');
               const row = { id: randomUUID(), branchid: this.context.branch, uploaded_by: this.context.actor, filename: input.filename, mime_type: mime, byte_length: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
               await trx('pharmacy_accounting_uploads').insert({ ...row, content_base64: input.contentBase64 });
               await this.audit(trx, 'evidence:upload', row.id, null, row);
               return { id: row.id, filename: row.filename, mimeType: mime, byteLength: bytes.length, sha256: row.sha256, malwareScan: 'not_performed' };
          });
     }
     async attach(expenseId: string, input: any): Promise<any> {
          return this.atomic(input, `evidence:attach:${expenseId}`, async trx => {
               const expense = await this.document(trx, expenseId, 'expense');
               if (['voided', 'reversed', 'refunded'].includes(expense.status)) fail('Cannot attach new evidence to a closed correction', 'INVALID_STATE', 409);
               if (Object.keys(input).some(k => !['idempotencyKey', 'uploadId'].includes(k))) fail('Reference uploadId only; paths, URLs and arbitrary metadata are not accepted');
               if (typeof input.uploadId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.uploadId)) fail('Supply an authorized uploadId');
               const upload = await trx('pharmacy_accounting_uploads').where({ id: input.uploadId, branchid: this.context.branch, uploaded_by: this.context.actor }).select(uploadFields).forUpdate().first();
               if (!upload) fail('Authorized upload object not found', 'NOT_FOUND', 404);
               if (await trx('pharmacy_accounting_attachments').where({ upload_id: upload.id }).first()) fail('Evidence object is already attached; duplicate invoice evidence needs review', 'EVIDENCE_IN_USE', 409);
               const row = { id: randomUUID(), branchid: this.context.branch, expense_id: expenseId, upload_id: upload.id, created_by: this.context.actor };
               await trx('pharmacy_accounting_attachments').insert(row); await this.audit(trx, 'evidence:attach', expenseId, null, { ...row, metadata: upload });
               return { ...row, filename: upload.filename, mimeType: upload.mime_type, byteLength: upload.byte_length, sha256: upload.sha256 };
          });
     }
     async attachments(expenseId: string): Promise<any> {
          if (!await this.db('pharmacy_accounting_documents').where({ id: expenseId, branchid: this.context.branch, kind: 'expense' }).first()) fail('Expense not found in this branch', 'NOT_FOUND', 404);
          const items = await this.db('pharmacy_accounting_attachments as a').join('pharmacy_accounting_uploads as u', 'u.id', 'a.upload_id').where({ 'a.branchid': this.context.branch, 'u.branchid': this.context.branch, 'a.expense_id': expenseId })
               .select('a.id', 'a.expense_id', 'a.upload_id', 'u.filename', 'u.mime_type', 'u.byte_length', 'u.sha256', 'a.created_by', 'a.created_at').orderBy('a.created_at');
          return { items, malwareScan: 'not_performed', downloadDisposition: 'attachment' };
     }
     async content(expenseId: string, attachmentId: string): Promise<any> {
          if (!await this.db('pharmacy_accounting_documents').where({ id: expenseId, branchid: this.context.branch, kind: 'expense' }).first()) fail('Expense not found in this branch', 'NOT_FOUND', 404);
          const row = await this.db('pharmacy_accounting_attachments as a').join('pharmacy_accounting_uploads as u', 'u.id', 'a.upload_id').where({ 'a.id': attachmentId, 'a.expense_id': expenseId, 'a.branchid': this.context.branch, 'u.branchid': this.context.branch }).select('u.filename', 'u.mime_type', 'u.content_base64').first();
          if (!row) fail('Evidence not found in this branch', 'NOT_FOUND', 404);
          return { filename: row.filename, mimeType: row.mime_type, content: Buffer.from(row.content_base64, 'base64') };
     }
     async createRefund(expenseId: string, input: any): Promise<any> {
          return this.atomic(input, `expense:refund:create:${expenseId}`, async trx => {
               const expense = await this.document(trx, expenseId, 'expense');
               if (!['paid', 'partially_refunded'].includes(expense.status)) fail('Refunds require a fully settled expense; cancel unpaid balances separately', 'INVALID_STATE', 409);
               if (typeof input.paymentId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.paymentId)) fail('Supply the original paymentId');
               const payment = await trx('pharmacy_accounting_expense_payments').where({ id: input.paymentId, expense_id: expenseId, branchid: this.context.branch }).forUpdate().first();
               if (!payment) fail('Original expense payment not found', 'NOT_FOUND', 404);
               const date = accountingDate(input.date), value = amount(input.amount), reason = text(input.reason, 'refund evidence');
               if (date < accountingDate(payment.financial_date)) fail('Refund cannot predate the original payment');
               if (new Decimal(value).gt(payment.amount)) fail('Refund exceeds original payment');
               const id = randomUUID(), details = { expenseId, paymentId: payment.id, accountId: payment.account_id, method: payment.method, expenseAccount: expense.details.expenseAccount, reason };
               await trx('pharmacy_accounting_documents').insert({ id, branchid: this.context.branch, kind: 'expense_refund', status: 'draft', version: 1, financial_date: date, amount: value, description: reason, created_by: this.context.actor, details: JSON.stringify(details) });
               await this.audit(trx, 'expense:refund:create', expenseId, null, { id, amount: value, date, details });
               return { id, status: 'draft', version: 1 };
          });
     }
     async refunds(expenseId: string): Promise<any> {
          if (!await this.db('pharmacy_accounting_documents').where({ id: expenseId, branchid: this.context.branch, kind: 'expense' }).first()) fail('Expense not found in this branch', 'NOT_FOUND', 404);
          const rows = await this.db('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind: 'expense_refund' }).orderBy('created_at');
          return { items: rows.map(r => ({ ...r, details: json(r.details) })).filter(r => r.details.expenseId === expenseId) };
     }
     async refundAction(id: string, action: string, input: any): Promise<any> {
          return this.atomic(input, `expense:refund:${id}:${action}`, async (trx, settings) => {
               const row = await this.document(trx, id, 'expense_refund'); assertVersion(row, input);
               const before = { ...row, details: { ...row.details } };
               if (!['submit', 'approve', 'receive', 'void'].includes(action)) fail('Unsupported refund action', 'UNSUPPORTED', 422);
               if (['amount', 'date', 'paymentId', 'accountId', 'method'].some(k => Object.prototype.hasOwnProperty.call(input, k))) fail('Refund amount, date and original destination are immutable after draft creation');
               let status: string;
               if (action === 'receive') {
                    if (row.status !== 'approved') fail('Refund must be independently approved before receipt', 'INVALID_STATE', 409);
                    status = 'received';
               } else status = assertTransition(row, action, this.context.actor);
               if (action === 'void') text(input.reason, 'refund void reason');
               if (action === 'receive') {
                    const expense = await this.document(trx, row.details.expenseId, 'expense');
                    const beforeExpense = { ...expense, details: { ...expense.details } };
                    if (!['paid', 'partially_refunded'].includes(expense.status)) fail('Expense is not eligible for a refund', 'INVALID_STATE', 409);
                    const payment = await trx('pharmacy_accounting_expense_payments').where({ id: row.details.paymentId, expense_id: expense.id, branchid: this.context.branch }).forUpdate().first();
                    if (!payment || Number(payment.account_id) !== Number(row.details.accountId) || payment.method !== row.details.method) fail('Original refund payment identity changed', 'SOURCE_MISMATCH', 409);
                    const previous = await trx('pharmacy_accounting_documents').where({ branchid: this.context.branch, kind: 'expense_refund', status: 'received' }).select('amount', 'details');
                    const used = previous.filter(p => json(p.details).paymentId === payment.id).reduce((s, p) => s.plus(p.amount), new Decimal(0));
                    if (used.plus(row.amount).gt(payment.amount)) fail('Refund exceeds remaining original payment after prior refunds', 'OVERREFUND', 409);
                    const account = await trx('pharmacy_collection_accounts').where({ id: payment.account_id, branchid: this.context.branch, is_active: true, currency: 'GHS' }).forUpdate().first();
                    if (!account) fail('Original refund destination is unavailable in this branch');
                    const date = accountingDate(row.financial_date);
                    const shift = payment.method === 'cash' ? await trx('pharmacy_shifts').where({ active_key: `${this.context.branch}:${this.context.actor}`, financial_date: date }).forUpdate().first() : null;
                    if (payment.method === 'cash' && !shift) fail('An open cash shift is required to receive a cash refund');
                    const subledgers = new PharmacyAccountingSubledgers(this.db, this.context);
                    const reference = await subledgers.paymentReference(trx, account.id, input.reference, payment.method);
                    await mappedAccount(trx, this.context.branch, settings.mappings, 'collection:' + account.id);
                    await mappedAccount(trx, this.context.branch, settings.mappings, row.details.expenseAccount);
                    await this.postingAllowed(trx, date);
                    await postPharmacyJournal(trx, this.context.branch, id, 'expense_refund', row.description, this.context.actor, [{ account: 'collection:' + account.id, debit: Number(row.amount) }, { account: row.details.expenseAccount, credit: Number(row.amount), documentRef: expense.id }], date);
                    // Negative immutable settlement-reversal evidence makes existing shift handovers add
                    // cash back. It is not a new sale or a negative supplier liability recognition.
                    await trx('pharmacy_documents').insert({ id, branchid: this.context.branch, kind: 'supplier_payment', request_key: 'accounting:refund:' + id, request_hash: stableHash(input), supplier_id: expense.details.supplierId, amount: new Decimal(row.amount).negated().toFixed(2), created_by: this.context.actor, details: JSON.stringify({ expenseId: expense.id, expenseRefundId: id, paymentId: payment.id, direction: 'refund_received', accountId: account.id, method: payment.method, reference, shiftId: shift?.id || null }) });
                    const total = new Decimal(expense.details.refundedAmount || 0).plus(row.amount);
                    expense.details.refundedAmount = total.toFixed(2); expense.details.netPaidAmount = new Decimal(expense.details.paidAmount).minus(total).toFixed(2);
                    const expenseStatus = total.eq(expense.amount) ? 'refunded' : 'partially_refunded';
                    await trx('pharmacy_accounting_documents').where({ id: expense.id, branchid: this.context.branch }).update({ status: expenseStatus, version: Number(expense.version) + 1, details: JSON.stringify(expense.details), updated_at: new Date() });
                    await this.audit(trx, 'expense:refund:received', expense.id, beforeExpense, { refundId: id, amount: row.amount, refundedAmount: total.toFixed(2), status: expenseStatus, reference });
                    row.details.reference = reference;
               }
               const next: any = { status, version: Number(row.version) + 1, details: JSON.stringify(row.details), updated_at: new Date() };
               if (action === 'submit') next.submitted_by = this.context.actor;
               if (action === 'approve') next.approved_by = this.context.actor;
               await trx('pharmacy_accounting_documents').where({ id, branchid: this.context.branch }).update(next);
               await this.audit(trx, 'expense_refund:' + action, id, before, { status, version: next.version, reason: input.reason || null });
               return { id, expenseId: row.details.expenseId, status, version: next.version };
          });
     }
}
