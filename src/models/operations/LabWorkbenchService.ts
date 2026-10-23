import { scopeLabWork, labAccessSettings, assertLabTestAccess } from './LabAccessPolicy';
import { createHash } from 'crypto';
import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { LAB_EFFECTIVE_DUE_SQL } from './LabDeadlines';
import { LaboratoryWorkflowService } from './LaboratoryWorkflow';
import { getDailyQcStatus } from '../creator/calculations/QCEnforcementService';
import { InventoryTransactionModel } from '../inventory/InventoryTransaction';

const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
export const supervisor = (actor: AuthUser) => roleAllowed(actor.role, ['admin', 'manager']);
export class LabWorkbenchService {
     constructor(private tenantId: number) { }

     private async orderedTest(db: any, id: number, actor: AuthUser, lock = false) {
          if (actor.branch == null && !supervisor(actor)) fail('A branch must be assigned to laboratory staff', 403);
          if (!Number.isSafeInteger(id) || id <= 0) fail('Invalid ordered test');
          let query = db('test_ascension as ta').join('billing as bill', 'bill.billingid', 'ta.billingid')
               .where('ta.id', id).select('ta.*', 'bill.branchid', 'bill.patientid');
          if (actor.branch != null) query = query.where('bill.branchid', actor.branch);
          if (lock) query = query.forUpdate();
          const row = await query.first();
          if (!row) fail('Ordered test not found in your branch', 404);
          await assertLabTestAccess(db, actor, id);
          return row;
     }

     async options(actor: AuthUser) {
          if (actor.branch == null && !supervisor(actor)) fail('A branch must be assigned to laboratory staff', 403);
          const db = await KnexConnection(this.tenantId);
          let staff = db('roles').select('employeeid', 'username', 'role', 'branch');
          if (actor.branch != null) staff = staff.where('branch', actor.branch);
          return { staff: (await staff.orderBy('username')).filter(person => roleAllowed(person.role, ['admin', 'manager', 'scientist'])), devices: await db('devices').where({ status: 'active' }).select('id', 'deviceName').orderBy('deviceName'), supervisor: supervisor(actor) };
     }

     async list(actor: AuthUser, filters: any) {
          if (actor.branch == null && !supervisor(actor)) fail('A branch must be assigned to laboratory staff', 403);
          const db = await KnexConnection(this.tenantId);
          const page = Number(filters.page || 1), count = Number(filters.count || 20);
          if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(count) || count < 1 || count > 50) fail('Invalid pagination');
          let query = db('test_ascension as ta').join('billing as bill', 'bill.billingid', 'ta.billingid')
               .join('dboservices as service', 'service.serviceid', 'ta.serviceid')
               .join('test_panels as panel', 'panel.id', 'ta.testid')
               .join('new_patients as patient', 'patient.patientid', 'bill.patientid')
               .leftJoin('lab_work_assignments as work', 'work.ascensionid', 'ta.id')
               .leftJoin('roles as owner', 'owner.employeeid', 'work.assigned_employeeid')
               .leftJoin('dbotestresultapproval as approval', 'approval.ascensionid', 'ta.id')
               .whereRaw('COALESCE(service.isDeleted, 0) = 0')
               .whereRaw("LOWER(COALESCE(service.status, 'active')) NOT IN ('voided', 'cancelled', 'refunded', 'written-off')");
          if (actor.branch != null) query = query.where('bill.branchid', actor.branch);
          if (filters.include_completed !== 'true') query = query.where(function () { this.whereNull('ta.resultEntryEnd').orWhereRaw('COALESCE(approval.isapproved, 0) <> 1'); });
          await scopeLabWork(query, db, actor, 'ta.id');
          if (filters.view === 'mine') query = query.where('work.assigned_employeeid', actor.employeeid);
          if (filters.view === 'unassigned') query = query.whereNull('work.assigned_employeeid');
          if (filters.view === 'urgent') query = query.whereIn('work.priority', ['urgent', 'stat']);
          if (filters.view === 'overdue') query = query.whereNull('ta.resultEntryEnd').whereRaw(`${LAB_EFFECTIVE_DUE_SQL} < NOW()`);
          if (filters.search) {
               const term = `%${String(filters.search).slice(0, 100)}%`;
               query = query.where(function () { this.where('patient.fullpatientid', 'like', term).orWhere('patient.firstname', 'like', term).orWhere('patient.lastname', 'like', term).orWhere('panel.name', 'like', term); });
          }
          const total = await query.clone().count('* as total').first();
          const rows = await query.select('ta.*', 'ta.id as ascensionid', 'bill.patientid', 'bill.branchid', 'panel.name as test_name',
               'panel.lab_routine_tat_minutes', 'panel.lab_urgent_tat_minutes', 'panel.lab_stat_tat_minutes',
               'patient.fullpatientid', db.raw("CONCAT_WS(' ', patient.firstname, patient.lastname) as patient_name"),
               'work.assigned_employeeid', 'owner.username as assigned_name', 'work.device_id', 'work.due_at as deadline_override', 'work.escalated_at', 'work.acknowledged_at',
               db.raw('COALESCE(work.version, 0) as version'), db.raw("COALESCE(work.priority, 'routine') as priority"),
               db.raw(`${LAB_EFFECTIVE_DUE_SQL} as due_at`), db.raw(`CASE WHEN ta.resultEntryEnd IS NULL AND ${LAB_EFFECTIVE_DUE_SQL} < NOW() THEN 1 ELSE 0 END as overdue`),
               'approval.isapproved')
               .orderByRaw("FIELD(COALESCE(work.priority, 'routine'), 'stat', 'urgent', 'routine')")
               .orderByRaw(`${LAB_EFFECTIVE_DUE_SQL} IS NULL`).orderByRaw(`${LAB_EFFECTIVE_DUE_SQL} ASC`).orderBy('ta.id').limit(count).offset((page - 1) * count);
          const workflowRows = await new LaboratoryWorkflowService(this.tenantId).forAscensions(rows, db);
          const data = await Promise.all(workflowRows.map(async row => {
               const plan = await this.consumptionPlan(actor, Number(row.ascensionid));
               return { ...row, consumption_status: plan.status,
                    qc: await getDailyQcStatus(this.tenantId, Number(row.testid), { branchid: Number(row.branchid), deviceId: row.device_id }, db) };
          }));
          return { data, page, count, total: Number(total?.total || 0) };
     }

     async update(actor: AuthUser, id: number, input: any) {
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const test = await this.orderedTest(trx, id, actor, true);
               const previous = await trx('lab_work_assignments').where({ ascensionid: id }).first();
               const version = Number(previous?.version || 0);
               if (Number(input.version) !== version) fail('This work item changed. Refresh before saving.', 409);
               const action = input.action || 'update';
               if (!['update', 'escalate', 'acknowledge'].includes(action)) fail('Invalid work action');
               const reason = String(input.reason || '').trim();
               const values: any = { updated_at: new Date(), version: version + 1 };
               if (action !== 'update' && !reason) fail('A reason is required');
               if (action === 'escalate') Object.assign(values, { escalated_at: new Date(), acknowledged_at: null, acknowledged_by: null });
               if (action === 'acknowledge') {
                    if (!previous?.escalated_at) fail('This work item has no escalation to acknowledge');
                    if (!supervisor(actor) && Number(previous.assigned_employeeid) !== actor.employeeid) fail('Only the assigned staff member or a supervisor may acknowledge', 403);
                    Object.assign(values, { acknowledged_at: new Date(), acknowledged_by: actor.employeeid });
               }
               if (action === 'update') {
                    const access = await labAccessSettings(trx);
                    if (!supervisor(actor) && !previous?.assigned_employeeid && !access?.allow_claim) fail('Ask a supervisor to assign this work item', 403);
                    const assignee = input.assigned_employeeid === null ? null : input.assigned_employeeid === undefined ? previous?.assigned_employeeid ?? null : Number(input.assigned_employeeid);
                    if (!supervisor(actor) && assignee !== actor.employeeid) fail('Only a supervisor may assign another staff member or unassign work', 403);
                    if (!supervisor(actor) && previous?.assigned_employeeid && Number(previous.assigned_employeeid) !== actor.employeeid) fail('This work item belongs to another staff member', 403);
                    if (assignee != null) {
                         if (!Number.isSafeInteger(assignee) || assignee <= 0) fail('Invalid assigned employee');
                         const staff = await trx('roles').where({ employeeid: assignee }).first();
                         if (!staff || !roleAllowed(staff.role, ['admin', 'manager', 'scientist']) || Number(staff.branch) !== Number(test.branchid)) fail('Assigned staff must have laboratory access in the request branch');
                    }
                    if (previous?.assigned_employeeid && Number(previous.assigned_employeeid) !== assignee && !reason) fail('A handover reason is required when reassigning work');
                    values.assigned_employeeid = assignee;
                    if (input.priority !== undefined) {
                         if (!['routine', 'urgent', 'stat'].includes(input.priority)) fail('Invalid priority');
                         if (!supervisor(actor) && input.priority !== (previous?.priority || 'routine')) fail('Supervisor access is required to change priority', 403);
                         values.priority = input.priority;
                    }
                    if (input.due_at !== undefined) {
                         if (!supervisor(actor)) fail('Supervisor access is required to change a deadline', 403);
                         if (input.due_at !== null && !Number.isFinite(new Date(input.due_at).getTime())) fail('Invalid deadline');
                         values.due_at = input.due_at === null ? null : new Date(input.due_at);
                    }
                    if (input.device_id !== undefined) {
                         if (input.device_id !== null && !(await trx('devices').where({ id: input.device_id, status: 'active' }).first())) fail('Select an active analyzer');
                         values.device_id = input.device_id || null;
                    }
               }
               if (previous) await trx('lab_work_assignments').where({ ascensionid: id }).update(values);
               else await trx('lab_work_assignments').insert({ ascensionid: id, ...values });
               await trx('lab_work_actions').insert({ ascensionid: id, action, employeeid: actor.employeeid, reason: reason || null,
                    metadata: JSON.stringify({ previous: previous || null, next: values }), created_at: new Date() });
               return { version: version + 1 };
          });
     }

     async targets(actor: AuthUser, testId: number, input: any) {
          if (!supervisor(actor)) fail('Supervisor access required', 403);
          if (!Number.isSafeInteger(testId) || testId <= 0) fail('Invalid test');
          const values: any = {};
          for (const kind of ['routine', 'urgent', 'stat']) {
               const value = input[`${kind}_minutes`];
               if (value !== null && (!Number.isSafeInteger(value) || value < 1 || value > 5256000)) fail('Targets must be positive whole minutes or empty');
               values[`lab_${kind}_tat_minutes`] = value;
          }
          const db = await KnexConnection(this.tenantId);
          if (!(await db('test_panels').where({ id: testId }).update(values))) fail('Test not found', 404);
          return values;
     }

     async history(actor: AuthUser, id: number) {
          const db = await KnexConnection(this.tenantId); await this.orderedTest(db, id, actor);
          const actions = await db('lab_work_actions as action').leftJoin('roles as staff', 'staff.employeeid', 'action.employeeid')
               .where('action.ascensionid', id).select('action.*', 'staff.username').orderBy('action.id', 'desc').limit(100);
          const approvals = await db('lab_result_approval_events as event').leftJoin('roles as staff', 'staff.employeeid', 'event.employeeid')
               .where('event.ascensionid', id).select('event.*', 'staff.username').orderBy('event.id', 'desc').limit(100);
          const attempts = await db('result_delivery_attempts as attempt').leftJoin('roles as staff', 'staff.employeeid', 'attempt.employeeid')
               .where('attempt.ascensionid', id).select('attempt.*', 'staff.username').orderBy('attempt.id', 'desc').limit(100);
          return [...actions.map(action => ({ ...action, id: `action-${action.id}` })),
               ...approvals.map(event => ({ ...event, id: `approval-${event.id}`, action: 'result_approved', reason: `Result revision ${event.revision}` })),
               ...attempts.map(attempt => ({ ...attempt, id: `delivery-${attempt.id}`, action: attempt.failure_notes ? 'delivery_failed' : 'result_delivered', reason: attempt.failure_notes || attempt.notes || attempt.delivered_mode }))]
               .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 100);
     }

     async consumptionPlan(actor: AuthUser, id: number, templateId?: number, connection?: any) {
          const db = connection || await KnexConnection(this.tenantId);
          const test = await this.orderedTest(db, id, actor);
          const templates = await db('inv_inventory_templates').where({ testId: test.testid }).select('id', 'name');
          const selected = templateId ? templates.find(t => Number(t.id) === templateId) : templates.length === 1 ? templates[0] : null;
          if (templateId && !selected) fail('Inventory template does not belong to this test');
          if (!selected) return { status: templates.length ? 'choose_template' : 'missing_template', templates, template_id: null, items: [] };
          const planned = await db('inv_inventory_template_items as template').join('inv_inventory_items as item', 'item.id', 'template.itemId')
               .where('template.template_id', selected.id).select('template.itemId as item_id', 'template.quantity as expected', 'item.name', 'item.current_stock', 'item.cost_price');
          const consumed = await db('inv_inventory_transactions').where({ ascensionid: id, transaction_type: 'consumption' }).groupBy('item_id')
               .whereRaw("COALESCE(reason, '') <> ?", ['Phlebotomy actual supply usage'])
               .select('item_id', db.raw('SUM(CAST(previous_stock AS DECIMAL(20,6)) - CAST(new_stock AS DECIMAL(20,6))) as used'));
          const totals = new Map(consumed.map(row => [String(row.item_id), Number(row.used)]));
          // A template may contain repeated item rows; sum them rather than double-recording a material.
          const itemsById = new Map<string, any>();
          for (const item of planned) {
               const previous = itemsById.get(String(item.item_id));
               itemsById.set(String(item.item_id), { ...item, expected: Number(item.expected) + Number(previous?.expected || 0), recorded: totals.get(String(item.item_id)) || 0 });
          }
          const items = [...itemsById.values()].map(item => ({ ...item, remaining: Math.max(0, item.expected - item.recorded) }));
          const status = !items.length ? 'empty_template' : items.every(item => item.remaining === 0) ? 'recorded' : items.some(item => item.recorded > 0) ? 'partial' : 'pending';
          return { status, templates, template_id: Number(selected.id), items };
     }

     async collectionSupplies(actor: AuthUser, sampleId: number, search = '') {
          const db = await KnexConnection(this.tenantId);
          const link = await db('test_ascension_samples').where({ sample_id: sampleId }).orderBy('ascension_id').first();
          if (!link) fail('Collection sample not found', 404);
          const test = await this.orderedTest(db, Number(link.ascension_id), actor);
          const sample = await db('physical_samples').where({ id: sampleId, billingid: test.billingid, patientid: test.patientid }).first();
          if (!sample) fail('Collection sample not found in your branch', 404);
          let items = db('inv_inventory_items').where('is_active', true).select('id', 'name', 'current_stock', 'consumption_unit', 'cost_price').orderBy('name').limit(100);
          if (search.trim()) items = items.where('name', 'like', `%${search.trim().slice(0, 100)}%`);
          const linkedEvents = await db('physical_sample_events').where({ sample_id: sampleId, event_type: 'supplies_recorded' }).orderBy('id', 'desc').limit(100);
          const recordIds = linkedEvents.map(event => { const meta = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata; return Number(meta?.consumption_record_id); }).filter(Number.isSafeInteger);
          const ownRecords = await db('lab_consumption_records').where({ ascensionid: test.id }).where('idempotency_key', 'like', `PHL:${sampleId}:%`).orderBy('id', 'desc').limit(100);
          const sharedRecords = recordIds.length ? await db('lab_consumption_records').whereIn('id', recordIds) : [];
          const records = [...new Map([...ownRecords, ...sharedRecords].map(record => [record.id, record])).values()].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 100);
          return { sample, ascensionid: Number(test.id), items: await items, records };
     }

     async consumeCollectionSupplies(actor: AuthUser, sampleId: number, input: any) {
          if (!Number.isSafeInteger(sampleId) || sampleId <= 0) fail('Invalid collection sample');
          const db = await KnexConnection(this.tenantId);
          const link = await db('test_ascension_samples').where({ sample_id: sampleId }).orderBy('ascension_id').first();
          if (!link) fail('Collection sample not found', 404);
          return this.consume(actor, Number(link.ascension_id), input, sampleId);
     }

     async consume(actor: AuthUser, id: number, input: any, collectionSampleId?: number) {
          const rawKey = String(input.idempotency_key || '').trim();
          const key = collectionSampleId ? `PHL:${collectionSampleId}:${rawKey}` : rawKey;
          if (!key || key.length > 100 || !Array.isArray(input.lines) || !input.lines.length) fail('Consumption lines and a retry key are required');
          if (!rawKey || input.lines.length > 50) fail('A retry key and at most 50 supply lines are required');
          if (collectionSampleId && input.lines.some(line => line.sample_ids !== undefined && !Array.isArray(line.sample_ids))) fail('Select physical containers for each supply');
          const reason = String(input.reason || '').trim();
          if (collectionSampleId && (!reason || reason.length > 1000)) fail('Enter a usage note (up to 1000 characters), including any redraw or extra supplies');
          const lines = input.lines.map(line => ({ item_id: String(line.item_id), quantity: Number(line.quantity),
               ...(collectionSampleId ? { sample_ids: [...new Set<number>((line.sample_ids || [collectionSampleId]).map(Number))].sort((a, b) => a - b) } : {}) })).sort((a, b) => a.item_id.localeCompare(b.item_id));
          if (collectionSampleId && lines.some(line => !line.sample_ids.length || line.sample_ids.length > 30 || line.sample_ids.some(id => !Number.isSafeInteger(id) || id <= 0))) fail('Select valid physical containers for each supply');
          if (collectionSampleId && !lines.some(line => line.sample_ids.includes(collectionSampleId))) fail('Include the current container on a supply line, or record usage from the other container');
          if (new Set(lines.map(line => line.item_id)).size !== lines.length || lines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0)) fail('Enter one positive actual quantity per item');
          const hash = createHash('sha256').update(JSON.stringify({ template_id: collectionSampleId ? null : input.template_id, lines, ...(collectionSampleId ? { collectionSampleId, reason } : {}) })).digest('hex');
          const legacyHash = collectionSampleId && lines.every(line => line.sample_ids.length === 1 && line.sample_ids[0] === collectionSampleId)
               ? createHash('sha256').update(JSON.stringify({ template_id: null, lines: lines.map(({ item_id, quantity }) => ({ item_id, quantity })), collectionSampleId, reason })).digest('hex') : null;
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const test = await this.orderedTest(trx, id, actor, true);
               if (collectionSampleId) {
                    const sampleIds = [...new Set<number>([collectionSampleId, ...lines.flatMap(line => line.sample_ids)])].sort((a, b) => a - b);
                    const samples = await trx('physical_samples').whereIn('id', sampleIds).where({ billingid: test.billingid, patientid: test.patientid }).orderBy('id').forUpdate();
                    const sample = samples.find(sample => Number(sample.id) === collectionSampleId);
                    const link = await trx('test_ascension_samples').where({ sample_id: collectionSampleId, ascension_id: id }).first();
                    if (!sample || !link || samples.length !== sampleIds.length) fail('Collection sample does not belong to this patient and test', 404);
                    if (samples.some(sample => !['collection_started', 'collected', 'received', 'accepted', 'rejected', 'recollection_required'].includes(sample.status))) fail('Start collection before recording supplies', 409);
               }
               const prior = await trx('lab_consumption_records').where({ ascensionid: id, idempotency_key: key }).first();
               if (prior) {
                    if (prior.request_hash !== hash && prior.request_hash !== legacyHash) fail('This retry key was used for different quantities', 409);
                    return { transactions: typeof prior.transactions === 'string' ? JSON.parse(prior.transactions) : prior.transactions, retried: true };
               }
               const service = await trx('dboservices').where({ serviceid: test.serviceid }).first();
               if (!service || Number(service.isDeleted) === 1 || ['voided', 'cancelled', 'refunded', 'written-off'].includes(String(service.status || '').toLowerCase())) fail('Materials cannot be recorded against a cancelled or unavailable service', 409);
               const stockColumn = await trx('inv_inventory_items').columnInfo('current_stock');
               const quantityColumn = await trx('inv_inventory_transactions').columnInfo('quantity');
               if ((/int/i.test(stockColumn.type) || /int/i.test(quantityColumn.type)) && lines.some(line => !Number.isSafeInteger(line.quantity))) fail('These inventory items use whole consumption units. Enter whole quantities.');
               if (!collectionSampleId && !test.processingStartDate && !test.processingEndDate && !test.resultEntryEnd) fail('Start the laboratory work before recording materials used', 409);
               const plan = collectionSampleId
                    ? { template_id: null, items: (await trx('inv_inventory_items').whereIn('id', lines.map(line => line.item_id)).where('is_active', true).select('id')).map(item => ({ item_id: item.id })) }
                    : await this.consumptionPlan(actor, id, Number(input.template_id), trx);
               if ((!collectionSampleId && !plan.template_id) || !plan.items.length) fail('Configure and select a test inventory template first', 409);
               if (lines.some(line => !plan.items.some(item => item.item_id === line.item_id))) fail(collectionSampleId ? 'A selected supply is unavailable or inactive' : 'A material is not part of the selected test template');
               const lockedItems = await trx('inv_inventory_items').whereIn('id', lines.map(line => line.item_id)).orderBy('id').forUpdate();
               if (collectionSampleId) for (const line of lines) {
                    const item = lockedItems.find(item => item.id === line.item_id);
                    if (!item || !item.is_active) fail('A selected supply is unavailable or inactive', 409);
                    if (!Number.isFinite(Number(item.current_stock)) || Number(item.current_stock) < line.quantity) fail(`Insufficient stock for ${item.name || line.item_id}`, 409);
               }
               const movements: any[] = [];
               for (const line of lines) {
                    const batches = await trx('inv_inventory_transactions').where({ item_id: line.item_id }).whereNotNull('batch_number')
                         .groupBy('batch_number').select('batch_number', trx.raw('MIN(expiry_date) as expiry_date'),
                              trx.raw('SUM(CAST(new_stock AS DECIMAL(20,6)) - CAST(previous_stock AS DECIMAL(20,6))) as available'))
                         .havingRaw('available > 0').orderByRaw('MIN(expiry_date) IS NULL').orderByRaw('MIN(expiry_date)').orderBy('batch_number');
                    let remaining = line.quantity;
                    for (const batch of batches) {
                         if (batch.expiry_date && new Date(batch.expiry_date).toISOString().slice(0, 10) < new Date().toISOString().slice(0, 10)) continue;
                         const quantity = Math.min(remaining, Number(batch.available));
                         if (quantity <= 0) continue;
                         movements.push({ item_id: line.item_id, transaction_type: 'consumption', quantity, unit_type: 'consumption',
                              batch_number: batch.batch_number, expiry_date: batch.expiry_date || undefined,
                              patientid: test.patientid, ascensionid: id, performed_by: actor.employeeid,
                              reference_id: collectionSampleId ? `PHL-${collectionSampleId}-${rawKey}`.slice(0, 100) : `LAB-${id}-${key}`.slice(0, 100), reason: collectionSampleId ? 'Phlebotomy actual supply usage' : 'Laboratory actual material usage',
                              notes: collectionSampleId ? `Physical samples ${line.sample_ids.join(', ')}: ${reason}` : undefined });
                         remaining = Number((remaining - quantity).toFixed(6));
                         if (!remaining) break;
                    }
                    if (remaining > 0) fail(`Insufficient unexpired batch stock for ${line.item_id}`, 409);
               }
               const transactions = await new InventoryTransactionModel(this.tenantId).createBulk(movements, trx);
               const [consumptionRecordId] = await trx('lab_consumption_records').insert({ ascensionid: id, idempotency_key: key, request_hash: hash, employeeid: actor.employeeid,
                    transactions: JSON.stringify(transactions), created_at: new Date() });
               if (collectionSampleId) {
                    const affectedIds = [...new Set<number>([collectionSampleId, ...lines.flatMap(line => line.sample_ids)])];
                    const affected = await trx('physical_samples').whereIn('id', affectedIds);
                    await trx('physical_sample_events').insert(affected.map(sample => ({ sample_id: sample.id, event_type: 'supplies_recorded', from_status: sample.status, to_status: sample.status,
                         actor_employeeid: actor.employeeid, reason, sample_version: sample.version || 1, metadata: JSON.stringify({ consumption_record_id: consumptionRecordId, lines: lines.filter(line => line.sample_ids.includes(Number(sample.id))), anchor_sample_id: collectionSampleId }), created_at: new Date() })));
               }
               await trx('lab_work_actions').insert({ ascensionid: id, action: collectionSampleId ? 'collection_supplies_recorded' : 'materials_recorded', employeeid: actor.employeeid,
                    reason: collectionSampleId ? reason : null, metadata: JSON.stringify({ lines, template_id: plan.template_id, sample_id: collectionSampleId || null, idempotency_key: key }), created_at: new Date() });
               return { transactions, retried: false };
          });
     }
}
