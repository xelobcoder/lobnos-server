"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.primeTenancyConnector = exports.KnexConnectionTenant = void 0;
const knex_1 = __importDefault(require("knex"));
const promise_1 = __importDefault(require("mysql2/promise"));
const configuration_1 = require("../../hooks/configuration");
const tenantConnections = {};
const CONNECTION_TIMEOUT = 2000;
async function initializeTenantConnection(tenantId) {
    const tenantKey = String(tenantId);
    if (tenantConnections[tenantKey] &&
        Date.now() - tenantConnections[tenantKey].lastUsed < CONNECTION_TIMEOUT) {
        return tenantConnections[tenantKey];
    }
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: configuration_1.configuration.tenancyNaming(tenantId.toString()),
        port: Number(process.env.DB_PORT),
        connectionLimit: 10,
        waitForConnections: true,
        idleTimeout: 3000,
    };
    const pool = promise_1.default.createPool(Object.assign(Object.assign({}, config), { idleTimeout: 1000, enableKeepAlive: true, keepAliveInitialDelay: 10000 }));
    const knexInstance = (0, knex_1.default)({
        client: "mysql2",
        connection: config,
        pool: {
            min: 2,
            max: 20,
            idleTimeoutMillis: 1000,
            reapIntervalMillis: 1000,
            afterCreate: (conn, done) => {
                conn.query('SET SESSION wait_timeout=3;', (err) => done(err, conn));
            }
        },
    });
    if (tenantConnections[tenantKey]) {
        await tenantConnections[tenantKey].mysqlPool.end();
        await tenantConnections[tenantKey].knex.destroy();
    }
    tenantConnections[tenantKey] = {
        mysqlPool: pool,
        knex: knexInstance,
        lastUsed: Date.now()
    };
    return tenantConnections[tenantKey];
}
async function primeTenancyConnector(tenantId) {
    const connection = await initializeTenantConnection(tenantId);
    connection.lastUsed = Date.now();
    return connection.mysqlPool;
}
exports.primeTenancyConnector = primeTenancyConnector;
async function KnexConnectionTenant(tenantId) {
    const connection = await initializeTenantConnection(tenantId);
    connection.lastUsed = Date.now();
    return connection.knex;
}
exports.KnexConnectionTenant = KnexConnectionTenant;
