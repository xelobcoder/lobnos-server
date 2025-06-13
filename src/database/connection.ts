import mysql from "mysql2/promise";
import knex from 'knex';

const environment = process.env.NODE_ENV || "development";

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
		port: parseInt(process.env.PRODUCTION_DB_PORT || "3306", 10),
		connectionLimit: 10,
	},
};

const databaseConnectionPool = mysql.createPool(config[environment] as mysql.PoolOptions);

const singleTenantKnexInstance = knex({
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
		afterCreate: (conn: any, done: Function) => {
			done(null, conn);
		}
	}
});


export { databaseConnectionPool, singleTenantKnexInstance };
