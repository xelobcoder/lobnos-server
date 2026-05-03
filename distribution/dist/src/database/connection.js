"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemConfigConnection = exports.singleTenantKnexInstance = exports.databaseConnectionPool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const knex_1 = __importDefault(require("knex"));
const environment = process.env.NODE_ENV || "development";
const config = {
    development: {
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DATABASE,
        port: Number(process.env.DB_PORT),
        connectionLimit: 10,
    },
    production: {
        host: process.env.PRODUCTION_DB_HOSTNAME,
        user: process.env.PRODUCTION_DB_USERNAME,
        password: process.env.PRODUCTION_DB_PASSWORD,
        database: process.env.PRODUCTION_DATABASE,
        port: parseInt(process.env.PRODUCTION_DB_PORT || "3306", 10),
        connectionLimit: 10,
    },
};
const databaseConnectionPool = promise_1.default.createPool(config[environment]);
exports.databaseConnectionPool = databaseConnectionPool;
const singleTenantKnexInstance = (0, knex_1.default)({
    client: 'mysql2',
    connection: {
        host: config[environment].host,
        user: config[environment].user,
        password: config[environment].password,
        database: config[environment].database,
        port: config[environment].port,
    },
    pool: {
        min: 0,
        max: config[environment].connectionLimit,
        afterCreate: (conn, done) => {
            conn.query("SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))", (err) => {
                done(err, conn);
            });
        }
    }
});
exports.singleTenantKnexInstance = singleTenantKnexInstance;
const systemConfigConnection = (0, knex_1.default)({
    client: "mysql2",
    connection: {
        host: process.env.SYSTEM_CONFIG_DB_HOST,
        user: process.env.SYSTEM_CONFIG_DB_USERNAME,
        password: process.env.SYSTEM_CONFIG_DB_PASSWORD,
        database: process.env.SYSTEM_CONFIG_DATABASE,
        port: Number(process.env.SYSTEM_CONFIG_DB_PORT),
    },
    pool: {
        min: 2,
        max: 10,
        afterCreate: (conn, done) => {
            done(null, conn);
        }
    }
});
exports.systemConfigConnection = systemConfigConnection;
