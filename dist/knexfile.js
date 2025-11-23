module.exports = {
    development: {
        client: "mysql2",
        connection: {
            host: 'localhost',
            user: 'primelab',
            password: 'Barcelona45##',
            database: 'primetenant005',
            port: 3306
        },
        migrations: {
            directory: "./src/cron/command-line-tool-database/migrations"
        },
        seeds: {
            directory: "./src/migrations/KnexMigrations/Seeds"
        }
    }
};
