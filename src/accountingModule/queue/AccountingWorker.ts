// BullMQ worker is disabled: the bundled Redis 3.x does not meet BullMQ's >= 5.0.0 requirement.
// Post-commit outbox wakeups are the fast path; periodic DB sweeps remain the durable fallback.
// import { Worker } from 'bullmq';
// import { redisConnection } from './redisConnection';
// import { processPendingOutbox } from '../services/AccountingOutboxService';
import logger from '../../hooks/logger';

// const QUEUE_NAME = 'accounting-postings';

export function startAccountingWorker(): null {
     logger.info('Accounting queue worker disabled; relying on periodic outbox sweep');
     return null;
}
