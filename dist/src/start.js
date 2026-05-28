"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require('path');
const dotenv = require('dotenv');
// Load .env before any other imports using an absolute path relative to the root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const killport_1 = require("./models/security/killport");
const connection_1 = require("./database/connection");
const configuration_1 = require("./hooks/configuration");
const logger_1 = __importDefault(require("./hooks/logger"));
const node_net_1 = __importDefault(require("node:net"));
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const port = isProduction
    ? (process.env.PRODUCTION_PORT || process.env.PORT || 5000)
    : (process.env.DEVELOPMENT_PORT || 5000);
logger_1.default.info(`Starting server startup sequence`, {
    port: port,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid
});
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForPortAvailable(targetPort) {
    if (isProduction)
        return;
    logger_1.default.info(`Checking port availability`, { port: targetPort });
    let attempt = 0;
    while (true) {
        attempt += 1;
        const server = node_net_1.default.createServer();
        try {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                // Listen on all interfaces to ensure the port is truly free
                server.listen(targetPort, '0.0.0.0', () => resolve());
            });
            await new Promise((resolve) => server.close(() => resolve()));
            logger_1.default.info(`Port ${targetPort} is available`);
            return;
        }
        catch (err) {
            try {
                server.close();
            }
            catch (_a) {
            }
            if ((err === null || err === void 0 ? void 0 : err.code) === 'EADDRINUSE') {
                logger_1.default.warn(`Port ${targetPort} is in use, waiting for it to be cleared...`, {
                    attempt,
                    port: targetPort
                });
                const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(3, attempt - 1)));
                await sleep(delay);
                continue;
            }
            logger_1.default.error(`Unexpected error while checking port ${targetPort}`, { error: err.message, stack: err.stack });
            throw err;
        }
    }
}
async function waitForDbReady() {
    var _a;
    const dbHost = isProduction ? process.env.PRODUCTION_DB_HOSTNAME : process.env.DB_HOST;
    const dbName = isProduction ? process.env.PRODUCTION_DATABASE : process.env.DATABASE;
    logger_1.default.info(`Checking database connectivity...`, { host: dbHost, database: dbName });
    let attempt = 0;
    const maxAttempts = isProduction ? 5 : Infinity;
    while (true) {
        attempt += 1;
        try {
            const conn = await connection_1.databaseConnectionPool.getConnection();
            try {
                await conn.query('SELECT 1');
            }
            finally {
                conn.release();
            }
            if (configuration_1.configuration.isMultiTenant) {
                await connection_1.systemConfigConnection.raw('SELECT 1');
            }
            logger_1.default.info(`Database is ready`, {
                host: dbHost,
                database: dbName,
                attempts: attempt
            });
            return;
        }
        catch (err) {
            const message = (err === null || err === void 0 ? void 0 : err.message) || ((_a = err === null || err === void 0 ? void 0 : err.toString) === null || _a === void 0 ? void 0 : _a.call(err)) || 'Unknown DB connection error';
            const retryDelay = Math.min(30000, 1000 * Math.pow(2, Math.min(5, attempt - 1)));
            logger_1.default.warn(`Database connection failed, retrying...`, {
                attempt,
                host: dbHost,
                database: dbName,
                error: message,
                nextRetryDelay: (retryDelay / 1000) + 's'
            });
            if (isProduction && attempt >= maxAttempts) {
                logger_1.default.error('Critical: Max DB connection attempts reached in production. Exiting.', {
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
            logger_1.default.info(`Attempting to clear port ${port} before startup`);
            await (0, killport_1.killProcessOnPort)(Number(port));
        }
        catch (err) {
            logger_1.default.error(`Failed to kill port ${port}:`, { error: err.message });
        }
    }
    if (isDevelopment) {
        await waitForPortAvailable(Number(port));
    }
    await waitForDbReady();
    try {
        logger_1.default.info(`Loading main application...`);
        require('./app.js');
    }
    catch (err) {
        require('./app');
    }
};
startServer();
