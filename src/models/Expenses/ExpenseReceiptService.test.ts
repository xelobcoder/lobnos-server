import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../../accountingModule/services/AuthorityService', () => ({ AuthorityService: class { can = vi.fn().mockResolvedValue({ allowed: false }); } }));
import KnexConnection from '../../database/KnexConnections';
import { ExpenseReceiptService, receiptExpenseId, receiptExtension } from './ExpenseReceiptService';

let directory: string;
const actor: any = { employeeid: 7, branch: 4, tenantId: 1, role: 'scientist' };
let expense: any;
beforeEach(async () => {
     directory = await mkdtemp(path.join(tmpdir(), 'expense-receipts-'));
     vi.spyOn(process, 'cwd').mockReturnValue(directory);
     expense = { id: 10, employeeid: 7, branchid: 4, approved: 0, workflow_status: 'pending_approval' };
     vi.mocked(KnexConnection).mockResolvedValue((() => ({ where: ({ id }: any) => ({ first: async () => id === expense.id ? expense : undefined }) })) as any);
});
afterEach(async () => { vi.restoreAllMocks(); await rm(directory, { recursive: true, force: true }); });
describe('expense receipt ownership and file boundary', () => {
     it('stores receipts privately under the authenticated tenant and supports round trips', async () => {
          const service = new ExpenseReceiptService(actor);
          const content = Buffer.from('%PDF-1.7\nreceipt');
          const [filename] = await service.upload(10, [{ buffer: content }]);
          expect(receiptExpenseId(filename)).toBe(10);
          expect(await service.list(10)).toEqual([filename]);
          expect(await service.download(filename)).toEqual(content);
          expect(await readdir(path.join(directory, 'private', 'expense-receipts'))).toEqual(['1']);
          await expect(new ExpenseReceiptService({ ...actor, tenantId: 2 }).download(filename)).rejects.toThrow();
     });
     it('rejects traversal, disguised executable content, oversize files and empty uploads', async () => {
          expect(() => receiptExpenseId('../../secret.pdf')).toThrow('filename');
          expect(() => receiptExpenseId('10-123456.pdf')).toThrow('filename');
          expect(() => receiptExtension(Buffer.from('<html>pretend receipt.pdf'))).toThrow('must be');
          const service = new ExpenseReceiptService(actor);
          await expect(service.upload(10, [{ buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }])).rejects.toThrow('5 MB');
          await expect(service.upload(10, [])).rejects.toThrow('Choose');
     });
     it('rejects other branches and another employee without audit authority', async () => {
          await expect(new ExpenseReceiptService({ ...actor, branch: 5 }).upload(10, [{ buffer: Buffer.from('%PDF-') }])).rejects.toThrow('branch');
          await expect(new ExpenseReceiptService({ ...actor, employeeid: 8 }).list(10)).rejects.toThrow('cannot access');
     });
     it('retains approved expense evidence and allows deleting pending receipts', async () => {
          const service = new ExpenseReceiptService(actor);
          const [filename] = await service.upload(10, [{ buffer: Buffer.from('%PDF-1.7') }]);
          expense.approved = 1; expense.workflow_status = 'approved';
          await expect(service.remove([filename])).rejects.toThrow('retained');
          expense.approved = 0; expense.workflow_status = 'pending_approval';
          await service.remove([filename]);
          expect(await service.list(10)).toEqual([]);
     });
});
