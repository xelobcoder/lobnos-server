"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config({ path: './.env' });
const killport_js_1 = require("./models/security/killport.js");
const connection_1 = require("./database/connection");
const configuration_1 = require("./hooks/configuration");
const logger_1 = __importDefault(require("./hooks/logger"));
const node_net_1 = __importDefault(require("node:net"));
const port = process.env.NODE_ENV == 'development' ? process.env.DEVELOPMENT_PORT : process.env.PORT || 5000;
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForPortAvailable(targetPort) {
    let attempt = 0;
    while (true) {
        attempt += 1;
        const server = node_net_1.default.createServer();
        try {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(targetPort, '0.0.0.0', () => resolve());
            });
            await new Promise((resolve) => server.close(() => resolve()));
            return;
        }
        catch (err) {
            try {
                server.close();
            }
            catch (_a) {
            }
            if ((err === null || err === void 0 ? void 0 : err.code) === 'EADDRINUSE') {
                logger_1.default.error(`Port ${targetPort} is in use (attempt ${attempt}). Waiting...`);
                const delay = Math.min(10000, 1000 * Math.pow(2, Math.min(3, attempt - 1)));
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
}
async function waitForDbReady() {
    var _a;
    let attempt = 0;
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
            return;
        }
        catch (err) {
            const message = (err === null || err === void 0 ? void 0 : err.message) || ((_a = err === null || err === void 0 ? void 0 : err.toString) === null || _a === void 0 ? void 0 : _a.call(err)) || 'Unknown DB connection error';
            logger_1.default.error(`Database not ready (attempt ${attempt}): ${message}`);
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
    (0, killport_js_1.killProcessOnPort)(Number(port)).then(startServer);
}
else {
    startServer();
}
