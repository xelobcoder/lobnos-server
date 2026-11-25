import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ facility: vi.fn(), connect: vi.fn(), warn: vi.fn() }));
vi.mock('../database/connection', () => ({ singleTenantKnexInstance: mocks.facility }));
vi.mock('mysql2/promise', () => ({ default: { createConnection: mocks.connect } }));
vi.mock('../hooks/logger', () => ({ default: { info: vi.fn(), warn: mocks.warn } }));

import { bootstrapMasterControlDatabase, MASTER_CONTROL_CATALOG_TABLES, missingControlCatalogTables, planPlatformDistrictSeeds, removeCatalogForeignKeys } from './MasterControlBootstrap';
import { loadFacilityStructureExports } from '../models/Tenancy/FacilityStructureExports';
import { configuration } from '../hooks/configuration';
import { DISTRICTS } from '../models/application/appsettings/constants/districts';

describe('platform district seed planning', () => {
     const north = { id: 60, regionid: 3, name: 'Tano North', code: 'HT' };
     const south = { id: 61, regionid: 3, name: 'Tano South', code: 'HT' };

     it('preserves both Tano districts and their IDs with deterministic unique codes', () => {
          expect(planPlatformDistrictSeeds([south, north], [])).toEqual([north, { ...south, code: 'HTD61' }]);
     });

     it('resumes a partial import without changing an existing code', () => {
          expect(planPlatformDistrictSeeds([north, south], [
               { id: 60, state_id: 3, district_code: 'HT' },
          ])).toEqual([{ ...south, code: 'HTD61' }]);
     });

     it('does not reseed a complete import', () => {
          expect(planPlatformDistrictSeeds([north, south], [
               { id: 60, state_id: 3, district_code: 'HT' },
               { id: 61, state_id: 3, district_code: 'HTD61' },
          ])).toEqual([]);
     });

     it('allows the same code in different states and normalizes case and whitespace', () => {
          expect(planPlatformDistrictSeeds([north, { ...south, regionid: 4, code: ' ht ' }], []))
               .toEqual([north, { ...south, regionid: 4, code: 'HT' }]);
     });

     it('avoids suffixes reserved by other source districts or existing platform rows', () => {
          const source = [north, south, { id: 62, regionid: 3, name: 'Other', code: 'HTD61' }];
          expect(planPlatformDistrictSeeds(source, [
               { id: 99, state_id: 3, district_code: 'htd61x1' },
          ]).map(district => district.code)).toEqual(['HT', 'HTD61X2', 'HTD61']);
     });

     it('keeps generated codes within the database column limit', () => {
          const code = 'A'.repeat(20);
          const planned = planPlatformDistrictSeeds([{ ...north, code }, { ...south, code }], []);
          expect(planned[1].code).toBe(`${'A'.repeat(17)}D61`);
     });

     it('rejects invalid codes instead of silently dropping a district', () => {
          expect(() => planPlatformDistrictSeeds([{ ...north, code: ' ' }], [])).toThrow('Invalid facility district code');
          expect(() => planPlatformDistrictSeeds([{ ...north, code: 'A'.repeat(21) }], [])).toThrow('Invalid facility district code');
     });

     it('retains every bundled district even when imported into the same state', () => {
          const source = DISTRICTS.map((district, index) => ({ ...district, id: index + 1, regionid: 3 }));
          const planned = planPlatformDistrictSeeds(source, []);
          expect(planned).toHaveLength(DISTRICTS.length);
          expect(new Set(planned.map(district => district.code)).size).toBe(DISTRICTS.length);
          expect(planned.every(district => district.code.length <= 20)).toBe(true);
          expect(planned.every(district => /^[A-Z][A-Z0-9]{2,29}$/.test(`AH${district.code}1`))).toBe(true);
     });
});

describe('master-control reference recovery', () => {
     const originalStandalone = configuration.desktopStandalone;

     beforeEach(() => {
          vi.clearAllMocks();
          configuration.desktopStandalone = false;
          vi.stubEnv('DATABASE', 'facility_test');
          vi.stubEnv('PRODUCTION_DATABASE', 'facility_test');
          mocks.facility.mockImplementation((table: string) => ({
               select: async () => table === 'regions'
                    ? [{ id: 3, name: 'Ahafo', regioncode: 'AH' }]
                    : [{ id: 60, name: 'Tano North', code: 'HT', regionid: 3 },
                         { id: 61, name: 'Tano South', code: 'HT', regionid: 3 }],
          }));
     });

     afterEach(() => {
          configuration.desktopStandalone = originalStandalone;
          vi.unstubAllEnvs();
     });

     function connectionHarness(failInsert = false, initialComplete = true) {
          const connection = {
               query: vi.fn(async (sql: string, values: unknown[] = []) => {
                    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }]];
                    if (sql.includes('INFORMATION_SCHEMA.SCHEMATA')) return [[{ SCHEMA_NAME: 'master_test' }]];
                    if (sql.includes("TABLE_NAME = 'pls_master_migrations'")) return [[{ TABLE_NAME: 'pls_master_migrations' }]];
                    if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [MASTER_CONTROL_CATALOG_TABLES.map(TABLE_NAME => ({ TABLE_NAME }))];
                    if (sql.startsWith('SELECT name FROM ??.pls_master_migrations')) {
                         return [values[1] === '20261123_seed_master_catalog_snapshot'
                              || values[1] === '20261015_reconcile_platform_references'
                              || (!initialComplete && values[1] === '20261013_initial_master_control')
                              ? [] : [{ name: values[1] }]];
                    }
                    if (sql.includes('SELECT 1 FROM ??.??')) {
                         return [MASTER_CONTROL_CATALOG_TABLES.includes(String(values[1])) ? [] : [{ present: 1 }]];
                    }
                    if (sql.includes('SELECT id FROM ??.platform_countries')) return [[{ id: 1 }]];
                    if (sql.includes('SELECT id FROM ??.platform_states')) return [[{ id: 3 }]];
                    if (sql.includes('SELECT id, state_id, district_code')) {
                         return [[{ id: 60, state_id: 3, district_code: 'HT' }]];
                    }
                    if (failInsert && sql.startsWith('INSERT INTO ??.platform_districts')) throw new Error('write failed');
                    return [[]];
               }),
               beginTransaction: vi.fn(),
               commit: vi.fn(),
               rollback: vi.fn(),
               end: vi.fn(),
          };
          mocks.connect.mockResolvedValue(connection);
          return connection;
     }

     it('repairs a partial table even when the initial migration was already marked complete', async () => {
          const connection = connectionHarness();
          await bootstrapMasterControlDatabase();
          const inserts = connection.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO ??.platform_districts'));
          expect(inserts.map(([, values]) => values.slice(1))).toEqual([[61, 1, 3, 'Tano South', 'HTD61']]);
          expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining('HT imported as HTD61'));
          expect(connection.beginTransaction).toHaveBeenCalledTimes(2);
          expect(connection.commit).toHaveBeenCalledTimes(2);
          expect(connection.rollback).not.toHaveBeenCalled();
          expect(connection.query).toHaveBeenCalledWith('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
               [configuration.masterControlDatabase, '20261015_reconcile_platform_references']);
     });

     it('records both initial and repair migrations only after successful reference seeding', async () => {
          const connection = connectionHarness(false, false);
          await bootstrapMasterControlDatabase();
          const markers = connection.query.mock.calls.filter(([sql]) => sql.startsWith('INSERT INTO ??.pls_master_migrations'));
          expect(markers.map(([, values]) => values[1])).toEqual([
               '20261123_seed_master_catalog_snapshot',
               '20261013_initial_master_control', '20261015_reconcile_platform_references',
          ]);
          const insertOrder = connection.query.mock.invocationCallOrder[
               connection.query.mock.calls.findIndex(([sql]) => sql.startsWith('INSERT INTO ??.platform_districts'))
          ];
          expect(insertOrder).toBeGreaterThan(connection.beginTransaction.mock.invocationCallOrder[0]);
          expect(connection.commit.mock.invocationCallOrder[0]).toBeGreaterThan(
               connection.query.mock.invocationCallOrder[
                    connection.query.mock.calls.findIndex(([sql]) => sql.startsWith('INSERT INTO ??.pls_master_migrations'))
               ],
          );
     });

     it('seeds empty facility location catalogs before importing platform references', async () => {
          const facilityRegions: Record<string, unknown>[] = [];
          const facilityDistricts: Record<string, unknown>[] = [];
          mocks.facility.mockImplementation((table: string) => {
               const records = table === 'regions' ? facilityRegions : facilityDistricts;
               return {
                    select: () => Object.assign(Promise.resolve(records), { orderBy: async () => records }),
                    insert: (rows: Record<string, unknown>[]) => ({
                         onConflict: () => ({
                              merge: async () => records.push(...rows.map((row, index) => ({ ...row, id: records.length + index + 1 }))),
                         }),
                    }),
               };
          });
          const connection = connectionHarness();

          await bootstrapMasterControlDatabase();

          expect(facilityRegions.length).toBeGreaterThan(0);
          expect(facilityDistricts.length).toBeGreaterThan(0);
          expect(connection.query).toHaveBeenCalledWith(
               'INSERT INTO ??.platform_states (id, country_id, state_name, state_code) VALUES (?, ?, ?, ?)',
               expect.any(Array),
          );
     });

     it('rolls back and leaves the repair migration pending when an insert fails', async () => {
          const connection = connectionHarness(true);
          await expect(bootstrapMasterControlDatabase()).rejects.toThrow('write failed');
          expect(connection.rollback).toHaveBeenCalledOnce();
          expect(connection.commit).toHaveBeenCalledOnce();
          expect(connection.query.mock.calls.some(([sql, values]) =>
               sql.startsWith('INSERT INTO ??.pls_master_migrations') && values[1] !== '20261123_seed_master_catalog_snapshot',
          )).toBe(false);
          expect(connection.end).toHaveBeenCalledOnce();
     });

     it('seeds the empty master catalog from checked-in assets without copying facility catalog tables', async () => {
          const connection = connectionHarness();
          await bootstrapMasterControlDatabase();

          const snapshotInserts = connection.query.mock.calls
               .map(([sql]) => String(sql))
               .filter(sql => sql.startsWith(`INSERT INTO \`${configuration.masterControlDatabase}\`.`));
          expect(snapshotInserts.some(sql => sql.includes('departments`'))).toBe(true);
          expect(snapshotInserts.some(sql => sql.includes('test_panels`'))).toBe(true);
          expect(snapshotInserts.some(sql => sql.includes('testcreationrules`'))).toBe(true);
          expect(mocks.facility.mock.calls.map(([table]) => table)).not.toContain('test_panels');
     });

     it('records the reference upgrade only after its catalog changes succeed', async () => {
          const connection = connectionHarness();
          const previous = connection.query.getMockImplementation()!;
          connection.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
               if (sql.startsWith('SELECT name FROM ??.pls_master_migrations') && values[1] === '20261123_enrich_master_reference_catalog') return [[]];
               if (sql.startsWith('SELECT id, name FROM ??.??')) return [[]];
               if (sql.startsWith('SELECT id, department AS name FROM ??.??')) return [[{ id: 6, name: 'Ultrasound' }]];
               if (sql.includes('MAX(CASE WHEN r.plan')) return [[{ id: 100240, name: 'TESTICULAR DOPPLER', category: 0, imaging: 0 }]];
               if (sql.includes('WHERE LOWER(TRIM(categoryName)) = ?')) return [[{ id: 12 }]];
               if (sql.includes('SELECT id, drug FROM ??.?? WHERE category = ?')) return [[]];
               return previous(sql, values);
          });
          await bootstrapMasterControlDatabase();
          expect(connection.query).toHaveBeenCalledWith('UPDATE ??.?? SET category = ? WHERE id = ?',
               [configuration.masterControlDatabase, 'test_panels', 6, 100240]);
          expect(connection.query).toHaveBeenCalledWith('INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
               [configuration.masterControlDatabase, '20261123_enrich_master_reference_catalog']);
     });

     it('seeds antibiotics for existing master databases that already recorded the earlier reference migration', async () => {
          const connection = connectionHarness();
          const previous = connection.query.getMockImplementation()!;
          connection.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
               if (sql.startsWith('SELECT name FROM ??.pls_master_migrations') && values[1] === '20261124_seed_master_antibiotic_catalog') return [[]];
               if (sql.includes('WHERE LOWER(TRIM(categoryName)) = ?')) return [[{ id: 12 }]];
               if (sql.includes('SELECT id, drug FROM ??.?? WHERE category = ?')) return [[]];
               return previous(sql, values);
          });

          await bootstrapMasterControlDatabase();

          const drugInserts = connection.query.mock.calls.filter(([sql]) =>
               sql.startsWith('INSERT INTO ??.?? (drug, category, createdby) VALUES (?, ?, ?)'));
          expect(drugInserts).toHaveLength(40);
          expect(connection.query).toHaveBeenCalledWith(
               'INSERT INTO ??.pls_master_migrations (name) VALUES (?)',
               [configuration.masterControlDatabase, '20261124_seed_master_antibiotic_catalog'],
          );
     });

     it('uses bundled platform locations when the facility database is absent', async () => {
          mocks.facility.mockImplementation(() => {
               const error: any = new Error('facility database is absent');
               error.code = 'ER_BAD_DB_ERROR';
               throw error;
          });
          const connection = connectionHarness();

          await bootstrapMasterControlDatabase();

          expect(mocks.warn).toHaveBeenCalledWith(expect.stringContaining('using bundled locations'));
          expect(connection.query.mock.calls.some(([sql]) => String(sql).startsWith('INSERT INTO ??.platform_states'))).toBe(true);
     });
});

describe('master-control catalog schema reconciliation', () => {
     it('creates only tables absent from the existing schema, ignoring identifier case', () => {
          expect(missingControlCatalogTables(
               ['roles', 'test_panels', 'testconditiondefinitions'],
               ['ROLES', 'test_panels'],
          )).toEqual(['testconditiondefinitions']);
     });

     it('does not request DDL for an already complete catalog schema', () => {
          expect(missingControlCatalogTables(['roles', 'test_panels'], ['roles', 'test_panels'])).toEqual([]);
     });

     it('removes only foreign-key constraints from newly provisioned master catalog tables', () => {
          const ddl = `CREATE TABLE \`testconditiondefinitions\` (
               \`id\` int NOT NULL,
               KEY \`idx_createdBy\` (\`createdBy\`),
               CONSTRAINT \`fk_createdby\` FOREIGN KEY (\`createdBy\`) REFERENCES \`roles\` (\`employeeid\`),
               CONSTRAINT \`fk_updatedby\` FOREIGN KEY (\`updatedBy\`) REFERENCES \`roles\` (\`employeeid\`)
          ) ENGINE=InnoDB`;
          const result = removeCatalogForeignKeys(ddl);
          expect(result).toContain('KEY `idx_createdBy` (`createdBy`)');
          expect(result).not.toMatch(/FOREIGN KEY|REFERENCES/);
          expect(result).toContain(') ENGINE=InnoDB');
     });

     it('keeps every reviewed master catalog table DDL valid without REFERENCES constraints', () => {
          const structure = loadFacilityStructureExports();
          for (const name of MASTER_CONTROL_CATALOG_TABLES) {
               const ddl = structure.tables.find(table => table.name === name)!.ddl;
               const result = removeCatalogForeignKeys(ddl);
               expect(result, name).not.toMatch(/FOREIGN KEY|REFERENCES/i);
               expect(result, name).not.toMatch(/,\s*,|\(\s*,|\b,\s*\)/);
          }
     });
});
