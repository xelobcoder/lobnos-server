import KnexConnection from '../../database/KnexConnections';

export async function bootstrapPrescriptionTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!await connection.schema.hasTable('prescriptions')) {
          await connection.schema.createTable('prescriptions', (table) => {
               table.string('id', 36).primary();
               table.integer('patient_id').unsigned().notNullable();
               table.integer('consultation_id').unsigned().nullable();
               table.integer('clinician_id').unsigned().notNullable();
               table.string('status', 32).notNullable().defaultTo('pending');
               table.string('notes', 1000).nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.index(['patient_id'], 'idx_prescriptions_patient');
               table.index(['status'], 'idx_prescriptions_status');
          });
     }

     if (!await connection.schema.hasTable('prescription_items')) {
          await connection.schema.createTable('prescription_items', (table) => {
               table.string('id', 36).primary();
               table.string('prescription_id', 36).notNullable();
               table.string('inventory_item_id', 64).nullable();
               table.string('drug_name_snapshot', 255).notNullable();
               table.string('dosage_instructions', 500).nullable();
               table.decimal('quantity_ordered', 14, 3).notNullable();
               table.decimal('quantity_dispensed', 14, 3).notNullable().defaultTo(0);
               table.string('status', 32).notNullable().defaultTo('pending');
               table.string('sale_id', 36).nullable();
               table.timestamp('created_at').notNullable().defaultTo(connection.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(connection.fn.now());
               table.index(['prescription_id'], 'idx_prescription_items_prescription');
          });
     }

     // Structured dosage fields for prescription ordering (dose / frequency / duration / route).
     if (!await connection.schema.hasColumn('prescription_items', 'dose')) {
          await connection.schema.alterTable('prescription_items', (table) => {
               table.string('dose', 100).nullable();
               table.string('frequency', 100).nullable();
               table.string('duration', 100).nullable();
               table.string('route', 50).nullable();
          });
     }
}
