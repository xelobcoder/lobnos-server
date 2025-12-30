#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('reflect-metadata');

console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NOT SET');

const { backupScheduler } = require('../dist/src/services/backup-scheduler');

const command = process.argv[2];

async function main() {
     try {
          switch (command) {
               case 'start':
                    console.log('Starting backup scheduler...');
                    await backupScheduler.start();

                    // Keep the process running
                    process.on('SIGINT', async () => {
                         console.log('\nReceived SIGINT, stopping backup scheduler...');
                         await backupScheduler.stop();
                         process.exit(0);
                    });

                    process.on('SIGTERM', async () => {
                         console.log('\nReceived SIGTERM, stopping backup scheduler...');
                         await backupScheduler.stop();
                         process.exit(0);
                    });

                    // Keep process alive
                    setInterval(() => {
                         const status = backupScheduler.getStatus();
                         if (status.isRunning) {
                              console.log(`Backup scheduler running - next check in ${Math.ceil(status.checkInterval / 1000)} seconds`);
                         }
                    }, 30000); // Log status every 30 seconds

                    break;

               case 'stop':
                    console.log('Stopping backup scheduler...');
                    await backupScheduler.stop();
                    break;

               case 'status':
                    const status = backupScheduler.getStatus();
                    console.log('Backup Scheduler Status:');
                    console.log(`  Running: ${status.isRunning}`);
                    console.log(`  Check Interval: ${status.checkInterval / 1000} seconds`);
                    break;

               default:
                    console.log('Usage: backup-scheduler <command>');
                    console.log('Commands:');
                    console.log('  start  - Start the backup scheduler service');
                    console.log('  stop   - Stop the backup scheduler service');
                    console.log('  status - Show scheduler status');
                    process.exit(1);
          }
     } catch (error) {
          console.error('Error:', error);
          process.exit(1);
     }
}

main();