import 'dotenv/config';
import 'reflect-metadata';
import { backupScheduler } from '../services/backup-scheduler';

const command = process.argv[2] || 'start';

async function main() {
     switch (command) {
          case 'start': {
               console.log('PrimeLab backup scheduler (schedule-only)');
               await backupScheduler.start();

               const shutdown = async (signal: string) => {
                    console.log(`\n${signal} received, stopping...`);
                    await backupScheduler.stop();
                    process.exit(0);
               };

               process.on('SIGINT', () => void shutdown('SIGINT'));
               process.on('SIGTERM', () => void shutdown('SIGTERM'));

               setInterval(() => {
                    const s = backupScheduler.getStatus();
                    if (s.isRunning) {
                         console.log(
                              `[heartbeat] running tenant=${s.tenantId} source=${s.source}` +
                              (s.isChecking ? ' checking...' : '')
                         );
                    }
               }, 5 * 60 * 1000);
               break;
          }
          case 'status': {
               const s = backupScheduler.getStatus();
               console.log(JSON.stringify(s, null, 2));
               break;
          }
          case 'stop': {
               await backupScheduler.stop();
               break;
          }
          default:
               console.log('Usage: node dist/src/scripts/backup-scheduler.js <start|status|stop>');
               process.exit(1);
     }
}

main().catch((error) => {
     console.error(error);
     process.exit(1);
});
