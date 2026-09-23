import KnexConnection from '../../database/KnexConnections';
import { randomUUID } from 'crypto';

export async function bootstrapPhysicalSampleTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('physical_samples'))) {
          await connection.schema.createTable('physical_samples', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.string('sample_uid', 50).notNullable().unique('uq_physical_sample_uid');
               table.string('barcode', 100).notNullable().unique('uq_physical_sample_barcode');
               table.integer('patientid').unsigned().notNullable();
               table.integer('billingid').unsigned().notNullable();
               table.integer('sample_type_id').unsigned().nullable();
               table.string('sample_type_name', 100).nullable();
               table.integer('container_type_id').unsigned().nullable();
               table.string('container_type_name', 255).nullable();
               table.decimal('quantity', 10, 2).nullable();
               table.string('unit', 30).nullable();
               table.enum('status', ['planned', 'collection_started', 'collected', 'received', 'accepted', 'rejected', 'recollection_required']).notNullable().defaultTo('planned');
               table.enum('collection_source', ['onsite', 'external']).notNullable().defaultTo('onsite');
               table.string('external_facility', 255).nullable();
               table.datetime('collection_started_at').nullable();
               table.integer('collection_started_by').unsigned().nullable();
               table.datetime('collected_at').nullable();
               table.integer('collected_by').unsigned().nullable();
               table.datetime('received_at').nullable();
               table.integer('received_by').unsigned().nullable();
               table.datetime('accepted_at').nullable();
               table.integer('accepted_by').unsigned().nullable();
               table.datetime('rejected_at').nullable();
               table.integer('rejected_by').unsigned().nullable();
               table.text('rejection_reason').nullable();
               table.bigInteger('replaces_sample_id').unsigned().nullable();
               table.integer('legacy_ascension_id').unsigned().nullable().unique('uq_physical_sample_legacy_ascension');
               table.string('idempotency_key', 100).nullable().unique('uq_physical_sample_idempotency');
               table.text('notes').nullable();
               table.integer('version').unsigned().notNullable().defaultTo(1);
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(connection.fn.now());
               table.index(['billingid', 'status'], 'idx_physical_sample_billing_status');
               table.index(['patientid', 'created_at'], 'idx_physical_sample_patient_date');
               table.index(['sample_type_id', 'container_type_id'], 'idx_physical_sample_requirement');
          });
     }

     if (!(await connection.schema.hasColumn('physical_samples', 'collection_source'))) {
          await connection.schema.alterTable('physical_samples', (table) => {
               table.enum('collection_source', ['onsite', 'external']).notNullable().defaultTo('onsite');
          });
     }
     if (!(await connection.schema.hasColumn('physical_samples', 'external_facility'))) {
          await connection.schema.alterTable('physical_samples', (table) => {
               table.string('external_facility', 255).nullable();
          });
     }

     if (!(await connection.schema.hasTable('test_ascension_samples'))) {
          await connection.schema.createTable('test_ascension_samples', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.bigInteger('sample_id').unsigned().notNullable();
               table.integer('ascension_id').unsigned().notNullable();
               table.string('requirement_key', 100).nullable();
               table.boolean('is_required').notNullable().defaultTo(true);
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['sample_id', 'ascension_id'], 'uq_sample_ascension_link');
               table.index(['ascension_id', 'sample_id'], 'idx_ascension_sample_link');
               table.foreign('sample_id').references('id').inTable('physical_samples').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('ascension_id').references('id').inTable('test_ascension').onDelete('RESTRICT').onUpdate('CASCADE');
          });
     }

     if (!(await connection.schema.hasTable('physical_sample_events'))) {
          await connection.schema.createTable('physical_sample_events', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.bigInteger('sample_id').unsigned().notNullable();
               table.string('event_type', 40).notNullable();
               table.string('from_status', 40).nullable();
               table.string('to_status', 40).notNullable();
               table.integer('actor_employeeid').unsigned().notNullable();
               table.text('reason').nullable();
               table.integer('sample_version').unsigned().notNullable();
               table.string('idempotency_key', 100).nullable().unique('uq_physical_sample_event_idempotency');
               table.json('metadata').nullable();
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.index(['sample_id', 'created_at'], 'idx_physical_sample_event_history');
          });
     }

     if (!(await connection.schema.hasTable('physical_sample_reviews'))) {
          await connection.schema.createTable('physical_sample_reviews', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.bigInteger('sample_id').unsigned().notNullable();
               table.bigInteger('rejection_event_id').unsigned().notNullable();
               table.integer('requested_by').unsigned().notNullable();
               table.text('request_reason').nullable();
               table.enum('status', ['pending', 'usable', 'rejection_upheld']).notNullable().defaultTo('pending');
               table.integer('reviewed_by').unsigned().nullable();
               table.text('review_notes').nullable();
               table.datetime('requested_at').notNullable().defaultTo(connection.fn.now());
               table.datetime('reviewed_at').nullable();
               table.index(['sample_id', 'status'], 'idx_physical_sample_review_status');
          });
     }

     if (!(await connection.schema.hasTable('physical_sample_communications'))) {
          await connection.schema.createTable('physical_sample_communications', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.bigInteger('sample_id').unsigned().notNullable();
               table.bigInteger('sample_event_id').unsigned().notNullable();
               table.integer('patientid').unsigned().notNullable();
               table.text('message').notNullable();
               table.json('requested_channels').notNullable();
               table.integer('requested_by').unsigned().notNullable();
               table.string('preference_snapshot', 255).nullable();
               table.enum('status', ['pending', 'queued', 'partial', 'sent', 'failed', 'none']).notNullable().defaultTo('pending');
               table.string('idempotency_key', 100).notNullable().unique('uq_sample_communication_idempotency');
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.datetime('updated_at').notNullable().defaultTo(connection.fn.now());
               table.index(['sample_id', 'created_at'], 'idx_sample_communication_history');
          });
     }

     if (!(await connection.schema.hasTable('physical_sample_delivery_attempts'))) {
          await connection.schema.createTable('physical_sample_delivery_attempts', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.bigInteger('communication_id').unsigned().notNullable();
               table.enum('channel', ['sms', 'email']).notNullable();
               table.integer('attempt_number').unsigned().notNullable().defaultTo(1);
               table.enum('status', ['pending', 'queued', 'sent', 'failed']).notNullable().defaultTo('pending');
               table.string('recipient_masked', 180).nullable();
               table.bigInteger('email_queue_id').unsigned().nullable();
               table.bigInteger('sms_job_id').unsigned().nullable();
               table.bigInteger('sms_recipient_id').unsigned().nullable();
               table.string('provider_message_id', 255).nullable();
               table.text('failure_reason').nullable();
               table.datetime('attempted_at').nullable();
               table.datetime('created_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['communication_id', 'channel', 'attempt_number'], 'uq_sample_delivery_attempt');
               table.index(['status', 'channel'], 'idx_sample_delivery_status');
          });
     }

     await neutralizeDuplicateLegacySamples(connection);
     await backfillLegacyPhysicalSamples(connection);
}

async function neutralizeDuplicateLegacySamples(connection: any): Promise<void> {
     const duplicateLinks = await connection('test_ascension_samples as legacy_link')
          .join('physical_samples as legacy_sample', 'legacy_sample.id', 'legacy_link.sample_id')
          .whereNotNull('legacy_sample.legacy_ascension_id')
          .whereExists(function () {
               this.select(connection.raw('1'))
                    .from('test_ascension_samples as native_link')
                    .join('physical_samples as native_sample', 'native_sample.id', 'native_link.sample_id')
                    .whereRaw('native_link.ascension_id = legacy_link.ascension_id')
                    .whereNull('native_sample.legacy_ascension_id');
          })
          .pluck('legacy_link.id');
     if (duplicateLinks.length) {
          await connection('test_ascension_samples').whereIn('id', duplicateLinks).update({ is_required: false });
     }
}

async function backfillLegacyPhysicalSamples(connection: any): Promise<void> {
     const batchSize = 250;
     while (true) {
          const rows = await connection('test_ascension as ascension')
               .join('billing', 'billing.billingid', 'ascension.billingid')
               .join('test_panels as panel', 'panel.id', 'ascension.testid')
               .leftJoin('sampletype as sample_type', 'sample_type.id', 'panel.sample')
               .leftJoin('samplecontainer as container', 'container.id', 'panel.sample_container')
               .leftJoin('samplestatus as sample_status', 'sample_status.ascensionid', 'ascension.id')
               .leftJoin('physical_samples as sample', 'sample.legacy_ascension_id', 'ascension.id')
               .leftJoin('test_ascension_samples as existing_link', 'existing_link.ascension_id', 'ascension.id')
               .select(
                    'ascension.id as ascension_id', 'ascension.billingid', 'ascension.collectionStartDate', 'ascension.collectionEndDate', 'ascension.sampleCollectedBy',
                    'billing.patientid', 'panel.sample as sample_type_id', 'sample_type.name as sample_type_name',
                    'panel.sample_container as container_type_id', 'container.name as container_type_name', 'panel.qty_required', 'panel.unit',
                    'sample_status.approvalstatus', 'sample_status.rejectionmessage', 'sample_status.samplevalidatedon', 'sample_status.validatedby', 'sample_status.phelobotomist'
               )
               .whereNull('sample.id')
               .whereNull('existing_link.id')
               .where((builder: any) => builder.whereNotNull('ascension.collectionStartDate').orWhereNotNull('ascension.collectionEndDate'))
               .orderBy('ascension.id')
               .limit(batchSize);
          if (!rows.length) return;

          await connection.transaction(async (trx: any) => {
               const now = new Date();
               const samples = rows.map((row: any) => {
                    const uid = `LEGACY-S-${row.ascension_id}-${randomUUID().slice(0, 6).toUpperCase()}`;
                    const quantity = Number.parseFloat(String(row.qty_required || ''));
                    const rejected = Boolean(row.rejectionmessage);
                    const accepted = !rejected && Number(row.approvalstatus) === 1;
                    return {
                         sample_uid: uid,
                         barcode: uid,
                         patientid: row.patientid,
                         billingid: row.billingid,
                         sample_type_id: row.sample_type_id || null,
                         sample_type_name: row.sample_type_name || null,
                         container_type_id: row.container_type_id || null,
                         container_type_name: row.container_type_name || null,
                         quantity: Number.isFinite(quantity) ? quantity : null,
                         unit: row.unit || null,
                         status: rejected ? 'rejected' : accepted ? 'accepted' : row.collectionEndDate ? 'collected' : 'collection_started',
                         collection_started_at: row.collectionStartDate || row.collectionEndDate,
                         collection_started_by: row.sampleCollectedBy || null,
                         collected_at: row.collectionEndDate || null,
                         collected_by: row.collectionEndDate ? row.sampleCollectedBy || null : null,
                         accepted_at: accepted ? row.samplevalidatedon || row.collectionEndDate : null,
                         accepted_by: accepted ? row.validatedby || null : null,
                         rejected_at: rejected ? row.samplevalidatedon || row.collectionEndDate : null,
                         rejected_by: rejected ? row.validatedby || row.phelobotomist || null : null,
                         rejection_reason: rejected ? row.rejectionmessage : null,
                         legacy_ascension_id: row.ascension_id,
                         created_at: row.collectionStartDate || row.collectionEndDate || now,
                         updated_at: now,
                    };
               });
               await trx('physical_samples').insert(samples).onConflict('legacy_ascension_id').ignore();
               const inserted = await trx('physical_samples').select('id', 'legacy_ascension_id').whereIn('legacy_ascension_id', rows.map((row: any) => row.ascension_id));
               await trx('test_ascension_samples').insert(inserted.map((sample: any) => ({
                    sample_id: sample.id,
                    ascension_id: sample.legacy_ascension_id,
                    requirement_key: 'legacy',
                    is_required: true,
                    created_at: now,
               }))).onConflict(['sample_id', 'ascension_id']).ignore();
          });
     }
}
