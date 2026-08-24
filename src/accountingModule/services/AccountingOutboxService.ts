import KnexConnection from '../../database/KnexConnections';
import { ensureAccountingSchema } from '../init/accountingSchemaInit';
import { createAccountingService } from '../index';
import { PostTransactionDto } from '../dto/PostTransactionDto';
import { parsePaging, parseSort } from '../utils/pagination';
import logger from '../../hooks/logger';

const MAX_ATTEMPTS = 5;

/**
 * Producer modules (billing, expenses, ...) call enqueue() inside their own DB transaction.
 * It never throws for ledger-side reasons — only if the outbox insert itself fails — so a
 * ledger/accounting problem can never block or roll back the caller's transaction.
 */
export async function enqueuePosting(tenantId: number, input: PostTransactionDto, trx: any): Promise<void> {
     // defensive: covers the request-before-startup-bootstrap-finishes race, cheap no-op afterwards
     await ensureAccountingSchema(tenantId);
     const db = trx;
     await db('acc_posting_outbox')
          .insert({
               source_module: input.sourceModule,
               source_table: input.sourceTable,
               source_pk: input.sourcePk,
               source_ref: input.sourceRef || '',
               transaction_type: input.transactionType,
               payload: JSON.stringify(input),
               status: 'pending',
               attempts: 0,
               created_at: new Date(),
          })
          .onConflict(['source_module', 'source_table', 'source_pk', 'transaction_type', 'source_ref'])
          .ignore();
}

/**
 * Best-effort out-of-band posting. Safe to call fire-and-forget (not awaited) right after a
 * producer's transaction commits, and safe to call again later from a periodic sweep — failures
 * are recorded on the outbox row and retried up to MAX_ATTEMPTS, never thrown to the caller.
 */
export async function processPendingOutbox(tenantId: number, limit = 25): Promise<void> {
     await ensureAccountingSchema(tenantId);
     const db = await KnexConnection(tenantId);

     const rows = await db('acc_posting_outbox')
          .whereIn('status', ['pending', 'failed'])
          .andWhere('attempts', '<', MAX_ATTEMPTS)
          .orderBy('id', 'asc')
          .limit(limit);

     if (rows.length === 0) return;

     const accountingService = createAccountingService(tenantId);

     for (const row of rows) {
          try {
               const input: PostTransactionDto = JSON.parse(row.payload);
               await accountingService.postTransaction({ ...input, trx: undefined });
               await db('acc_posting_outbox').where({ id: row.id }).update({
                    status: 'posted',
                    processed_at: new Date(),
               });
          } catch (error: any) {
               logger.error('Failed to process accounting outbox row', {
                    outboxId: row.id,
                    sourceModule: row.source_module,
                    sourceTable: row.source_table,
                    sourcePk: row.source_pk,
                    error: error?.message || String(error),
               });
               const attempts = row.attempts + 1;
               await db('acc_posting_outbox').where({ id: row.id }).update({
                    status: attempts >= MAX_ATTEMPTS ? 'dead_letter' : 'failed',
                    attempts,
                    last_error: error?.message || String(error),
               });
          }
     }
}

export async function getOutboxHealth(tenantId: number): Promise<{
     pending: number;
     failed: number;
     deadLetter: number;
     oldestPendingMinutes: number | null;
}> {
     await ensureAccountingSchema(tenantId);
     const db = await KnexConnection(tenantId);

     const counts = await db('acc_posting_outbox')
          .select('status')
          .count('* as total')
          .groupBy('status');

     const oldest = await db('acc_posting_outbox')
          .whereIn('status', ['pending', 'failed'])
          .min('created_at as oldest')
          .first();

     const byStatus = new Map(counts.map((row: any) => [row.status, Number(row.total)]));
     const oldestMs = oldest?.oldest ? new Date(oldest.oldest).getTime() : null;

     return {
          pending: byStatus.get('pending') || 0,
          failed: byStatus.get('failed') || 0,
          deadLetter: byStatus.get('dead_letter') || 0,
          oldestPendingMinutes: oldestMs ? Math.floor((Date.now() - oldestMs) / 60_000) : null,
     };
}

export async function listOutbox(
     tenantId: number,
     filters: { status?: string; sourceModule?: string; page?: number; count?: number; sortby?: string } = {}
): Promise<{ data: any[]; total: number; page: number; count: number }> {
     await ensureAccountingSchema(tenantId);
     const db = await KnexConnection(tenantId);

     const paging = parsePaging(filters, 25);
     const sort = parseSort(filters, ['id', 'created_at', 'status', 'attempts', 'source_module', 'transaction_type'], {
          column: 'id',
          direction: 'desc',
     });

     const base = db('acc_posting_outbox');
     if (filters.status) base.where('status', filters.status);
     if (filters.sourceModule) base.where('source_module', filters.sourceModule);

     const totalRow = await base.clone().clearSelect().clearOrder().count('* as total').first();
     const data = await base.clone().orderBy(sort.column, sort.direction).limit(paging.count).offset(paging.offset);

     return { data, total: Number(totalRow?.total || 0), page: paging.page, count: paging.count };
}

export async function replayOutboxRow(tenantId: number, outboxId: number): Promise<void> {
     await ensureAccountingSchema(tenantId);
     const db = await KnexConnection(tenantId);

     await db('acc_posting_outbox')
          .where({ id: outboxId })
          .whereIn('status', ['failed', 'dead_letter'])
          .update({ status: 'pending', attempts: 0, last_error: null });

     await processPendingOutbox(tenantId);
}
