import knex, { Knex } from 'knex';

const knexConfig: Knex.Config = {
     client: 'mysql2',
     connection: {
          host: 'localhost',
          user: 'primelab',
          password: 'Barcelona45##',
          database: 'primelimsorganizations',
          port:3306
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

export const tenancyConnection = knex(knexConfig);

