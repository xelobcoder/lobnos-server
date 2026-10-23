import path from 'node:path';
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import KnexConnection from '../../database/KnexConnections';
import { AuthorityService } from '../../accountingModule/services/AuthorityService';
import type { AuthUser } from '../../middleware/authority';

export const expenseReceiptRoot = () => path.resolve(process.cwd(), 'private', 'expense-receipts');
const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
export function receiptExtension(content: Buffer): string {
     if (content.subarray(0, 5).toString() === '%PDF-') return '.pdf';
     if (content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
     if (content[0] === 255 && content[1] === 216 && content[2] === 255) return '.jpg';
     if (content.subarray(0, 4).toString() === 'RIFF' && content.subarray(8, 12).toString() === 'WEBP') return '.webp';
     return fail('Receipts must be PDF, PNG, JPEG or WebP files');
}
export function receiptExpenseId(filename: string): number {
     if (!/^\d+-[a-f0-9-]{36}\.(pdf|png|jpg|webp)$/.test(filename)) return fail('Invalid receipt filename');
     return Number(filename.split('-')[0]);
}
export async function assertExpenseAccess(actor: AuthUser, expenseId: number, db?: any) {
     if (!Number.isSafeInteger(expenseId) || expenseId <= 0) return fail('A valid expense is required');
     const connection = db || await KnexConnection(actor.tenantId);
     const expense = await connection('expensesrecord').where({ id: expenseId }).first();
     if (!expense || actor.branch != null && Number(expense.branchid) !== Number(actor.branch)) return fail('Expense not found in your branch', 404);
     if (Number(expense.employeeid) !== Number(actor.employeeid)) {
          const permission = await new AuthorityService(actor.tenantId).can(actor.employeeid, 'expense.view_audit', null, Number(expense.branchid));
          if (!permission.allowed) return fail('You cannot access this expense', 403);
     }
     return expense;
}
export class ExpenseReceiptService {
     constructor(private actor: AuthUser) {}
     private directory() { return path.join(expenseReceiptRoot(), String(this.actor.tenantId)); }
     async list(expenseId: number) {
          await assertExpenseAccess(this.actor, expenseId);
          return listTenantReceipts(this.actor.tenantId, expenseId);
     }
     async upload(expenseId: number, files: { buffer: Buffer }[]) {
          await assertExpenseAccess(this.actor, expenseId);
          if (!files.length || files.length > 10) return fail('Choose between 1 and 10 receipts');
          const records = files.map(file => {
               if (!file.buffer.length || file.buffer.length > 5 * 1024 * 1024) return fail('Each receipt must be between 1 byte and 5 MB');
               return { filename: `${expenseId}-${randomUUID()}${receiptExtension(file.buffer)}`, content: file.buffer };
          });
          await mkdir(this.directory(), { recursive: true });
          const written: string[] = [];
          try {
               for (const record of records) { await writeFile(path.join(this.directory(), record.filename), record.content, { flag: 'wx' }); written.push(record.filename); }
          } catch (error) { await Promise.all(written.map(name => unlink(path.join(this.directory(), name)).catch(() => undefined))); throw error; }
          return written;
     }
     async download(filename: string) {
          await assertExpenseAccess(this.actor, receiptExpenseId(filename));
          return readFile(path.join(this.directory(), filename));
     }
     async remove(filenames: string[]) {
          if (!Array.isArray(filenames) || !filenames.length || filenames.length > 10) return fail('Choose between 1 and 10 receipts');
          for (const name of filenames) {
               const expense = await assertExpenseAccess(this.actor, receiptExpenseId(name));
               if (!['draft', 'pending_approval', 'rejected'].includes(String(expense.workflow_status || (Number(expense.approved) === 0 ? 'pending_approval' : 'approved')))) return fail('Receipts for approved expenses must be retained', 409);
          }
          for (const name of new Set(filenames)) await unlink(path.join(this.directory(), name));
     }
}
export async function listTenantReceipts(tenantId: number, expenseId: number): Promise<string[]> {
     try { return (await readdir(path.join(expenseReceiptRoot(), String(tenantId)))).filter(name => name.startsWith(`${expenseId}-`)); }
     catch (error: any) { if (error.code === 'ENOENT') return []; throw error; }
}
