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
     return isolated;
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
     await connection.query('SET FOREIGN_KEY_CHECKS = 0');
     try {
          for (const table of structure.tables) {
               await connection.query(isolateReferenceDdl(table.ddl, EXPORTED_SOURCE_DATABASE, target));
          }
     } finally {
          await connection.query('SET FOREIGN_KEY_CHECKS = 1');
     }
}

/** Install authoritative financial/audit triggers and routines before current runtime upgrades. */
export async function installFacilityProgrammableObjects(
     connection: mysql.Connection, structure: FacilityStructure, target: string,
): Promise<void> {
     safeDatabaseIdentifier(target);
     await connection.query('USE ??', [target]);
     // Procedures first, so any trigger dependencies are available.
     for (const object of [
          ...structure.objects.filter(object => object.kind !== 'TRIGGER'),
          ...structure.objects.filter(object => object.kind === 'TRIGGER'),
     ]) {
          await connection.query(isolateReferenceDdl(object.ddl, EXPORTED_SOURCE_DATABASE, target));
     }
}
