import { databaseTlsOptions } from '../../../database/tls';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Versioned catalog snapshot used by facility and master-control bootstrappers.
const DUMP_FILES = [
     'primelabmaster_departments.sql',
     'primelabmaster_samplecontainer.sql',
     'primelabmaster_sampletype.sql',
     'primelabmaster_testdetailcategory.sql',
     'primelabmaster_test_panels.sql',
     'primelabmaster_testdetails.sql',
     'primelabmaster_testcreationrules.sql',
     'primelabmaster_testconditiondefinitions.sql',
     'primelabmaster_testconditions.sql',
     'primelabmaster_test_report_settings.sql',
     'primelabmaster_setupliteraturereview.sql',
     'primelabmaster_customtestcreation.sql',
     'primelabmaster_calculated_parameter_formulas.sql',
];

// Deleted in reverse-dependency order before reloading, so re-running this seed is idempotent.
const TABLES_TO_CLEAR = [
     'calculated_parameter_formulas',
     'customtestcreation',
     'setupliteraturereview',
     'test_report_settings',
     'testconditions',
     'testconditiondefinitions',
     'testcreationrules',
     'testdetails',
     'test_panels',
     'testdetailcategory',
     'sampletype',
     'samplecontainer',
     'departments',
];

const DUMPS_DIR = path.join(__dirname, '..', '..', '..', '..', 'db-exports', 'primelabmaster', 'seeds');

exports.seed = async function (knex: any) {
     const dbNameResult = await knex.raw('SELECT DATABASE() AS db');
     const db = dbNameResult[0][0].db;

     const raw = await mysql.createConnection({
          ...databaseTlsOptions(process.env.DB_HOST || 'localhost'),
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USERNAME || 'root',
          password: process.env.DB_PASSWORD || '',
          database: db,
          multipleStatements: true,
     });

     try {
          await raw.query('SET FOREIGN_KEY_CHECKS = 0');

          for (const table of TABLES_TO_CLEAR) {
               if (await knex.schema.hasTable(table)) {
                    await raw.query(`DELETE FROM \`${table}\``);
               }
          }

          for (const file of DUMP_FILES) {
               const filePath = path.join(DUMPS_DIR, file);
               if (!fs.existsSync(filePath)) {
                    throw new Error(`[test-panels-seed-data] Required catalog dump is missing: ${file}`);
               }
               await raw.query(fs.readFileSync(filePath, 'utf8'));
               console.log(`[test-panels-seed-data] Loaded ${file}`);
          }

          await raw.query('SET FOREIGN_KEY_CHECKS = 1');
     } finally {
          await raw.end();
     }
};
