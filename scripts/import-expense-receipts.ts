/** Import reviewed legacy ownership mappings. Originals remain intact; public access is blocked. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import KnexConnection from '../src/database/KnexConnections';
import { expenseReceiptRoot, receiptExtension } from '../src/models/Expenses/ExpenseReceiptService';

async function main() {
     const manifestPath = process.argv[2];
     if (!manifestPath) throw new Error('Usage: node --require ts-node/register scripts/import-expense-receipts.ts manifest.json [--apply]');
     const entries = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8'));
     if (!Array.isArray(entries)) throw new Error('Manifest must be an array of { tenantId, expenseId, filename }');
     const prepared = [];
     for (const entry of entries) {
          if (!Number.isSafeInteger(entry.tenantId) || entry.tenantId <= 0 || !Number.isSafeInteger(entry.expenseId) || entry.expenseId <= 0 || typeof entry.filename !== 'string' || !/^\d+-\d+\.[a-zA-Z0-9]+$/.test(entry.filename) || Number(entry.filename.split('-')[0]) !== entry.expenseId) throw new Error('Invalid legacy receipt mapping');
          const db = await KnexConnection(entry.tenantId);
          if (!await db('expensesrecord').where({ id: entry.expenseId }).first()) throw new Error(`Expense ${entry.expenseId} not found in tenant ${entry.tenantId}`);
          const content = await readFile(path.resolve('public', 'uploads', 'expenses', 'receipts', entry.filename));
          if (content.length > 5 * 1024 * 1024) throw new Error(`Receipt ${entry.filename} exceeds 5 MB`);
          const hash = createHash('sha256').update(content).digest('hex').slice(0, 32);
          const uuid = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20)}`;
          const destination = path.join(expenseReceiptRoot(), String(entry.tenantId), `${entry.expenseId}-${uuid}${receiptExtension(content)}`);
          prepared.push({ destination, content });
     }
     if (process.argv.includes('--apply')) {
          for (const item of prepared) {
               await mkdir(path.dirname(item.destination), { recursive: true });
               try { await writeFile(item.destination, item.content, { flag: 'wx' }); }
               catch (error: any) { if (error.code !== 'EEXIST' || !(await readFile(item.destination)).equals(item.content)) throw error; }
          }
     }
     console.log(`${prepared.length} receipt mappings validated${process.argv.includes('--apply') ? ' and imported' : ' (dry run; use --apply to import)'}.`);
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
