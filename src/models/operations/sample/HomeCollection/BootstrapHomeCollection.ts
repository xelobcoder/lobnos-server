import KnexConnection from '../../../../database/KnexConnections';


export async function bootstrapHomeCollectionTables(tenantId: number) {
     const connection = await KnexConnection(tenantId);


     const hasHomeCollectionAreas = await connection.schema.hasTable('home_collection_areas');

     if (!hasHomeCollectionAreas) {
          await connection.schema.createTable('home_collection_areas', (table) => {
               table.increments('id').primary();
               table.string('area_name', 100).notNullable();
               table.decimal('collection_fee', 10, 2).notNullable();
               table.boolean('is_active').defaultTo(true);
          });
     }

     const hasHomeCollectionStaff = await connection.schema.hasTable('home_collection_staff');

     if (!hasHomeCollectionStaff) {
          await connection.schema.createTable('home_collection_staff', (table) => {
               table.increments('id').primary();
               table.integer('employeeid').unsigned().notNullable();
               table.string('vehicle_number', 50);
               table.boolean('is_available').defaultTo(true);
          });
     }

     const hasHomeCollectionOrders = await connection.schema.hasTable('home_collection_orders');

     if (!hasHomeCollectionOrders) {
          await connection.schema.createTable('home_collection_orders', (table) => {
               table.increments('id').primary();
               table.integer('patientid').unsigned().notNullable();
               table.date('appointment_date');
               table.time('appointment_time');
               table.text('address');
               table.decimal('latitude', 10, 8);
               table.decimal('longitude', 11, 8);
               table.decimal('collection_fee', 10, 2).defaultTo(0);
               table.integer('assigned_to').unsigned();
               table.enu('status', [
                    'Pending',
                    'Confirmed',
                    'Assigned',
                    'EnRoute',
                    'Collected',
                    'Received',
                    'Completed',
                    'Cancelled'
               ]).defaultTo('Pending');
               table.timestamp('created_at').defaultTo(connection.fn.now());
          });
     }

     const hasHomeCollectionChecklist = await connection.schema.hasTable('home_collection_checklist');

     if (!hasHomeCollectionChecklist) {
          await connection.schema.createTable('home_collection_checklist', (table) => {
               table.increments('id').primary();
               table.integer('home_collection_id').unsigned().notNullable();
               table.enu('checklist_stage', ['BEFORE_COLLECTION', 'DURING_COLLECTION', 'AFTER_COLLECTION']).notNullable();
               table.string('checklist_item', 255).notNullable().unique();
               table.boolean('is_completed').defaultTo(false);
               table.timestamp('completed_at').nullable();
               table.integer('completed_by').unsigned().nullable();
               table.text('remarks').nullable();
               table.timestamps(true, true);


               table.index(['home_collection_id'], 'idx_home_collection');
               table.index(['checklist_stage'], 'idx_checklist_stage');
               table.index(['completed_by'], 'idx_completed_by');
          });

     }
}



export async function bootstrapHomeCollectionSeeds(tenantId: number) {
     const connection = await KnexConnection(tenantId);
     await connection('home_collection_checklist').insert([
          {
               home_collection_id: 1,
               checklist_stage: 'BEFORE_COLLECTION',
               checklist_item: 'Patient identification verified'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'BEFORE_COLLECTION',
               checklist_item: 'Test requisition verified'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'BEFORE_COLLECTION',
               checklist_item: 'Fasting status confirmed'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'BEFORE_COLLECTION',
               checklist_item: 'Consent obtained'
          },

          {
               home_collection_id: 1,
               checklist_stage: 'DURING_COLLECTION',
               checklist_item: 'Specimen collected'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'DURING_COLLECTION',
               checklist_item: 'Tubes labeled'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'DURING_COLLECTION',
               checklist_item: 'Barcodes printed'
          },

          {
               home_collection_id: 1,
               checklist_stage: 'AFTER_COLLECTION',
               checklist_item: 'Samples packaged'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'AFTER_COLLECTION',
               checklist_item: 'Transport container verified'
          },
          {
               home_collection_id: 1,
               checklist_stage: 'AFTER_COLLECTION',
               checklist_item: 'Samples delivered to the laboratory'
          }
     ]).onConflict('checklist_item').ignore();

}