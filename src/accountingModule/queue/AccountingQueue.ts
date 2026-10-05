// BullMQ is disabled because the bundled Redis 3.x does not meet BullMQ's >= 5.0.0 requirement.
// enqueuePosting wakes the processor after transaction commit; this remains as a compatibility no-op.
// import { Queue } from 'bullmq';
// import { redisConnection } from './redisConnection';
// import logger from '../../hooks/logger';

// const QUEUE_NAME = 'accounting-postings';

// let queue: Queue | null = null;

// function getQueue(): Queue {
//      if (!queue) {
//           queue = new Queue(QUEUE_NAME, { connection: redisConnection });
//      }
//      return queue;
// }

export async function signalOutboxReady(_tenantId: number): Promise<void> {
     return;
}
