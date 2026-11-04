import { databaseTlsOptions } from './tls';
import mysql, { Pool, PoolConnection} from 'mysql2/promise';


const username: string | undefined = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DB_USERNAME : process.env.PRODUCTION_DB_USERNAME;

const password: string | undefined = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DB_PASSWORD : process.env.PRODUCTION_DB_PASSWORD;

const host: string | undefined = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DB_HOST : process.env.PRODUCTION_DB_HOSTNAME;

const database: string | undefined = process.env.NODE_ENV === 'development' ?
    process.env.DEVELOPMENT_DATABASE : process.env.PRODUCTION_DATABASE;

if (!username || !password || !host || !database) {
    throw new Error('Missing required database environment variables.');
}

interface ConnectionData {
    host: string;
    user: string;
    password: string;
    database: string;
    waitForConnections: boolean;
    connectionLimit: number;
    timeout?: number;
}

const connectionData: ConnectionData = {
    host,
    user: username,
    password: password,
    database: database,
    waitForConnections: true,
    connectionLimit: 1000,
    timeout: 1000 * 60
};

const databaseConnectionPool: Pool = mysql.createPool({ ...connectionData, ...databaseTlsOptions(host) });



async function checkConnection(): Promise<void> {
    try {
        const connection: PoolConnection = await databaseConnectionPool.getConnection();
        console.log('Database connection established successfully');
        connection.release();
    } catch (err: any) {
        handleConnection(err.code, err);
    }
}

function handleConnection(errcode: string, err: Error): void {
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

export default databaseConnectionPool;
