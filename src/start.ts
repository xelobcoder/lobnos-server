require('dotenv').config({ path: './.env' });

import { killProcessOnPort } from './models/security/killport.js';
import { databaseConnectionPool, systemConfigConnection } from './database/connection';
import { configuration } from './hooks/configuration';
import logger from './hooks/logger';
import net from 'node:net';

const port = process.env.NODE_ENV == 'development' ? process.env.DEVELOPMENT_PORT : process.env.PORT || 5000;

async function sleep(ms: number) {
     return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPortAvailable(targetPort: number) {
     let attempt = 0;
     while (true) {
          attempt += 1;
          const server = net.createServer();
          try {
               await new Promise<void>((resolve, reject) => {
                    server.once('error', reject);
                    server.listen(targetPort, '0.0.0.0', () => resolve());
               });
               await new Promise<void>((resolve) => server.close(() => resolve()));
               return;
          } catch (err: any) {
               try {
                    server.close();
               } catch {
               }

               if (err?.code === 'EADDRINUSE') {
                    logger.error(`Port ${targetPort} is in use (attempt ${attempt}). Waiting...`);
                    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(3, attempt - 1)));
                    await sleep(delay);
                    continue;
               }

               throw err;
          }
     }
}

async function waitForDbReady() {
     let attempt = 0;
     while (true) {
          attempt += 1;
          try {
               const conn = await databaseConnectionPool.getConnection();
               try {
                    await conn.query('SELECT 1');
               } finally {
                    conn.release();
               }

               if (configuration.isMultiTenant) {
                    await systemConfigConnection.raw('SELECT 1');
               }

               return;
          } catch (err: any) {
               const message = err?.message || err?.toString?.() || 'Unknown DB connection error';
               logger.error(`Database not ready (attempt ${attempt}): ${message}`);
               const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(5, attempt - 1)));
               await sleep(delay);
          }
     }
}

const shouldKillPort = process.env.NODE_ENV === 'development' && process.env.KILL_PORT_ON_START !== '0';

const startServer = async () => {
     if (!shouldKillPort) {
          await waitForPortAvailable(Number(port));
     }
     await waitForDbReady();
     require('./app.js');
};

if (shouldKillPort) {
     killProcessOnPort(Number(port)).then(startServer);
} else {
     startServer();
}
