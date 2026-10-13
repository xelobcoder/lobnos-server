const path = require('path');
const dotenv = require('dotenv');

// Load .env before any other imports using an absolute path relative to the root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { killProcessOnPort } from './models/security/killport';
import { databaseConnectionPool, systemConfigConnection } from './database/connection';
import { configuration } from './hooks/configuration';
import logger from './hooks/logger';
import net from 'node:net';

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const port = isProduction
     ? (process.env.PRODUCTION_PORT || process.env.PORT || 5000)
     : (process.env.DEVELOPMENT_PORT || 5000);

logger.info(`Starting server startup sequence`, {
     port: port,
     env: process.env.NODE_ENV || 'development',
     pid: process.pid
});

async function sleep(ms: number) {
     return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPortAvailable(targetPort: number) {
     if (isProduction) return;
     logger.info(`Checking port availability`, { port: targetPort });
     let attempt = 0;
     while (true) {
          attempt += 1;
          const server = net.createServer();
          try {
               await new Promise<void>((resolve, reject) => {
                    server.once('error', reject);
                    // Listen on all interfaces to ensure the port is truly free
                    server.listen(targetPort, '0.0.0.0', () => resolve());
               });
               await new Promise<void>((resolve) => server.close(() => resolve()));
               logger.info(`Port ${targetPort} is available`);
               return;
          } catch (err: any) {
               try {
                    server.close();
               } catch {
               }

               if (err?.code === 'EADDRINUSE') {
                    logger.warn(`Port ${targetPort} is in use, waiting for it to be cleared...`, {
                         attempt,
                         port: targetPort
                    });
                    const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(3, attempt - 1)));
                    await sleep(delay);
                    continue;
               }

               logger.error(`Unexpected error while checking port ${targetPort}`, { error: err.message, stack: err.stack });
               throw err;
          }
     }
}

async function waitForDbReady() {
     const dbHost = isProduction ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST;
     const dbName = isProduction ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;

     logger.info(`Checking database connectivity...`, { host: dbHost, database: dbName });

     let attempt = 0;
     const maxAttempts = isProduction ? 5 : Infinity;
     while (true) {
          attempt += 1;
          try {
               const conn = await databaseConnectionPool.getConnection();
               try {
                    await conn.query('SELECT 1');
               } finally {
                    conn.release();
               }

               logger.info(`Database is ready`, {
                    host: dbHost,
                    database: dbName,
                    attempts: attempt
               });
               return;
          } catch (err: any) {
               const message = err?.message || err?.toString?.() || 'Unknown DB connection error';
               const retryDelay = Math.min(30000, 1000 * Math.pow(2, Math.min(5, attempt - 1)));

               logger.warn(`Database connection failed, retrying...`, {
                    attempt,
                    host: dbHost,
                    database: dbName,
                    error: message,
                    nextRetryDelay: (retryDelay / 1000) + 's'
               });

               if (isProduction && attempt >= maxAttempts) {
                    logger.error('Critical: Max DB connection attempts reached in production. Exiting.', {
                         maxAttempts,
                         host: dbHost,
                         database: dbName,
                         lastError: message
                    });
                    process.exit(1);
               }

               await sleep(retryDelay);
          }
     }
}

const shouldKillPort = isDevelopment && process.env.KILL_PORT_ON_START !== '0';

const startServer = async () => {
     if (shouldKillPort) {
          try {
               logger.info(`Attempting to clear port ${port} before startup`);
               await killProcessOnPort(Number(port));
          } catch (err) {
               logger.error(`Failed to kill port ${port}:`, { error: (err as Error).message });
          }
     }

     if (isDevelopment) {
          await waitForPortAvailable(Number(port));
     }

     await waitForDbReady();

     try {
          logger.info(`Loading main application...`);
          require('./app.js');
     } catch (err) {
          require('./app');
     }
};

startServer();
