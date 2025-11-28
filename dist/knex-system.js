module.exports = {
    development: {
        client: "mysql2",
        connection: {
            host: process.env.SYSTEM_CONFIG_DB_HOST || 'localhost',
            user: process.env.SYSTEM_CONFIG_DB_USERNAME || 'primelab',
            password: process.env.SYSTEM_CONFIG_DB_PASSWORD || 'Barcelona45##',
            database: process.env.SYSTEM_CONFIG_DATABASE || 'primetenant005',
            port: Number(process.env.SYSTEM_CONFIG_DB_PORT || '3306')
        },
        migrations: {
            directory: "./src/cron/command-line-tool-database/systems/migrations"
        },
        seeds: {
            directory: "./src/cron/command-line-tool-database/systems/Seeds"
        }
    }
};
