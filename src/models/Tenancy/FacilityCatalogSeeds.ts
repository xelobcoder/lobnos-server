import fs from 'fs';
import path from 'path';
import { Knex } from 'knex';
import logger from '../../hooks/logger';

export const FACILITY_CATALOG_TABLES = [
     'departments', 'samplecontainer', 'sampletype', 'testdetailcategory', 'test_panels', 'testdetails',
     'testcreationrules', 'testconditiondefinitions', 'testconditions', 'test_report_settings',
     'setupliteraturereview', 'customtestcreation', 'calculated_parameter_formulas',
] as const;

// Column order belongs to the checked-in snapshots, not the live reference tenant.
// Explicit lists allow later schema additions (e.g. test_panels.requires_qc) to retain their defaults.
const SNAPSHOT_COLUMNS: Record<string, string[]> = {
     departments: ['id', 'department', 'departmentManager', 'employeeid'],
     samplecontainer: ['id', 'name', 'description', 'volume_capacity', 'material', 'color', 'is_reusable', 'created_at', 'updated_at'],
     sampletype: ['id', 'name', 'addedon'],
     testdetailcategory: ['categoryid', 'categoryname', 'testid', 'createdby', 'updatedby', 'created_at', 'updated_at', 'deleted'],
     test_panels: ['prim_key', 'name', 'category', 'price', 'created_on', 'sample', 'description', 'sample_container', 'unit', 'qty_required', 'shorttext', 'iscustom', 'id'],
     testdetails: [
          'id', 'testid', 'testcost', 'hasManual', 'procedureCode', 'pre_Tat', 'tat', 'post_Tat', 'tatCount',
          'updatedon', 'updatedby', 'isoutsourced', 'showtrend', 'testprice', 'hasGenderVariation', 'hasChildrenLimit',
          'childrenlimit', 'useLiterature', 'hasDrugs', 'outSourcingList', 'post_TatEvaluation', 'pre_TatEvaluation',
          'tatEvaluation', 'deviceInterfaceMapping', 'reportitle', 'method', 'instrumentation',
     ],
     testcreationrules: [
          'id', 'testid', 'name', 'field', 'value', 'hasunits', 'units', 'plan', 'plain', 'ordering', 'isValueTracked',
          'textReference', 'upperlimit', 'lowerlimit', 'category', 'options', 'undercategory', 'categoryid', 'valueAlert',
          'alert', 'upperLimitFemale', 'lowerLimitFemale', 'upperLimitMale', 'lowerLimitMale', 'upperLimitChildren',
          'lowerLimitChildren', 'upperLimitNeonates', 'lowerLimitNeonates',
     ],
     testconditiondefinitions: ['id', 'conditionName', 'testId', 'createdBy', 'updatedBy', 'createdOn', 'updatedOn'],
     testconditions: ['id', 'testId', 'parameter', 'conditionId', 'target', 'inRange', 'createdBy', 'updatedOn', 'conditionConstraint'],
     test_report_settings: ['id', 'testid', 'resultsettings', 'created_at', 'updated_at'],
     setupliteraturereview: ['id', 'testid', 'literature', 'created_on', 'updated_on'],
     customtestcreation: ['id', 'testid', 'creationrule', 'createdon', 'updatedon'],
     calculated_parameter_formulas: [
          'id', 'testid', 'output_field_id', 'expression', 'input_parameters', 'unit', 'decimal_precision',
          'conditions', 'version', 'effective_from', 'effective_to', 'active', 'created_by', 'created_at',
     ],
};

// Empty plans were accepted by a permissive source database but fail strict enum inserts.
const LEGACY_EMPTY_PLAN_RULES = new Map<number, readonly [number, 'input' | 'ultrasoundFields']>([
     [261, [100114, 'input']], [262, [100114, 'input']], [263, [100114, 'input']],
     [264, [100114, 'input']], [265, [100114, 'input']],
     [604, [100223, 'ultrasoundFields']], [622, [100231, 'ultrasoundFields']],
     [623, [100222, 'ultrasoundFields']], [625, [100221, 'ultrasoundFields']],
     [626, [100224, 'ultrasoundFields']], [632, [100228, 'ultrasoundFields']],
     [633, [100226, 'ultrasoundFields']], [776, [100229, 'ultrasoundFields']],
     [777, [100238, 'ultrasoundFields']], [878, [100232, 'ultrasoundFields']],
     [879, [100227, 'ultrasoundFields']], [892, [100235, 'ultrasoundFields']],
     [979, [100264, 'ultrasoundFields']], [980, [100262, 'ultrasoundFields']],
     [981, [100263, 'ultrasoundFields']], [982, [100265, 'ultrasoundFields']],
]);

function normalizeLegacyUltrasoundPlans(statement: string): string {
     let quoted = false;
     let rowStart = -1;
     let fieldStart = -1;
     let fields: string[] = [];
     let output = '';
     let copiedThrough = 0;
     for (let index = statement.indexOf(' VALUES ') + 8; index < statement.length; index++) {
          const character = statement[index];
          if (quoted && character === '\\') { index++; continue; }
          if (character === "'") { quoted = !quoted; continue; }
          if (quoted) continue;
          if (character === '(') {
               rowStart = index;
               fieldStart = index + 1;
               fields = [];
          } else if (rowStart !== -1 && (character === ',' || character === ')')) {
               fields.push(statement.slice(fieldStart, index).trim());
               fieldStart = index + 1;
               if (character !== ')') continue;
               const legacyPlan = LEGACY_EMPTY_PLAN_RULES.get(Number(fields[0]));
               if (fields.length === SNAPSHOT_COLUMNS.testcreationrules.length &&
                    legacyPlan?.[0] === Number(fields[1]) &&
                    fields[3] === "''" && fields[4] === "''" && fields[5] === '0' &&
                    fields[6] === "''" && fields[7] === "''") {
                    fields[7] = `'${legacyPlan[1]}'`;
                    output += statement.slice(copiedThrough, rowStart) + '(' + fields.join(',') + ')';
                    copiedThrough = index + 1;
               }
               rowStart = -1;
          }
     }
     return output + statement.slice(copiedThrough);
}

/** mysql-dump exports one INSERT per line. Ignore dump session commands and all unrelated appended DDL. */
export function referenceInsertStatements(sql: string, table: string): string[] {
     if (!Object.prototype.hasOwnProperty.call(SNAPSHOT_COLUMNS, table)) throw new Error('Not a reference catalog table');
     const statements: string[] = [];
     for (const line of sql.split(/\r?\n/)) {
          if (!/^INSERT INTO /i.test(line)) continue;
          if (!line.startsWith(`INSERT INTO \`${table}\` VALUES `) || !line.endsWith(';')) {
               throw new Error('Unexpected reference catalog INSERT');
          }
          const statement = line.replace(`INSERT INTO \`${table}\` VALUES `,
               `INSERT INTO \`${table}\` (${SNAPSHOT_COLUMNS[table].map(column => '`' + column + '`').join(', ')}) VALUES `);
          const normalized = table === 'testcreationrules' ? normalizeLegacyUltrasoundPlans(statement) : statement;
          if (normalized !== statement) logger.warn('Normalized legacy ultrasound-report field types in facility reference catalog');
          statements.push(normalized);
     }
     return statements;
}

export function loadFacilityCatalogSeeds(): Array<{ table: string; statements: string[] }> {
     // Works from both src/models/Tenancy and dist/src/models/Tenancy; no cwd/env dependence.
     const directory = [
          path.resolve(__dirname, '../../../db-exports/primelabmaster/seeds'),
          path.resolve(__dirname, '../../../../db-exports/primelabmaster/seeds'),
     ].find(candidate => fs.existsSync(path.join(candidate, 'primelabmaster_test_panels.sql')));
     if (!directory) throw new Error('Required reference catalog assets are missing');
     return FACILITY_CATALOG_TABLES.map(table => {
          const sql = fs.readFileSync(path.join(directory, `primelabmaster_${table}.sql`), 'utf8');
          const statements = referenceInsertStatements(sql, table);
          if (['departments', 'samplecontainer', 'sampletype', 'testdetailcategory', 'test_panels', 'testdetails', 'testcreationrules'].includes(table) && !statements.length) {
               throw new Error('Required reference catalog data is empty');
          }
          return { table, statements };
     });
}

export async function applyFacilityCatalogSeeds(
     db: Knex,
     seeds: ReturnType<typeof loadFacilityCatalogSeeds>,
     adminName = 'Platform administrator',
): Promise<void> {
     // Pin FOREIGN_KEY_CHECKS to one connection, unlike pooled legacy seed raw queries.
     await db.transaction(async trx => {
          await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
          try {
               for (const table of [...FACILITY_CATALOG_TABLES].reverse()) await trx(table).delete();
               for (const seed of seeds) {
                    // Each statement is source-controlled, scoped to its allowlisted table.
                    // The tenant pool has multipleStatements disabled.
                    for (const statement of seed.statements) await trx.raw(statement);
               }
               // Snapshot authors are not tenant users. Attribute imported config to the initial admin,
               // rather than leave references to nonexistent source-tenant employees.
               const seededTables = new Set(seeds.map(seed => seed.table));
               if (seededTables.has('departments')) {
                    await trx('departments').update({ departmentManager: adminName, employeeid: 1 });
               }
               if (seededTables.has('testdetails')) {
                    await trx('testdetails').update({ updatedby: 1, testcost: 0, testprice: 0 });
               }
               if (seededTables.has('testdetailcategory')) {
                    await trx('testdetailcategory').update({ createdby: '1', updatedby: null });
               }
               if (seededTables.has('testconditiondefinitions')) {
                    await trx('testconditiondefinitions').update({ createdBy: 1, updatedBy: null });
               }
               if (seededTables.has('testconditions')) {
                    await trx('testconditions').update({ createdBy: '1' });
               }
               if (seededTables.has('calculated_parameter_formulas')) {
                    await trx('calculated_parameter_formulas').update({ created_by: 1 });
               }
               if (seededTables.has('test_panels')) await trx('test_panels').update({ price: 0 });
          } finally {
               await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
          }
     });
}
