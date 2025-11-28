"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenancyConnection = void 0;
const knex_1 = __importDefault(require("knex"));
const knexConfig = {
    client: 'mysql2',
    connection: {
        host: process.env.SYSTEM_CONFIG_DB_HOST,
        user: process.env.SYSTEM_CONFIG_DB_USERNAME,
        password: process.env.SYSTEM_CONFIG_DB_PASSWORD,
        database: process.env.SYSTEM_CONFIG_DATABASE,
        port: Number(process.env.SYSTEM_CONFIG_DB_PORT)
    },
    pool: {
        min: 2,
        max: 10,
    },
    migrations: {
        directory: './src/cron/command-line-tool-database/system/migrations',
    },
    seeds: {
        directory: './src/cron/command-line-tool-database/system/seeds',
    },
};
exports.tenancyConnection = (0, knex_1.default)(knexConfig);
