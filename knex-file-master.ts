// Load .env manually (parse and populate process.env before usage)
import fs from "fs";
import path from "path";
import { parse } from "dotenv";

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
     const envFile = fs.readFileSync(envPath, "utf8");
     const parsed = parse(envFile);
     for (const key of Object.keys(parsed)) {
          if (process.env[key] === undefined) process.env[key] = parsed[key];
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
