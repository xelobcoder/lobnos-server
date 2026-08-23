import KnexConnection from '../../database/KnexConnections';
import { ensureAccountingSchema } from '../init/accountingSchemaInit';
import { createAccountingService } from '../index';
import { PostTransactionDto } from '../dto/PostTransactionDto';
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
               await db('acc_posting_outbox').where({ id: row.id }).update({
                    status: 'failed',
                    attempts: row.attempts + 1,
                    last_error: error?.message || String(error),
               });
          }
     }
}
