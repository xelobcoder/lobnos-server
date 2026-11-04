import { UNICODE_CI_PROTOCOL_ID } from './legacy-upgrade/SchemaCollationPolicy';
import { databaseTlsOptions } from './tls';
import mysql from "mysql2/promise";
import knex from 'knex';

// Any NODE_ENV other than "production" (e.g. "test") uses the development database settings.
const environment = process.env.NODE_ENV === "production" ? "production" : "development";

interface DBConfig {
	host: string;
	user: string;
	password: string;
	database: string;
	port?: number;
	connectionLimit: number;
}

const config: Record<string, DBConfig> = {
	development: {
		host: process.env.DB_HOST!,
		user: process.env.DB_USERNAME!,
		password: process.env.DB_PASSWORD!,
		database: process.env.DATABASE!,
		port: Number(process.env.DB_PORT!),
		connectionLimit: 10,
	},
	production: {
		host: process.env.PRODUCTION_DB_HOSTNAME!,
		user: process.env.PRODUCTION_DB_USERNAME!,
		password: process.env.PRODUCTION_DB_PASSWORD!,
		database: process.env.PRODUCTION_DATABASE!,
		port: parseInt(process.env.PRODUCTION_DB_PORT || "2309", 10),
		connectionLimit: 10,
	},
};

const databaseConnectionPool = mysql.createPool({ ...config[environment], charsetNumber: UNICODE_CI_PROTOCOL_ID, ...databaseTlsOptions(config[environment].host) } as mysql.PoolOptions);

const singleTenantKnexInstance = knex({
	client: 'mysql2',
	connection: {
		host: config[environment].host,
		...databaseTlsOptions(config[environment].host),
        charsetNumber: UNICODE_CI_PROTOCOL_ID,
		user: config[environment].user,
		password: config[environment].password,
		database: config[environment].database,
		port: config[environment].port,
	},
	pool: {
		min: 0,
		max: config[environment].connectionLimit,
		afterCreate: (conn: any, done: Function) => {
			const mode = process.env.PLS_LEGACY_SCHEMA_UPGRADE === 'true'
                    ? "SET SESSION sql_mode = (SELECT REPLACE(REPLACE(REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''), 'NO_ZERO_DATE', ''), 'NO_ZERO_IN_DATE', ''))"
                    : "SET SESSION sql_mode = (SELECT REPLACE(@@sql_mode, 'ONLY_FULL_GROUP_BY', ''))";
               conn.query(mode, (err: any) => {
				done(err, conn);
			});
		}
	}
});



const systemConfigConnection = knex({
	client: "mysql2",
	connection: {
		host: process.env.SYSTEM_CONFIG_DB_HOST || config[environment].host,
		...databaseTlsOptions(process.env.SYSTEM_CONFIG_DB_HOST || config[environment].host, 'SYSTEM_CONFIG_DB'),
          charsetNumber: UNICODE_CI_PROTOCOL_ID,
		user: process.env.SYSTEM_CONFIG_DB_USERNAME || config[environment].user,
		password: process.env.SYSTEM_CONFIG_DB_PASSWORD || config[environment].password,
		database: process.env.SYSTEM_CONFIG_DATABASE || 'primelabmaster_control',
		port: Number(process.env.SYSTEM_CONFIG_DB_PORT || config[environment].port),
	}
	,pool: {
		min: 2,
		max: 10,
		afterCreate: (conn: any, done: Function) => {
			done(null, conn);
		}
	}
})

export { databaseConnectionPool, singleTenantKnexInstance, systemConfigConnection };
