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
        host: 'localhost',
        user: 'primelab',
        password: 'Barcelona45##',
        database: 'primelimsorganizations',
        port: 3306
    },
    pool: {
        min: 2,
        max: 10,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
    seeds: {
        directory: './seeds',
    },
};
exports.tenancyConnection = (0, knex_1.default)(knexConfig);
