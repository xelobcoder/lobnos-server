import KnexConnection from '../../database/KnexConnections';

export async function bootstrapBillingTables(tenantId = 1): Promise<void> {
     const connection = await KnexConnection(tenantId);

     if (!(await connection.schema.hasTable('package_assignments'))) {
          await connection.schema.createTable('package_assignments', (table) => {
               table.bigIncrements('id').primary().unsigned();
               table.enum('assignment_type', ['clinician', 'organization']).notNullable();
               table.integer('clinician_id').unsigned().nullable();
               table.integer('organization_id').unsigned().nullable();
               table.integer('package_id').unsigned().notNullable();
               table.timestamp('assigned_at').notNullable().defaultTo(connection.fn.now());
               table.unique(['assignment_type', 'clinician_id', 'package_id'], 'uq_package_assignment_clinician');
               table.unique(['assignment_type', 'organization_id', 'package_id'], 'uq_package_assignment_organization');
               table.index(['package_id'], 'idx_package_assignments_package');
               table.index(['clinician_id'], 'idx_package_assignments_clinician');
               table.index(['organization_id'], 'idx_package_assignments_organization');
          });
     }

     if (await connection.schema.hasTable('clinician_packages')) {
          await connection.raw(`
               INSERT IGNORE INTO package_assignments
                    (assignment_type, clinician_id, organization_id, package_id, assigned_at)
               SELECT 'clinician', clinician_id, NULL, package_id, assigned_at
               FROM clinician_packages
          `);
     }

     if (await connection.schema.hasTable('organization_packages')) {
          await connection.raw(`
               INSERT IGNORE INTO package_assignments
                    (assignment_type, clinician_id, organization_id, package_id, assigned_at)
               SELECT 'organization', NULL, organization_id, package_id, assigned_at
               FROM organization_packages
          `);
     }

     if (await connection.schema.hasTable('clinician_packages')) {
          await connection.schema.dropTable('clinician_packages');
     }

     if (await connection.schema.hasTable('organization_packages')) {
          await connection.schema.dropTable('organization_packages');
     }


     if (!await connection.schema.hasColumn('billing', 'record_validated_and_signed_off')) {
          await connection.schema.alterTable('billing', (table) => {
               table.boolean('record_validated_and_signed_off').notNullable().defaultTo(false);

               table.integer('record_validated_and_signed_off_by').unsigned().nullable();

               table.foreign('record_validated_and_signed_off_by').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('RESTRICT');
          });
     }


     const hasTableValidatedBillingDates = await connection.schema.hasTable('validated_billing_dates');
     if (!hasTableValidatedBillingDates) {
          await connection.schema.createTable('validated_billing_dates', (table) => {
               table.integer('id').unsigned().notNullable();
               table.date('billing_date').notNullable();
               table.timestamp('validated_at').notNullable().defaultTo(connection.fn.now());
               table.integer("validated_by").unsigned().notNullable();
               table.foreign('validated_by').references('employeeid').inTable('roles').onUpdate('CASCADE').onDelete('RESTRICT');
               table.unique([
                    'billing_date'
               ], 'uq_validated_billing_dates');
          });
     }

     if (await connection.schema.hasTable('test_ascension')) {
          const timingColumns = [
               'registrationToCollection',
               'collectionDuration',
               'processingDuration',
               'resultEntryDuration',
               'turnaroundtime'
          ];
          const timingColumnsExist = await Promise.all(
               timingColumns.map((column) => connection.schema.hasColumn('test_ascension', column))
          );

          const missingTimingColumns = timingColumns.filter((_, index) => !timingColumnsExist[index]);
          if (missingTimingColumns.length > 0) {
               await connection.schema.alterTable('test_ascension', (table) => {
                    missingTimingColumns.forEach((column) => table.decimal(column, 10, 2).nullable());
               });
          }

          await connection.raw('DROP TRIGGER IF EXISTS trg_test_ascension_before_insert');
          await connection.raw('DROP TRIGGER IF EXISTS trg_test_ascension_before_update');

          await connection.raw(`
                    CREATE TRIGGER trg_test_ascension_before_insert
                    BEFORE INSERT ON test_ascension
                    FOR EACH ROW
                    BEGIN
                         IF NEW.ascension_date IS NOT NULL AND NEW.collectionStartDate IS NOT NULL THEN
                              SET NEW.registrationToCollection = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.collectionStartDate) / 60, 2);
                         ELSE
                              SET NEW.registrationToCollection = NULL;
                         END IF;

                         IF NEW.collectionStartDate IS NOT NULL AND NEW.collectionEndDate IS NOT NULL THEN
                              SET NEW.collectionDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.collectionStartDate, NEW.collectionEndDate) / 60, 2);
                         ELSE
                              SET NEW.collectionDuration = NULL;
                         END IF;

                         IF NEW.processingStartDate IS NOT NULL AND NEW.processingEndDate IS NOT NULL THEN
                              SET NEW.processingDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.processingStartDate, NEW.processingEndDate) / 60, 2);
                         ELSE
                              SET NEW.processingDuration = NULL;
                         END IF;

                         IF NEW.resultEntryStart IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.resultEntryDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.resultEntryStart, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.resultEntryDuration = NULL;
                         END IF;

                         IF NEW.ascension_date IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.turnaroundtime = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.turnaroundtime = NULL;
                         END IF;
                    END
               `);

          await connection.raw(`
                    CREATE TRIGGER trg_test_ascension_before_update
                    BEFORE UPDATE ON test_ascension
                    FOR EACH ROW
                    BEGIN
                         IF NEW.ascension_date IS NOT NULL AND NEW.collectionStartDate IS NOT NULL THEN
                              SET NEW.registrationToCollection = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.collectionStartDate) / 60, 2);
                         ELSE
                              SET NEW.registrationToCollection = NULL;
                         END IF;

                         IF NEW.collectionStartDate IS NOT NULL AND NEW.collectionEndDate IS NOT NULL THEN
                              SET NEW.collectionDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.collectionStartDate, NEW.collectionEndDate) / 60, 2);
                         ELSE
                              SET NEW.collectionDuration = NULL;
                         END IF;

                         IF NEW.processingStartDate IS NOT NULL AND NEW.processingEndDate IS NOT NULL THEN
                              SET NEW.processingDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.processingStartDate, NEW.processingEndDate) / 60, 2);
                         ELSE
                              SET NEW.processingDuration = NULL;
                         END IF;

                         IF NEW.resultEntryStart IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.resultEntryDuration = ROUND(TIMESTAMPDIFF(SECOND, NEW.resultEntryStart, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.resultEntryDuration = NULL;
                         END IF;

                         IF NEW.ascension_date IS NOT NULL AND NEW.resultEntryEnd IS NOT NULL THEN
                              SET NEW.turnaroundtime = ROUND(TIMESTAMPDIFF(SECOND, NEW.ascension_date, NEW.resultEntryEnd) / 60, 2);
                         ELSE
                              SET NEW.turnaroundtime = NULL;
                         END IF;
                    END
               `);

          await connection.raw(`
                    UPDATE test_ascension
                    SET
                         registrationToCollection = CASE
                              WHEN ascension_date IS NOT NULL AND collectionStartDate IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, ascension_date, collectionStartDate) / 60, 2)
                              ELSE NULL
                         END,
                         collectionDuration = CASE
                              WHEN collectionStartDate IS NOT NULL AND collectionEndDate IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, collectionStartDate, collectionEndDate) / 60, 2)
                              ELSE NULL
                         END,
                         processingDuration = CASE
                              WHEN processingStartDate IS NOT NULL AND processingEndDate IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, processingStartDate, processingEndDate) / 60, 2)
                              ELSE NULL
                         END,
                         resultEntryDuration = CASE
                              WHEN resultEntryStart IS NOT NULL AND resultEntryEnd IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, resultEntryStart, resultEntryEnd) / 60, 2)
                              ELSE NULL
                         END,
                         turnaroundtime = CASE
                              WHEN ascension_date IS NOT NULL AND resultEntryEnd IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, ascension_date, resultEntryEnd) / 60, 2)
                              ELSE NULL
                         END
                    WHERE NOT (
                         registrationToCollection <=> CASE
                              WHEN ascension_date IS NOT NULL AND collectionStartDate IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, ascension_date, collectionStartDate) / 60, 2)
                              ELSE NULL
                         END
                    )
                    OR NOT (
                         collectionDuration <=> CASE
                              WHEN collectionStartDate IS NOT NULL AND collectionEndDate IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, collectionStartDate, collectionEndDate) / 60, 2)
                              ELSE NULL
                         END
                    )
                    OR NOT (
                         processingDuration <=> CASE
                              WHEN processingStartDate IS NOT NULL AND processingEndDate IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, processingStartDate, processingEndDate) / 60, 2)
                              ELSE NULL
                         END
                    )
                    OR NOT (
                         resultEntryDuration <=> CASE
                              WHEN resultEntryStart IS NOT NULL AND resultEntryEnd IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, resultEntryStart, resultEntryEnd) / 60, 2)
                              ELSE NULL
                         END
                    )
                    OR NOT (
                         turnaroundtime <=> CASE
                              WHEN ascension_date IS NOT NULL AND resultEntryEnd IS NOT NULL
                              THEN ROUND(TIMESTAMPDIFF(SECOND, ascension_date, resultEntryEnd) / 60, 2)
                              ELSE NULL
                         END
                    )
               `);
     }
}
