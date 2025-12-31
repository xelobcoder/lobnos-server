"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const username = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DB_USERNAME : process.env.PRODUCTION_DB_USERNAME;
const password = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DB_PASSWORD : process.env.PRODUCTION_DB_PASSWORD;
const host = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DB_HOST : process.env.PRODUCTION_DB_HOSTNAME;
const database = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DATABASE : process.env.PRODUCTION_DATABASE;
if (!username || !password || !host || !database) {
    throw new Error('Missing required database environment variables.');
}
const connectionData = {
    host,
    user: username,
    password: password,
    database: database,
    waitForConnections: true,
    connectionLimit: 1000,
    timeout: 1000 * 60
};
const databaseConnectionPool = promise_1.default.createPool(connectionData);
async function checkConnection() {
    try {
        const connection = await databaseConnectionPool.getConnection();
        console.log('Database connection established successfully');
        connection.release();
    }
    catch (err) {
        handleConnection(err.code, err);
    }
}
function handleConnection(errcode, err) {
    switch (errcode) {
        case 'PROTOCOL_CONNECTION_LOST':
            console.error('Database connection was closed.');
            break;
        case 'ER_CON_COUNT_ERROR':
            console.error('Database has too many connections.');
            break;
        case 'ECONNREFUSED':
            console.error('Database connection was refused.');
            break;
        case 'ER_DUP_ENTRY':
            console.error('Duplicate values violation occurred.');
            break;
        default:
            console.error('Unexpected error:', err);
            throw err;
    }
}
checkConnection();
exports.default = databaseConnectionPool;
