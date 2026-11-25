import type { Knex } from 'knex';
import mysql from 'mysql2/promise';
import { databaseTlsOptions } from '../../database/tls';
import KnexConnection from '../../database/KnexConnections';
import { singleTenantKnexInstance } from '../../database/connection';
import {
     initializeEmptyFacilitySchema,
     installFacilityProgrammableObjects,
} from './FacilitySchema';
import { loadFacilityStructureExports } from './FacilityStructureExports';
import { FACILITY_CATALOG_TABLES, loadFacilityCatalogSeeds } from './FacilityCatalogSeeds';
import { seedFacilityReferences } from './FacilityReferenceSeeds';
import { MasterDrugCatalogImporter } from '../drugs/MasterDrugCatalogImporter';
import type { RegisteredTenant } from './TenantRegistry';

const BOOTSTRAP_STATE_TABLE = 'pls_empty_tenant_bootstrap_state';
const REFERENCE_TABLES = [
     ...[...FACILITY_CATALOG_TABLES].reverse(),
     'departments',
     'shifts',
     'registrationsettings',
     'districts',
     'paymentmodes',
     'sampletype',
     'applicationsettings',
     'samplecontainer',
     'regions',
];

async function resetFacilityReferenceTables(db: Knex): Promise<void> {
     await db.transaction(async (trx) => {
          await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
          try {
               for (const table of REFERENCE_TABLES) await trx(table).delete();
          } finally {
               await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
          }
     });
}

export async function initializeEmptyTenantDatabase(tenant: RegisteredTenant): Promise<void> {
     const config = singleTenantKnexInstance.client.config.connection as Knex.MySql2ConnectionConfig;
     const databaseName = config.database;
     if (!databaseName || tenant.databaseName !== databaseName) {
          throw new Error('Empty-database initialization is limited to the configured local database');
     }
     const host = config.host || process.env.DB_HOST;
     const user = config.user || process.env.DB_USERNAME;
     const password = config.password ?? process.env.DB_PASSWORD;
     const port = Number(config.port || process.env.DB_PORT);
     if (!host || !user || password === undefined || !Number.isSafeInteger(port) || port <= 0) {
          throw new Error('Local database connection settings are incomplete');
     }

     const connection = await mysql.createConnection({
          ...databaseTlsOptions(host),
          host,
          port,
          user,
          password,
          database: databaseName,
          multipleStatements: false,
     });
     const lockName = `pls_empty_tenant_${tenant.tenantId}`;
     let lockAcquired = false;
     try {
          const [lockRows] = await connection.query('SELECT GET_LOCK(?, 30) AS acquired', [lockName]);
          lockAcquired = Number((lockRows as mysql.RowDataPacket[])[0]?.acquired) === 1;
          if (!lockAcquired) throw new Error('Timed out waiting for empty tenant database initialization');

          const [tableRows] = await connection.query(
               'SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE()',
          );
          const tableNames = (tableRows as mysql.RowDataPacket[]).map((row) => String(row.TABLE_NAME));
          const hasState = tableNames.includes(BOOTSTRAP_STATE_TABLE);
          if (tableNames.length > 0 && !hasState) {
               throw new Error('Refusing to initialize a database with existing tables and no bootstrap state');
          }
          await connection.query(
               `CREATE TABLE IF NOT EXISTS \`${BOOTSTRAP_STATE_TABLE}\` (` +
               '`id` tinyint unsigned NOT NULL PRIMARY KEY, `stage` varchar(20) NOT NULL)',
          );
          const [stateRows] = await connection.query(
               `SELECT stage FROM \`${BOOTSTRAP_STATE_TABLE}\` WHERE id = 1`,
          );
          let stage = String((stateRows as mysql.RowDataPacket[])[0]?.stage || '');
          if (!stage) {
               await connection.query(
                    `INSERT INTO \`${BOOTSTRAP_STATE_TABLE}\` (id, stage) VALUES (1, 'schema')`,
               );
               stage = 'schema';
          }
          if (stage !== 'schema' && stage !== 'references') {
               throw new Error(`Unknown empty tenant bootstrap stage: ${stage}`);
          }

          const structure = loadFacilityStructureExports();
          if (structure.tables.some((table) => table.name === BOOTSTRAP_STATE_TABLE)) {
               throw new Error('Bootstrap state table conflicts with the exported facility schema');
          }

          if (stage === 'schema') {
               await initializeEmptyFacilitySchema(connection, structure, databaseName, true);
               await installFacilityProgrammableObjects(connection, structure, databaseName, true);
               const db = await KnexConnection(tenant.tenantId);
               await resetFacilityReferenceTables(db);
               await seedFacilityReferences(db, loadFacilityCatalogSeeds(), 'Platform administrator');
               await new MasterDrugCatalogImporter().importInto(db, 1);
               await connection.query(
                    `UPDATE \`${BOOTSTRAP_STATE_TABLE}\` SET stage = 'references' WHERE id = 1`,
               );
          }
     } finally {
          try {
               if (lockAcquired) await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
          } finally {
               await connection.end();
          }
     }
}
