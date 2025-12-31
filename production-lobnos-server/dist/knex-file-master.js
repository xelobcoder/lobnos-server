"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Load .env manually (parse and populate process.env before usage)
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = require("dotenv");
const envPath = path_1.default.resolve(__dirname, ".env");
if (fs_1.default.existsSync(envPath)) {
    const envFile = fs_1.default.readFileSync(envPath, "utf8");
    const parsed = (0, dotenv_1.parse)(envFile);
    for (const key of Object.keys(parsed)) {
        if (process.env[key] === undefined)
            process.env[key] = parsed[key];
    }
}
module.exports = {
    development: {
        client: "mysql2",
        connection: {
            host: process.env.SYSTEM_CONFIG_DB_HOST,
            user: process.env.SYSTEM_CONFIG_DB_USERNAME,
            password: process.env.SYSTEM_CONFIG_DB_PASSWORD,
            database: process.env.SYSTEM_CONFIG_DATABASE,
            port: Number(process.env.SYSTEM_CONFIG_DB_PORT)
        },
        migrations: {
            directory: "./src/cron/command-line-tool-database/systems/migrations"
        },
        seeds: {
            directory: "./src/cron/command-line-tool-database/systems/seeds"
        }
    }
};
