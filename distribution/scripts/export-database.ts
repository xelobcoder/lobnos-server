#!/usr/bin/env ts-node
/**
 * Exports a full MySQL database (schema + data + triggers + routines) to a single
 * .sql file inside this repo, since mysqldump isn't guaranteed to be on PATH.
 *
 * Usage:
 *   npm run export:db -- --database primelabmaster --out-dir db-exports/primelabmaster
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

interface Options {
     host: string;
     port: number;
     user: string;
     password: string;
     database: string;
     outDir: string;
     batchSize: number;
     schemaOnly: boolean;
}

function parseArgs(argv: string[]): Options {
     const get = (flag: string) => {
          const idx = argv.indexOf(flag);
          return idx === -1 ? undefined : argv[idx + 1];
     };

     const database = get('--database');
     if (!database) {
          console.error('Usage: npm run export:db -- --database <dbName> [--out-dir <folder>] [--schema-only]');
          process.exit(1);
     }

     return {
          host: get('--host') || process.env.DB_HOST || 'localhost',
          port: Number(get('--port') || process.env.DB_PORT || 3306),
          user: get('--user') || process.env.DB_USERNAME || 'root',
          password: get('--password') || process.env.DB_PASSWORD || '',
          database,
          outDir: path.resolve(__dirname, '..', get('--out-dir') || path.join('db-exports', database)),
          batchSize: Number(get('--batch-size') || 500),
          schemaOnly: argv.includes('--schema-only'),
     };
}

async function exportDatabase(options: Options): Promise<void> {
     const conn = await mysql.createConnection({
          host: options.host,
          port: options.port,
          user: options.user,
          password: options.password,
          database: options.database,
     });

     fs.mkdirSync(options.outDir, { recursive: true });
     const outFile = path.join(options.outDir, `${options.database}.sql`);
     const out = fs.createWriteStream(outFile, { encoding: 'utf8' });

     const write = (line: string) => out.write(line + '\n');

     try {
          write(`-- Export of database \`${options.database}\` generated ${new Date().toISOString()}`);
          write('SET FOREIGN_KEY_CHECKS = 0;');
          write(`CREATE DATABASE IF NOT EXISTS \`${options.database}\`;`);
          write(`USE \`${options.database}\`;\n`);

          const [tables] = await conn.query<any[]>(
               "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
               [options.database]
          );

          let totalRows = 0;

          for (const { TABLE_NAME: table } of tables) {
               write(`-- ----------------------------\n-- Table structure for \`${table}\`\n-- ----------------------------`);
               write(`DROP TABLE IF EXISTS \`${table}\`;`);
               const [ddlRows]: any = await conn.query(`SHOW CREATE TABLE \`${table}\``);
               write(`${ddlRows[0]['Create Table']};\n`);

               const [countRows]: any = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
               const rowCount = countRows[0].c;
               if (!options.schemaOnly && rowCount > 0) {
                    write(`-- Data for \`${table}\` (${rowCount} rows)`);
                    let offset = 0;
                    while (offset < rowCount) {
                         const [rows]: any = await conn.query(`SELECT * FROM \`${table}\` LIMIT ? OFFSET ?`, [options.batchSize, offset]);
                         if (rows.length === 0) break;
                         const columns = Object.keys(rows[0]);
                         const values = rows.map((row: any) =>
                              `(${columns.map((col) => conn.escape(row[col])).join(', ')})`
                         );
                         write(
                              `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES\n${values.join(',\n')};`
                         );
                         offset += options.batchSize;
                    }
                    totalRows += rowCount;
                    write('');
               }
          }

          const [triggerRows]: any = await conn.query(`SHOW TRIGGERS FROM \`${options.database}\``);
          if (triggerRows.length > 0) {
               write('-- ----------------------------\n-- Triggers\n-- ----------------------------');
               for (const t of triggerRows) {
                    const [rows]: any = await conn.query(`SHOW CREATE TRIGGER \`${t.Trigger}\``);
                    write(`DROP TRIGGER IF EXISTS \`${t.Trigger}\`;`);
                    write(`${rows[0]['SQL Original Statement']};\n`);
               }
          }

          const [procRows]: any = await conn.query(
               'SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ?',
               [options.database]
          );
          if (procRows.length > 0) {
               write('-- ----------------------------\n-- Routines\n-- ----------------------------');
               for (const r of procRows) {
                    const isProc = r.ROUTINE_TYPE === 'PROCEDURE';
                    const [rows]: any = await conn.query(
                         `${isProc ? 'SHOW CREATE PROCEDURE' : 'SHOW CREATE FUNCTION'} \`${r.ROUTINE_NAME}\``
                    );
                    const ddl = rows[0][isProc ? 'Create Procedure' : 'Create Function'];
                    write(`DROP ${r.ROUTINE_TYPE} IF EXISTS \`${r.ROUTINE_NAME}\`;`);
                    write(`${ddl};\n`);
               }
          }

          write('SET FOREIGN_KEY_CHECKS = 1;');

          console.log(`Exported ${tables.length} table(s), ${totalRows} row(s), ${triggerRows.length} trigger(s), ${procRows.length} routine(s).`);
          console.log(`Written to ${outFile}`);
     } finally {
          out.end();
          await conn.end();
     }
}

const options = parseArgs(process.argv.slice(2));
exportDatabase(options).catch((error) => {
     console.error('Export failed:', error);
     process.exit(1);
});
