import { createHash } from 'crypto';
import type { Knex } from 'knex';
import { z } from 'zod';
import KnexConnection from '../../database/KnexConnections';
import { configuration } from '../../hooks/configuration';
import { applyTestPanelsAfterInsert } from '../../database/appLevelTriggers';
import { testPanelCache } from '../../services/cache/testPanelCache';
import { generateNextTestPanelId } from '../../testpanel/testPanelId';
import { ensureDeveloperSupportIdentity, ensureSupportColumn } from './DeveloperSupportIdentity';
import { normalizeParameterName } from '../creator/criticalValueAnalyzer';
import { FacilityError } from './FacilityInput';
import type { FacilityActor } from './FacilityProvisioningService';
import { TenantRegistry } from './TenantRegistry';

const id = z.number().int().positive().max(2147483647);
const tenantId = z.number().int().min(100000).max(999999);
const copyInput = z.discriminatedUnion('mode', [
     z.object({ mode: z.literal('panel'), sourceTenantId: tenantId, targetTenantId: tenantId, sourceTestId: id,
          price: z.number().int().min(0).max(2147483647), standardSetup: z.boolean().optional() }),
     z.object({ mode: z.literal('parameters'), sourceTenantId: tenantId, targetTenantId: tenantId, sourceTestId: id,
          targetTestId: id, fieldIds: z.array(id).min(1).max(500) }),
]);
type CopyInput = z.infer<typeof copyInput>;
type Db = Knex | Knex.Transaction;
type Row = Record<string, any>;

const RULE_COLUMNS = ['name','field','value','hasunits','units','plan','plain','isValueTracked','textReference','upperlimit',
     'lowerlimit','category','options','undercategory','valueAlert','alert','upperLimitFemale','lowerLimitFemale',
     'upperLimitMale','lowerLimitMale','upperLimitChildren','lowerLimitChildren','upperLimitNeonates','lowerLimitNeonates'];
const DETAILS_COLUMNS = ['procedureCode','pre_Tat','tat','post_Tat','tatCount','showtrend','hasGenderVariation',
     'hasChildrenLimit','childrenlimit','post_TatEvaluation','pre_TatEvaluation','tatEvaluation','reportitle','method','instrumentation'];
const CONSTRAINT_COLUMNS = ['action','constraint_type','replacement_text','value','prefix','suffix'];
const CONDITION_COLUMNS = ['parameter','target','inRange','conditionConstraint'];
const ADVANCED_PLANS = new Set(['ultrasoundFields', 'fetalBiometry']);
const label = normalizeParameterName;
const pick = (row: Row, fields: string[]) => Object.fromEntries(fields.filter(field => row[field] !== undefined).map(field => [field, row[field]]));
const ordered = (value: unknown) => JSON.stringify(value);
const signatures = (rows: Row[], columns: string[]) => rows.map(row => ordered(pick(row, columns))).sort().join('\n');
const affects = (field: Row, condition: Row) => [field.field, field.name].some(value => label(value) && label(value) === label(condition.parameter));

async function optionalRows(db: Db, table: string, key: string, value: number) {
     return (await db.schema.hasTable(table)) ? db(table).where(key, value).orderBy('id') : [];
}

async function tenantDb(id: number) {
     if (!configuration.isMultiTenant) throw new FacilityError('Copy test setup requires multi-tenant mode', 409);
     const tenant = await new TenantRegistry().getTenant(id);
     if (!tenant?.isActive) throw new FacilityError('Select an active facility', 409);
     return KnexConnection(id);
}

function readInput(value: unknown): CopyInput {
     const result = copyInput.safeParse(value);
     if (!result.success) throw new FacilityError('Select both facilities, the panels, and a destination price or parameters', 400);
     if (result.data.sourceTenantId === result.data.targetTenantId) throw new FacilityError('Select two different facilities', 400);
     return result.data;
}

async function inspect(source: Db, destination: Db, input: CopyInput, lock = false) {
     const existingPanelQuery = destination('test_panels');
     const sourcePanel = await source('test_panels').where({ id: input.sourceTestId }).first();
     if (!sourcePanel) throw new FacilityError('The source panel was not found', 404);
     const destinationPanel = await (lock ? existingPanelQuery.forUpdate() : existingPanelQuery)
          .where(input.mode === 'panel' ? { name: sourcePanel.name } : { id: input.targetTestId }).first();
     if (input.mode === 'parameters' && !destinationPanel) throw new FacilityError('The destination panel was not found', 404);

     const sourceFields = await source('testcreationrules').where({ testid: sourcePanel.id }).orderBy('ordering').orderBy('id');
     const destinationFields = destinationPanel && input.mode === 'parameters'
          ? await (lock ? destination('testcreationrules').forUpdate() : destination('testcreationrules'))
               .where({ testid: destinationPanel.id }).orderBy('id') : [];
     const sourceCategories = await source('testdetailcategory').where({ testid: sourcePanel.id, deleted: 0 }).orderBy('categoryid');
     const destinationCategories = destinationFields.length || input.mode === 'parameters'
          ? await destination('testdetailcategory').where({ testid: destinationPanel.id, deleted: 0 }).orderBy('categoryid') : [];
     const sourceConstraints = await optionalRows(source, 'field_constraints', 'testid', sourcePanel.id);
     const destinationConstraints = input.mode === 'parameters' ? await optionalRows(destination, 'field_constraints', 'testid', destinationPanel.id) : [];
     const sourceConditions = await optionalRows(source, 'testconditions', 'testId', sourcePanel.id);
     const destinationConditions = input.mode === 'parameters' ? await optionalRows(destination, 'testconditions', 'testId', destinationPanel.id) : [];
     const formulas = await optionalRows(source, 'calculated_parameter_formulas', 'testid', sourcePanel.id);
     const blockers: string[] = [];
     if (input.mode === 'parameters' && Number(destinationPanel.iscustom)) blockers.push('This destination panel uses a custom result template.');
     const mappings: Record<string, number> = {};
     const missingReferences: { column: string; table: string; values: Row }[] = [];
     const warnings: string[] = [];
     let literature: Row[] = [];
     let literatureAvailable = true;
     const mappingState: Row[] = [];
     const details = input.mode === 'panel' ? await source('testdetails').where({ testid: sourcePanel.id }).first() : undefined;
     if (input.mode === 'panel') {
          if (destinationPanel) blockers.push('A panel with this name already exists. Use Copy selected parameters.');
          const hasDeviceMapping = details?.deviceInterfaceMapping &&
               !['{}', '[]', 'null'].includes(String(details.deviceInterfaceMapping).trim());
          if (Number(sourcePanel.iscustom) || hasDeviceMapping) {
               if (input.standardSetup) warnings.push('The new panel uses the standard result form. Custom templates and device mappings require setup at the destination.');
               else blockers.push('This panel uses a custom template or device mapping. Select Copy as standard setup and preview again.');
          }
          if (Number(sourcePanel.requires_qc) || formulas.some(row => Number(row.active))
               || Number(details?.hasManual) || Number(details?.hasDrugs)
               || Number(details?.isoutsourced)) {
               blockers.push('This panel has calculated, QC, manual, drug or outsourcing setup that requires manual transfer.');
          }
          if (Number(details?.useLiterature)) {
               literature = await optionalRows(source, 'setupliteraturereview', 'testid', sourcePanel.id);
               literatureAvailable = !literature.length || await destination.schema.hasTable('setupliteraturereview');
               if (!literatureAvailable) blockers.push('The destination does not support panel literature yet.');
               else if (literature.length) warnings.push('The copy will include the source panel’s report literature.');
          }
          for (const [column, table, key] of [['category','departments','department'], ['sample','sampletype','name'],
               ['sample_container','samplecontainer','name']]) {
               if (!Number(sourcePanel[column])) { mappings[column] = 0; continue; }
               const reference = await source(table).where({ id: sourcePanel[column] }).first();
               const matches = reference ? await destination(table).where(key, reference[key]).orderBy('id') : [];
               mappingState.push({ column, reference, matches });
               if (reference && !matches.length && input.standardSetup) {
                    const values = pick(reference, table === 'samplecontainer'
                         ? ['name', 'description', 'volume_capacity', 'material', 'color', 'is_reusable'] : [key]);
                    if (table === 'departments') {
                         const owner = await destination('roles').where({ activation: 1 }).orderBy('employeeid').first('employeeid');
                         mappingState.push({ owner });
                         Object.assign(values, {
                              departmentManager: owner ? 'System Import' : 'Unassigned',
                              employeeid: owner?.employeeid ?? 0,
                         });
                    }
                    missingReferences.push({ column, table, values });
                    warnings.push(`The copy will create destination ${table === 'departments' ? 'department' : table === 'sampletype' ? 'sample type' : 'sample container'} "${reference[key]}".`);
               } else if (matches.length !== 1) blockers.push(`Map ${key === 'department' ? 'department' : table === 'sampletype' ? 'sample type' : 'sample container'} "${reference?.[key] ?? sourcePanel[column]}" in the destination first.`);
               else if (table === 'samplecontainer' && ['material','volume_capacity','color','is_reusable'].some(field => label(reference[field]) !== label(matches[0][field]))) {
                    blockers.push(`The destination sample container "${reference[key]}" has different specifications.`);
               } else mappings[column] = Number(matches[0].id);
          }
     }
     const selected = input.mode === 'panel' ? sourceFields : sourceFields.filter(field => input.fieldIds.includes(field.id));
     if (input.mode === 'parameters' && selected.length !== new Set(input.fieldIds).size) throw new FacilityError('Some selected parameters no longer exist', 409);
     if (!selected.length) blockers.push('There are no saved parameters to copy.');
     const conditionGroups = await optionalRows(source, 'testconditiondefinitions', 'testId', sourcePanel.id);
     const matchedConditions = sourceConditions.filter(rule => selected.some(field => affects(field, rule)));
     const policies = matchedConditions.length && await source.schema.hasTable('lab_critical_policies')
          ? await source('lab_critical_policies').whereIn('rule_id', matchedConditions.map(rule => rule.id)).orderBy('rule_id')
          : [];
     if (input.mode === 'panel' && matchedConditions.length !== sourceConditions.length) blockers.push('Some critical rules cannot be matched to a source parameter.');
     const constraintStorage = !sourceConstraints.length || await destination.schema.hasTable('field_constraints');
     const conditionStorage = !matchedConditions.length ||
          (await destination.schema.hasTable('testconditions') && await destination.schema.hasTable('testconditiondefinitions'));
     const rows = selected.map(field => {
          const keyMatches = (candidate: Row) => (label(field.field) && label(candidate.field) === label(field.field)) ||
               (label(field.name) && label(candidate.name) === label(field.name));
          const matches = destinationFields.filter(keyMatches);
          const existing = matches[0];
          const sourceCategory = sourceCategories.find(category => category.categoryid === field.categoryid)?.categoryname ?? null;
          const destinationCategory = destinationCategories.find(category => category.categoryid === existing?.categoryid)?.categoryname ?? null;
          const differences = existing ? RULE_COLUMNS.filter(column => String(field[column] ?? '') !== String(existing[column] ?? '')) : [];
          if (existing && sourceCategory !== destinationCategory) differences.push('parameter group');
          const constraints = sourceConstraints.filter(rule => rule.fieldid === field.id).map(rule => pick(rule, CONSTRAINT_COLUMNS));
          const copiedConditions = matchedConditions.filter(rule => affects(field, rule));
          if (existing && signatures(constraints, CONSTRAINT_COLUMNS) !==
               signatures(destinationConstraints.filter(rule => rule.fieldid === existing.id), CONSTRAINT_COLUMNS)) differences.push('field constraints');
          if (existing && signatures(copiedConditions, CONDITION_COLUMNS) !==
               signatures(destinationConditions.filter(rule => affects(existing, rule)), CONDITION_COLUMNS)) differences.push('critical rules');
          const unsupported = ADVANCED_PLANS.has(field.plan) || formulas.some(formula => Number(formula.active) && formula.output_field_id === field.id);
          const inconsistent = sourceFields.filter(keyMatches).length > 1 || matches.length > 1 ||
               (field.categoryid && !sourceCategory) || !label(field.name);
          const destinationRuleCollision = !existing && destinationConditions.some(rule => affects(field, rule));
          const transferIssue = unsupported ? 'This parameter needs manual calculation or imaging setup.'
               : destinationRuleCollision ? 'An existing destination critical rule already references this parameter.'
               : copiedConditions.some(rule => policies.some(policy => policy.rule_id === rule.id))
                    ? 'This parameter has facility-specific escalation or approval actions.'
               : copiedConditions.some(rule => !conditionGroups.some(group => group.id === rule.conditionId))
                    ? 'A critical rule has a missing condition group.'
               : constraints.length && !constraintStorage ? 'The destination does not support field constraints yet.'
               : copiedConditions.length && !conditionStorage ? 'The destination does not support critical rules yet.'
               : undefined;
          const reason = inconsistent ? 'Ambiguous parameter identity or missing parameter group.'
               : existing ? undefined : transferIssue;
          const status = reason ? 'blocked' : !existing ? 'add' : differences.length ? 'conflict' : 'exists';
          return { id: Number(field.id), name: String(field.name), status, differences, reason,
               source: { unit: field.units ?? null, range: [field.lowerlimit, field.upperlimit], type: field.plan },
               destination: existing ? { unit: existing.units ?? null, range: [existing.lowerlimit, existing.upperlimit], type: existing.plan } : null };
     });
     if (input.mode === 'panel' && rows.some(row => row.status !== 'add')) blockers.push('A full panel copy requires every parameter to be transferable.');
     const fingerprint = createHash('sha256').update(ordered([input, sourcePanel, destinationPanel, sourceFields, destinationFields,
          sourceCategories, destinationCategories, sourceConstraints, destinationConstraints, sourceConditions, destinationConditions,
          formulas, conditionGroups, policies, details, mappings, mappingState, constraintStorage, conditionStorage, literature, literatureAvailable])).digest('hex');
     return { sourcePanel, destinationPanel, selected, sourceCategories, destinationCategories, sourceConstraints,
          matchedConditions, conditionGroups, details, mappings, rows, blockers, warnings, missingReferences, literature, fingerprint };
}

async function copyRows(db: Knex.Transaction, input: CopyInput, plan: Awaited<ReturnType<typeof inspect>>, actor: FacilityActor) {
     let testId: number = Number(plan.destinationPanel?.id);
     if (input.mode === 'panel') {
          testId = Number(await generateNextTestPanelId(db));
          const mappings = { ...plan.mappings };
          for (const reference of plan.missingReferences) {
               const [referenceId] = await db(reference.table).insert(reference.values);
               mappings[reference.column] = Number(referenceId);
          }
          await db('test_panels').insert({
               ...pick(plan.sourcePanel, ['name','description','unit','qty_required','shorttext']),
               ...mappings, id: testId, price: input.price, iscustom: 0, copy_requires_publication: true,
          });
          await applyTestPanelsAfterInsert(db, { testid: testId, price: input.price, iscustom: 0 });
          if (plan.details) await db('testdetails').where({ testid: testId }).update({
               ...pick(plan.details, DETAILS_COLUMNS), useLiterature: Number(plan.details.useLiterature ?? 0),
          });
          if (plan.literature.length) await db('setupliteraturereview').insert(plan.literature.map(row => ({
               testid: testId, literature: row.literature,
          })));
     }
     const fields = plan.selected.filter(field => plan.rows.some(row => row.id === Number(field.id) && row.status === 'add'));
     const copied = [];
     const [[last]] = await db.raw('SELECT MAX(ordering) AS ordering FROM testcreationrules WHERE testid = ?', [testId]);
     let ordering = Number(last?.ordering ?? 0);
     const groups = new Map(plan.destinationCategories.map(row => [label(row.categoryname), Number(row.categoryid)]));
     for (const field of fields) {
          const category = plan.sourceCategories.find(row => row.categoryid === field.categoryid);
          let categoryId: number | null = null;
          if (category) {
               const key = label(category.categoryname);
               categoryId = groups.get(key) ?? null;
               if (categoryId === null) {
                    [categoryId] = await db('testdetailcategory').insert({ testid: testId, categoryname: category.categoryname, createdby: 'Platform administrator' });
                    groups.set(key, categoryId);
               }
          }
          const [id] = await db('testcreationrules').insert({
               ...pick(field, RULE_COLUMNS), testid: testId, categoryid: categoryId, ordering: ++ordering,
          });
          const constraints = plan.sourceConstraints.filter(rule => rule.fieldid === field.id);
          if (constraints.length) await db('field_constraints').insert(constraints.map(rule => ({
               ...pick(rule, CONSTRAINT_COLUMNS), testid: testId, fieldid: id,
          })));
          copied.push({ sourceFieldId: Number(field.id), targetFieldId: Number(id), name: field.name });
     }
     const conditions = plan.matchedConditions.filter(rule => fields.some(field => affects(field, rule)));
     const support = conditions.length ? await ensureDeveloperSupportIdentity(db) : null;
     for (const group of plan.conditionGroups) {
          const matching = conditions.filter(rule => rule.conditionId === group.id);
          if (!matching.length) continue;
          const existing = await db('testconditiondefinitions').where({ conditionName: group.conditionName }).first('id');
          const suffix = ` [copy ${testId}-${copied[0].targetFieldId}-${group.id}]`;
          const conditionName = existing ? String(group.conditionName).slice(0, 255 - suffix.length) + suffix : group.conditionName;
          const [conditionId] = await db('testconditiondefinitions').insert({ testId, conditionName, createdBy: support.employeeid });
          await db('testconditions').insert(matching.map(rule => ({
               ...pick(rule, CONDITION_COLUMNS), testId, conditionId, createdBy: String(support.employeeid),
          })));
     }
     const [auditId] = await db('test_setup_copy_audit').insert({
          source_tenant_id: input.sourceTenantId, target_tenant_id: input.targetTenantId,
          source_test_id: input.sourceTestId, target_test_id: testId, mode: input.mode,
          actor_employee_id: actor.employeeId, details: JSON.stringify(copied),
     });
     return { testId, copied, auditId };
}

async function ensureAudit(db: Knex) {
     if (await db.schema.hasTable('test_setup_copy_audit')) return;
     try {
          await db.schema.createTable('test_setup_copy_audit', table => {
               table.bigIncrements('id');
               for (const column of ['source_tenant_id','target_tenant_id','source_test_id','target_test_id','actor_employee_id']) {
                    table.integer(column).unsigned().notNullable();
               }
               table.string('mode', 20).notNullable();
               table.text('details', 'longtext').notNullable();
               table.timestamp('created_at').notNullable().defaultTo(db.fn.now());
          });
     } catch (error: any) { if (error.code !== 'ER_TABLE_EXISTS_ERROR') throw error; }
}

export class FacilityTestSetupCopy {
     async panels(tenant: number, search: unknown) {
          const db = await tenantDb(tenant);
          const query = db('test_panels').select('id', 'name').orderBy('name').orderBy('id').limit(40);
          if (typeof search === 'string' && search.trim()) query.where('name', 'like', '%' + search.trim().slice(0, 100) + '%');
          return query;
     }

     async parameters(tenant: number, testId: number) {
          const db = await tenantDb(tenant);
          return db('testcreationrules').where({ testid: testId }).select('id', 'name', 'units').orderBy('ordering').orderBy('id');
     }

     async preview(value: unknown) {
          const input = readInput(value);
          const [source, destination] = await Promise.all([tenantDb(input.sourceTenantId), tenantDb(input.targetTenantId)]);
          const plan = await source.transaction(trx => inspect(trx, destination, input), { readOnly: true });
          return { sourceName: plan.sourcePanel.name, destinationName: plan.destinationPanel?.name ?? null,
               parameters: plan.rows, blockers: plan.blockers, warnings: plan.warnings, previewId: plan.fingerprint };
     }

     async apply(value: unknown, previewId: unknown, actor: FacilityActor) {
          const input = readInput(value);
          if (typeof previewId !== 'string' || !/^[a-f0-9]{64}$/.test(previewId)) throw new FacilityError('Preview the copy before applying it', 400);
          const [source, destination] = await Promise.all([tenantDb(input.sourceTenantId), tenantDb(input.targetTenantId)]);
          await ensureAudit(destination);
          await ensureSupportColumn(destination);
          if (input.mode === 'panel' && !await destination.schema.hasColumn('test_panels', 'copy_requires_publication')) {
               try {
                    await destination.schema.alterTable('test_panels', table => table.boolean('copy_requires_publication').notNullable().defaultTo(false));
               } catch (error: any) { if (error.code !== 'ER_DUP_FIELDNAME') throw error; }
          }
          const result = await source.transaction(sourceTrx => destination.transaction(async trx => {
               const plan = await inspect(sourceTrx, trx, input, true);
               if (plan.fingerprint !== previewId) throw new FacilityError('The panels changed. Refresh the preview before applying.', 409);
               if (plan.blockers.length || !plan.rows.some(row => row.status === 'add')) throw new FacilityError('There are no changes that can be applied from this preview.', 409);
               return copyRows(trx, input, plan, actor);
          }), { readOnly: true });
          await testPanelCache.invalidate(input.targetTenantId).catch(() => undefined);
          return result;
     }
}
