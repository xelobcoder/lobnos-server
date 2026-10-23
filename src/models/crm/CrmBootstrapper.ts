import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';

export async function ensureCrmSchema(db: Knex) {
     if (!await db.schema.hasTable('crm_onboarding')) await db.schema.createTable('crm_onboarding', t => {
          t.increments('id'); t.integer('lead_id').unsigned().notNullable(); t.integer('proposal_id').unsigned().notNullable();
          t.string('step', 40).notNullable(); t.integer('completed_by').unsigned().nullable(); t.datetime('completed_at').nullable();
          t.text('notes').nullable(); t.date('due_date').nullable(); t.integer('version').notNullable().defaultTo(1);
          t.unique(['lead_id', 'proposal_id', 'step']);
     });
     if (!await db.schema.hasTable('crm_ownership_history')) {
          await db.schema.createTable('crm_ownership_history', t => {
               t.increments('id'); t.string('entity_type', 20).notNullable(); t.integer('entity_id').unsigned().notNullable();
               t.integer('marketer_id').unsigned().notNullable(); t.integer('branchid').unsigned().nullable();
               t.datetime('valid_from', { precision: 3 }).notNullable(); t.datetime('valid_to', { precision: 3 }).nullable();
               t.index(['entity_type', 'entity_id', 'valid_from']); t.index(['marketer_id', 'valid_from']);
          });
     }
     if (!await db.schema.hasTable('crm_reminders')) await db.schema.createTable('crm_reminders', t => {
          t.increments('id'); t.integer('followup_id').unsigned().notNullable(); t.integer('employeeid').unsigned().notNullable();
          t.string('kind', 30).notNullable(); t.date('due_date').notNullable(); t.datetime('created_at').notNullable(); t.datetime('read_at').nullable();
          t.unique(['followup_id', 'employeeid', 'kind', 'due_date']); t.index(['employeeid', 'read_at']);
     });
     if (await db.schema.hasTable('commission_configs') && !await db.schema.hasColumn('commission_configs', 'crm_agreement_proposal_id')) await db.schema.alterTable('commission_configs', t => t.integer('crm_agreement_proposal_id').unsigned().nullable().unique('uq_crm_agreement_config'));
     if (!await db.schema.hasTable('leads')) await db.schema.createTable('leads', t => {
          t.increments('id'); t.string('firstname').notNullable(); t.string('lastname').notNullable(); t.string('middlename').nullable();
          t.string('contact_person').notNullable(); t.string('contact_email').nullable(); t.string('contact_phone', 50).notNullable();
          t.string('company_name').nullable(); t.string('industry_type', 50).notNullable(); t.string('lead_source', 50).notNullable();
          t.text('service_interest').nullable(); t.string('status', 40).notNullable(); t.string('priority', 20).notNullable(); t.string('location').notNullable();
          t.integer('assigned_to').unsigned().nullable(); t.integer('created_by').unsigned().nullable(); t.text('notes').nullable();
          t.datetime('created_at').notNullable(); t.datetime('updated_at').notNullable();
     });
     const columns: Record<string, (t: Knex.AlterTableBuilder) => void> = {
          display_name: t => t.string('display_name').nullable(), prospect_type: t => t.string('prospect_type', 24).notNullable().defaultTo('unclassified'),
          acquisition_stage: t => t.string('acquisition_stage', 32).notNullable().defaultTo('prospect'), branchid: t => t.integer('branchid').unsigned().nullable(),
          referrer_id: t => t.integer('referrer_id').unsigned().nullable(), archived_at: t => t.datetime('archived_at').nullable(),
          version: t => t.integer('version').unsigned().notNullable().defaultTo(1),
          fingerprint: t => t.string('fingerprint', 64).nullable().unique('uq_crm_prospect_fingerprint'),
     };
     for (const [name, add] of Object.entries(columns)) if (!await db.schema.hasColumn('leads', name)) await db.schema.alterTable('leads', add);
     // Phone-only prospects are valid. Null avoids treating all missing emails as one duplicate.
     const email = await db('leads').columnInfo('contact_email');
     if (!email.nullable) await db.schema.alterTable('leads', t => t.string('contact_email', 255).nullable().alter());
     if (!await db.schema.hasTable('lead_followups')) await db.schema.createTable('lead_followups', t => {
          t.increments('id'); t.integer('lead_id').unsigned().notNullable(); t.string('followup_type', 20).notNullable();
          t.date('followup_date').nullable(); t.date('next_followup_date').nullable(); t.text('notes').notNullable(); t.string('priority', 20).notNullable();
          t.string('status', 20).notNullable(); t.integer('created_by').unsigned().nullable(); t.datetime('created_at').notNullable(); t.datetime('updated_at').notNullable();
     });
     if (!await db.schema.hasColumn('lead_followups', 'assigned_to')) {
          await db.schema.alterTable('lead_followups', t => t.integer('assigned_to').unsigned().nullable());
          await db.raw('UPDATE lead_followups f LEFT JOIN leads l ON l.id = f.lead_id SET f.assigned_to = COALESCE(l.assigned_to, f.created_by) WHERE f.assigned_to IS NULL');
     }
     if (!await db.schema.hasColumn('lead_followups', 'archived_at')) await db.schema.alterTable('lead_followups', t => t.datetime('archived_at').nullable());
     if (!await db.schema.hasColumn('lead_followups', 'version')) await db.schema.alterTable('lead_followups', t => t.integer('version').unsigned().notNullable().defaultTo(1));
     if (!await db.schema.hasColumn('lead_followups', 'request_key')) await db.schema.alterTable('lead_followups', t => { t.string('request_key', 100).nullable().unique('uq_crm_followup_request'); t.string('request_hash', 64).nullable(); });
     if (!await db.schema.hasTable('crm_referrer_portfolios')) await db.schema.createTable('crm_referrer_portfolios', t => {
          t.increments('id'); t.string('entity_type', 20).notNullable(); t.integer('entity_id').unsigned().notNullable();
          t.integer('marketer_id').unsigned().notNullable(); t.integer('branchid').unsigned().nullable(); t.integer('lead_id').unsigned().nullable();
          t.datetime('updated_at').notNullable(); t.unique(['entity_type', 'entity_id']); t.index(['marketer_id', 'entity_type']);
     });
     if (!await db.schema.hasTable('crm_activities')) await db.schema.createTable('crm_activities', t => {
          t.increments('id'); t.integer('lead_id').unsigned().notNullable(); t.string('action', 40).notNullable(); t.integer('employeeid').unsigned().notNullable();
          t.text('notes').nullable(); t.json('metadata').nullable(); t.datetime('created_at').notNullable(); t.index(['lead_id', 'created_at']);
     });
     if (!await db.schema.hasTable('crm_commission_proposals')) await db.schema.createTable('crm_commission_proposals', t => {
          t.increments('id'); t.integer('lead_id').unsigned().notNullable(); t.integer('commission_config_id').unsigned().notNullable();
          t.date('effective_from').notNullable(); t.date('effective_to').nullable(); t.string('status', 20).notNullable().defaultTo('pending');
          t.integer('proposed_by').unsigned().notNullable(); t.integer('reviewed_by').unsigned().nullable(); t.text('notes').notNullable();
          t.text('review_notes').nullable(); t.integer('assignment_id').unsigned().nullable(); t.json('terms_snapshot').notNullable();
          t.datetime('created_at').notNullable(); t.datetime('reviewed_at').nullable(); t.index(['lead_id', 'status']);
     });
     if (!await db.schema.hasColumn('crm_commission_proposals', 'version')) await db.schema.alterTable('crm_commission_proposals', t => t.integer('version').notNullable().defaultTo(1));
     if (await db.schema.hasTable('roles')) {
          const [rows] = await db.raw('SHOW COLUMNS FROM ?? LIKE ?', ['roles', 'role']);
          const type = String(rows[0]?.Type || '');
          if (type.startsWith('enum(') && !type.includes("'marketer'")) await db.raw(`ALTER TABLE ?? MODIFY ?? ${type.slice(0, -1)},'marketer') ${rows[0].Null === 'YES' ? 'NULL' : 'NOT NULL'}${rows[0].Default != null ? ' DEFAULT ?' : ''}`, ['roles', 'role', ...(rows[0].Default != null ? [rows[0].Default] : [])]);
     }
     // Ownership before rollout is unknown: never manufacture historical marketer credit.
     await db.raw(`INSERT INTO crm_ownership_history (entity_type, entity_id, marketer_id, branchid, valid_from)
          SELECT p.entity_type, p.entity_id, p.marketer_id, p.branchid, NOW(3) FROM crm_referrer_portfolios p
          WHERE NOT EXISTS (SELECT 1 FROM crm_ownership_history h WHERE h.entity_type = p.entity_type AND h.entity_id = p.entity_id)`);
     await db('leads').where('acquisition_stage', 'active').update({ acquisition_stage: 'acquired' });
}
export async function bootstrapCrm(tenantId: number) { await ensureCrmSchema(await KnexConnection(tenantId)); }
