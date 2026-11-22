import { normalizeSchemaTextCollations } from '../../database/legacy-upgrade/SchemaCollationPolicy';
import mysql from 'mysql2/promise';
import { EXPORTED_SOURCE_DATABASE, FacilityStructure } from './FacilityStructureExports';

export function safeDatabaseIdentifier(value: unknown): string {
     if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value)) {
          throw new Error('Invalid provisioning database identifier');
     }
     return value;
}

/** Reference DDL is trusted configuration, but must never retain references to another tenant. */
export function isolateReferenceDdl(ddl: string, source: string, target: string): string {
     safeDatabaseIdentifier(source);
     safeDatabaseIdentifier(target);
     let isolated = ddl.replace(/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/gi, '')
          .replace(new RegExp('`' + source + '`\\.', 'g'), '`' + target + '`.')
          .replace(/\bAUTO_INCREMENT=\d+\s*/g, '');
     // The supplied exports use quoted identifiers for schema-qualified table references.
     for (const match of isolated.matchAll(/`([^`]+)`\s*\.\s*`([^`]+)`\s*\.\s*`/g)) {
          if (match[1] !== target) throw new Error('Reference DDL has an external database dependency');
     }
     // Two-part database.table references in FK clauses and view FROM/JOIN expressions.
     for (const match of isolated.matchAll(/\b(?:REFERENCES|FROM|JOIN|UPDATE|INTO)\s+`([^`]+)`\s*\.\s*`/gi)) {
          if (match[1] !== target) throw new Error('Reference DDL has an external database dependency');
     }
     return normalizeSchemaTextCollations(isolated);
}

/**
 * CREATE (never reuse), authoritative exported table structures only, no source data.
 * Never execute dump DROP/SET commands. Every DDL error fails provisioning.
 */
export async function createFacilitySchema(
     connection: mysql.Connection, structure: FacilityStructure, target: string,
): Promise<void> {
     safeDatabaseIdentifier(target);
     if (EXPORTED_SOURCE_DATABASE === target) throw new Error('Export source and target databases must differ');
     if (!structure.tables.length) throw new Error('Exports have no schema');
     await connection.query('CREATE DATABASE ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci', [target]);
     await connection.query('USE ??', [target]);
     await createFacilityTables(connection, structure, target, false);
}

export async function initializeEmptyFacilitySchema(
     connection: mysql.Connection,
     structure: FacilityStructure,
     target: string,
     allowPartialInitialization = false,
): Promise<void> {
     safeDatabaseIdentifier(target);
     if (EXPORTED_SOURCE_DATABASE === target) throw new Error('Export source and target databases must differ');
     if (!structure.tables.length) throw new Error('Exports have no schema');
     await connection.query('USE ??', [target]);
     const [rows] = await connection.query(
          'SELECT COUNT(*) AS tableCount FROM information_schema.tables WHERE table_schema = DATABASE()',
     );
     const tableCount = Number((rows as mysql.RowDataPacket[])[0]?.tableCount);
     if (!Number.isSafeInteger(tableCount) || tableCount < 0) {
          throw new Error('Unable to verify that the tenant database is empty');
     }
     if (tableCount > 0 && !allowPartialInitialization) {
          throw new Error('Refusing to initialize a database that already contains tables');
     }
     await createFacilityTables(connection, structure, target, true);
}

async function createFacilityTables(
     connection: mysql.Connection,
     structure: FacilityStructure,
     target: string,
     ifNotExists: boolean,
): Promise<void> {
     await connection.query('SET FOREIGN_KEY_CHECKS = 0');
     try {
          for (const table of structure.tables) {
               const ddl = isolateReferenceDdl(table.ddl, EXPORTED_SOURCE_DATABASE, target);
               await connection.query(ifNotExists
                    ? ddl.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ')
                    : ddl);
          }
     } finally {
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
     }
}

/** Install authoritative financial/audit triggers and routines before current runtime upgrades. */
export async function installFacilityProgrammableObjects(
     connection: mysql.Connection,
     structure: FacilityStructure,
     target: string,
     skipExisting = false,
): Promise<void> {
     safeDatabaseIdentifier(target);
     await connection.query('USE ??', [target]);
     // Procedures first, so any trigger dependencies are available.
     for (const object of [
          ...structure.objects.filter(object => object.kind !== 'TRIGGER'),
          ...structure.objects.filter(object => object.kind === 'TRIGGER'),
     ]) {
          if (skipExisting) {
               const table = object.kind === 'TRIGGER' ? 'triggers' : 'routines';
               const typeCondition = object.kind === 'TRIGGER' ? '' : ' AND routine_type = ?';
               const values = object.kind === 'TRIGGER'
                    ? [object.name]
                    : [object.name, object.kind];
               const [rows] = await connection.query(
                    `SELECT 1 FROM information_schema.${table} WHERE ${object.kind === 'TRIGGER' ? 'trigger_schema' : 'routine_schema'} = DATABASE() AND ${object.kind === 'TRIGGER' ? 'trigger_name' : 'routine_name'} = ?${typeCondition} LIMIT 1`,
                    values,
               );
               if ((rows as mysql.RowDataPacket[]).length > 0) continue;
          }
          await connection.query(isolateReferenceDdl(object.ddl, EXPORTED_SOURCE_DATABASE, target));
     }
}
