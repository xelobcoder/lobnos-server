// BullMQ worker is disabled: the bundled Redis 3.x does not meet BullMQ's >= 5.0.0 requirement.
// The periodic DB sweep in app.ts remains the durable delivery path.
// import { Worker } from 'bullmq';
// import { redisConnection } from './redisConnection';
// import { processPendingOutbox } from '../services/AccountingOutboxService';
import logger from '../../hooks/logger';

// const QUEUE_NAME = 'accounting-postings';

export function startAccountingWorker(): null {
     logger.info('Accounting queue worker disabled; relying on periodic outbox sweep');
     return null;
}
