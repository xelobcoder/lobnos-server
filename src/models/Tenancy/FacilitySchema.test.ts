import { describe, expect, it } from 'vitest';
import { createFacilitySchema, isolateReferenceDdl, safeDatabaseIdentifier } from './FacilitySchema';
import { applyFacilityCatalogSeeds, loadFacilityCatalogSeeds, referenceInsertStatements } from './FacilityCatalogSeeds';
import { exportedSqlStatements, loadFacilityStructureExports, structureFromExports } from './FacilityStructureExports';
import { caseSensitiveCollation, TENANT_COLLATION } from '../../database/legacy-upgrade/SchemaCollationPolicy';

describe('facility schema isolation', () => {
     it.each(['db; DROP DATABASE x', 'db`evil', '../tenant', '', 'x'.repeat(65)])('rejects unsafe DB name %s', value => {
          expect(() => safeDatabaseIdentifier(value)).toThrow();
     });
     it('resets counters, removes view definers and rewrites source references', () => {
          const ddl = 'CREATE DEFINER=`root`@`localhost` VIEW `v` AS SELECT `reference`.`patients`.`id` FROM `reference`.`patients`';
          expect(isolateReferenceDdl(ddl, 'reference', 'PLS123456')).toBe(
               'CREATE VIEW `v` AS SELECT `PLS123456`.`patients`.`id` FROM `PLS123456`.`patients`',
          );
          expect(isolateReferenceDdl('CREATE TABLE `roles` (`id` int) AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4', 'reference', 'PLS123456'))
               .not.toContain('AUTO_INCREMENT=37');
     });
     it('rejects external view and FK database dependencies', () => {
          expect(() => isolateReferenceDdl('SELECT * FROM `other_tenant`.`patients`', 'reference', 'PLS123456')).toThrow();
          expect(() => isolateReferenceDdl('FOREIGN KEY (`id`) REFERENCES `other_tenant`.`roles` (`id`)', 'reference', 'PLS123456')).toThrow();
     });
     it('never silently skips a table creation failure and restores FK checks', async () => {
          const queries: string[] = [];
          const db: any = { query: async (sql: string) => {
               queries.push(sql);
               if (sql.startsWith('SELECT')) return [[{ TABLE_NAME: 'roles', TABLE_TYPE: 'BASE TABLE' }]];
               if (sql.startsWith('SHOW')) return [[{ 'Create Table': 'CREATE TABLE `roles` (`id` int)' }]];
               if (sql.startsWith('CREATE TABLE')) throw new Error('DDL failure');
               return [[]];
          } };
          await expect(createFacilitySchema(db, { tables: [{ name: 'roles', ddl: 'CREATE TABLE `roles` (`id` int)' }], objects: [] }, 'PLS123456'))
               .rejects.toThrow('DDL failure');
          expect(queries).toContain('SET FOREIGN_KEY_CHECKS = 1');
          expect(queries.some(sql => /INSERT|SELECT \*/.test(sql))).toBe(false);
          expect(queries.some(sql => /IF NOT EXISTS/.test(sql))).toBe(false);
          expect(queries.some(sql => /SHOW CREATE|information_schema/.test(sql))).toBe(false);
     });

     describe('authoritative structure exports', () => {
          it('normalizes every real provisioning table to the standard while preserving exact-match columns', () => {
               for (const table of loadFacilityStructureExports().tables) {
                    const ddl = isolateReferenceDdl(table.ddl, 'primelabtestmig', 'PLS123456');
                    expect(ddl, table.name).toMatch(/DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci/);
                    for (const [, collation] of ddl.matchAll(/\bCOLLATE[ =]+(\w+)/gi)) {
                         expect(collation === TENANT_COLLATION || caseSensitiveCollation(collation), table.name).toBe(true);
                    }
                    for (const line of table.ddl.split('\n').filter(line => /COLLATE[ =]+\w*(?:_bin|_as_cs)\b/i.test(line))) {
                         expect(ddl, table.name).toContain(line);
                    }
               }
          });
          it('loads all 288 files as structures and stored programs, never data or dump resets', () => {
               const structure = loadFacilityStructureExports();
               expect(structure.tables).toHaveLength(287);
               expect(structure.objects.filter(object => object.kind === 'PROCEDURE')).toHaveLength(36);
               expect(structure.objects.some(object => object.name === 'billing_after_insert')).toBe(true);
               expect(structure.tables.some(table => table.name === 'roles')).toBe(true);
               for (const object of [...structure.tables, ...structure.objects]) {
                    expect(object.ddl).toMatch(/^CREATE /);
                    expect(object.ddl).not.toMatch(/DEFINER\s*=/i);
               }
          });
          it('keeps compound program bodies together while ignoring delimiters/comments', () => {
               expect(exportedSqlStatements("SET x=1;\nDELIMITER ;;\n/*!50003 CREATE*/ PROCEDURE `p`() BEGIN SELECT 'a;b'; SELECT 2; END;;\nDELIMITER ;\n"))
                    .toEqual(['SET x=1', "CREATE PROCEDURE `p`() BEGIN SELECT 'a;b'; SELECT 2; END"]);
          });
          it('rejects top-level exported data or destructive commands instead of executing them', () => {
               for (const sql of ["INSERT INTO `roles` VALUES (1,'default');", 'DROP DATABASE `other`;']) {
                    expect(() => structureFromExports([{ filename: 'primelabtestmig_roles.sql', sql }])).toThrow();
               }
          });
          it('exported triggers and procedures cannot create credentials, default PINs or licenses', () => {
               const credentialTables = '(?:roles|patients_credentials|clinicianscredentials|employees_credentials|encryption_keys|prime_window_access)';
               const credentialWrite = new RegExp(
                    '\\b(?:INSERT\\s+(?:IGNORE\\s+)?INTO|REPLACE\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+`?' + credentialTables + '`?\\b', 'i',
               );
               for (const object of loadFacilityStructureExports().objects) {
                    expect(object.ddl, object.name).not.toMatch(credentialWrite);
               }
          });
     });
});

describe('source-controlled reference catalog', () => {
     const legacyRule = (id = 604, testId = 100223, plan = "''", name = "'ULTRASOUND REPORT'") =>
          `(${[id, testId, name, "''", "''", 0, "''", plan, "''", 0, 0, "''",
               'NULL', 'NULL', "''", "''", 0, 'NULL', 'NULL', 'NULL', 'NULL', 'NULL',
               'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL'].join(',')})`;

     it('normalizes only known empty ultrasound placeholders, preserving other rows and escaped text', () => {
          const known = legacyRule(604, 100223, "''", "'Report\\'s (heading), text'");
          const unknown = legacyRule(999, 100223);
          const wrongTest = legacyRule(604, 999);
          const configured = legacyRule(622, 100231, "'plain'");
          const sql = `INSERT INTO \`testcreationrules\` VALUES ${known},${unknown},${wrongTest},${configured};`;
          const [statement] = referenceInsertStatements(sql, 'testcreationrules');
          expect(statement).toContain(known.replace(",0,'','','',", ",0,'','ultrasoundFields','',"));
          expect(statement).toContain(unknown);
          expect(statement).toContain(wrongTest);
          expect(statement).toContain(configured);
     });
     it('normalizes all 12 actual exported empty ultrasound field types', () => {
          const [statement] = loadFacilityCatalogSeeds().find(seed => seed.table === 'testcreationrules')!.statements;
          expect(statement.match(/'ultrasoundFields'/g)).toHaveLength(22);
          for (const id of [604, 622, 623, 625, 626, 632, 633, 776, 777, 878, 879, 892]) {
               expect(statement).toMatch(new RegExp(`\\(${id},\\d+,'[^']*','','',0,'','ultrasoundFields',`));
          }
     });
     it('loads real reference assets without appended unrelated DDL or default accounts', () => {
          const seeds = loadFacilityCatalogSeeds();
          expect(seeds.find(seed => seed.table === 'test_panels')?.statements.length).toBeGreaterThan(0);
          expect(seeds.map(seed => seed.table)).not.toContain('roles');
          const container = seeds.find(seed => seed.table === 'samplecontainer')!;
          expect(container.statements).toHaveLength(1);
          expect(container.statements[0]).toMatch(/^INSERT INTO `samplecontainer` \(`id`, /);
     });
     it('ignores dump session/DDL statements, rejects inserts into nonallowlisted tables', () => {
          expect(referenceInsertStatements("ALTER TABLE `roles` ...;\nINSERT INTO `samplecontainer` VALUES (1,'safe');\nUSE source;", 'samplecontainer'))
               .toEqual(["INSERT INTO `samplecontainer` (`id`, `name`, `description`, `volume_capacity`, `material`, `color`, `is_reusable`, `created_at`, `updated_at`) VALUES (1,'safe');"]);
          expect(() => referenceInsertStatements("INSERT INTO `roles` VALUES (1,'default');", 'samplecontainer')).toThrow();
          expect(() => referenceInsertStatements('', 'roles')).toThrow();
     });
     it('adds snapshot column lists so newer schema columns retain their defaults', () => {
          const panels = loadFacilityCatalogSeeds().find(seed => seed.table === 'test_panels')!;
          expect(panels.statements[0]).toContain('`prim_key`, `name`, `category`');
          expect(panels.statements[0]).not.toContain('`requires_qc`');
     });
     it.each([false, true])('pins FK changes to the transaction connection and restores them (failure=%s)', async fail => {
          const calls: string[] = [];
          const trx: any = (table: string) => ({
               delete: async () => { calls.push(`delete:${table}`); },
               update: async () => { calls.push(`update:${table}`); },
          });
          trx.raw = async (sql: string) => {
               calls.push(sql);
               if (fail && sql.startsWith('INSERT INTO')) throw new Error('seed failure');
          };
          const db: any = { transaction: async (action: any) => action(trx) };
          const operation = applyFacilityCatalogSeeds(db, [{ table: 'sampletype', statements: ["INSERT INTO `sampletype` (`id`,`name`,`addedon`) VALUES (1,'test',CURRENT_TIMESTAMP);"] }]);
          if (fail) await expect(operation).rejects.toThrow('seed failure');
          else await operation;
          expect(calls[0]).toBe('SET FOREIGN_KEY_CHECKS = 0');
          expect(calls[calls.length - 1]).toBe('SET FOREIGN_KEY_CHECKS = 1');
          expect(calls.findIndex(sql => sql.startsWith('INSERT INTO'))).toBeGreaterThan(
               calls.findIndex(sql => sql === 'delete:samplecontainer'),
          );
          expect(calls.some(sql => /DROP|ALTER|USE /.test(sql))).toBe(false);
     });
});
