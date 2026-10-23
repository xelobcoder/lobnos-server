import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { parseConfiguredTat } from './LabDeadlines';

export async function ensureOperationsWorkflowSchema(db: Knex): Promise<void> {
     if (await db.schema.hasTable('test_panels')) {
          const initializeTargets = !(await db.schema.hasColumn('test_panels', 'lab_routine_tat_minutes'));
          for (const column of ['lab_routine_tat_minutes', 'lab_urgent_tat_minutes', 'lab_stat_tat_minutes']) {
               if (!(await db.schema.hasColumn('test_panels', column))) await db.schema.alterTable('test_panels', t => t.integer(column).unsigned().nullable());
          }
          if (initializeTargets && await db.schema.hasTable('testdetails')) {
               for (const detail of await db('testdetails').select('testid', 'tat')) {
                    const minutes = parseConfiguredTat(detail.tat);
                    if (minutes) await db('test_panels').where({ id: detail.testid }).whereNull('lab_routine_tat_minutes').update({ lab_routine_tat_minutes: minutes });
               }
          }
     }
     if (!(await db.schema.hasTable('lab_work_assignments'))) await db.schema.createTable('lab_work_assignments', t => {
          t.integer('ascensionid').unsigned().primary();
          t.integer('assigned_employeeid').unsigned().nullable();
          t.enum('priority', ['routine', 'urgent', 'stat']).notNullable().defaultTo('routine');
          t.datetime('due_at').nullable();
          t.string('device_id', 50).nullable();
          t.integer('version').unsigned().notNullable().defaultTo(1);
          t.datetime('escalated_at').nullable();
          t.datetime('acknowledged_at').nullable();
          t.integer('acknowledged_by').unsigned().nullable();
          t.datetime('updated_at').notNullable();
          t.index(['assigned_employeeid', 'due_at']);
     });
     if (!(await db.schema.hasTable('lab_work_actions'))) await db.schema.createTable('lab_work_actions', t => {
          t.increments('id'); t.integer('ascensionid').unsigned().notNullable();
          t.string('action', 40).notNullable(); t.integer('employeeid').unsigned().notNullable();
          t.text('reason').nullable(); t.json('metadata').nullable(); t.datetime('created_at').notNullable();
          t.index(['ascensionid', 'created_at']);
     });
     if (!(await db.schema.hasTable('lab_result_approval_events'))) await db.schema.createTable('lab_result_approval_events', t => {
          t.increments('id'); t.integer('ascensionid').unsigned().notNullable();
          t.integer('revision').unsigned().notNullable(); t.integer('employeeid').unsigned().notNullable();
          t.datetime('created_at').notNullable();
          t.unique(['ascensionid', 'revision', 'employeeid'], 'uq_lab_result_revision_validator');
     });
     if (await db.schema.hasTable('dbotestresultapproval') && !(await db.schema.hasColumn('dbotestresultapproval', 'approval_revision'))) {
          await db.schema.alterTable('dbotestresultapproval', t => t.integer('approval_revision').unsigned().notNullable().defaultTo(0));
     }
     if (await db.schema.hasTable('dbotestresultapproval')) {
          if (!(await db.schema.hasColumn('dbotestresultapproval', 'requires_revalidation'))) await db.schema.alterTable('dbotestresultapproval', t => t.boolean('requires_revalidation').notNullable().defaultTo(false));
          const summary = await db('dbotestresultapproval').columnInfo('approvedBy');
          if (Number(summary.maxLength) > 0 && Number(summary.maxLength) < 2048) await db.schema.alterTable('dbotestresultapproval', t => t.string('approvedBy', 2048).nullable().alter());
     }
     if (!(await db.schema.hasTable('lab_consumption_records'))) await db.schema.createTable('lab_consumption_records', t => {
          t.increments('id'); t.integer('ascensionid').unsigned().notNullable();
          t.string('idempotency_key', 100).notNullable(); t.string('request_hash', 64).notNullable();
          t.integer('employeeid').unsigned().notNullable(); t.json('transactions').notNullable();
          t.datetime('created_at').notNullable(); t.unique(['ascensionid', 'idempotency_key'], 'uq_lab_consumption_retry');
     });
     if (!(await db.schema.hasTable('result_delivery_attempts'))) await db.schema.createTable('result_delivery_attempts', t => {
          t.increments('id'); t.integer('billingid').unsigned().notNullable(); t.integer('ascensionid').unsigned().notNullable();
          t.string('delivered_mode', 40).nullable(); t.integer('employeeid').unsigned().notNullable();
          t.text('notes').nullable(); t.text('failure_notes').nullable(); t.datetime('created_at').notNullable();
          t.index(['billingid', 'created_at']);
     });
     if (await db.schema.hasTable('qc_session_review_audit')) {
          if (!(await db.schema.hasColumn('qc_session_review_audit', 'branchid'))) await db.schema.alterTable('qc_session_review_audit', t => {
               t.integer('branchid').unsigned().nullable(); t.string('device_id', 50).nullable();
               t.index(['testid', 'branchid', 'device_id', 'working_date'], 'idx_qc_scope');
          });
          const [columns] = await db.raw('SHOW COLUMNS FROM ?? LIKE ?', ['qc_session_review_audit', 'decision']);
          if (!String(columns[0]?.Type).includes('rejected')) await db.schema.alterTable('qc_session_review_audit', t => {
               t.enum('decision', ['accepted', 'bypassed', 'rejected']).notNullable().alter();
          });
     }
     if (await db.schema.hasTable('qc_sessions') && !(await db.schema.hasColumn('qc_sessions', 'branchid'))) {
          await db.schema.alterTable('qc_sessions', t => { t.integer('branchid').unsigned().nullable(); t.string('device_id', 50).nullable(); });
     }
}

export async function bootstrapOperationsWorkflow(tenantId: number) { await ensureOperationsWorkflowSchema(await KnexConnection(tenantId)); }
