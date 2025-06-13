exports.up = async function (knex) {
    await knex.schema.createTable('billing_audit', table => {
        table.bigIncrements('audit_id').primary();
        table.integer('billingid');
        table.bigInteger('patientid');
        table.decimal('totalTransactionCost', 10, 2);
        table.decimal('totalcost', 10, 2);
        table.decimal('paid', 10, 2);
        table.decimal('payable', 10, 2);
        table.decimal('totalrefunded', 6, 2);
        table.decimal('discount', 10, 2);
        table.decimal('outstanding', 10, 2);
        table.decimal('balance', 10, 2);
        table.datetime('billedon', { precision: 6 });
        table.string('clientstatus', 15);
        table.integer('year');
        table.integer('month');
        table.integer('day');
        table.decimal('amountIncurredDueTax', 6, 2);
        table.timestamp('lastupdated');
        table.enum('action_type', ['INSERT', 'UPDATE', 'DELETE']);
        table.datetime('action_timestamp').defaultTo(knex.fn.now());
        table.string('actor', 100).nullable();
    });
    // Insert trigger
    await knex.raw(`
        CREATE TRIGGER trg_billing_insert
        AFTER INSERT ON billing
        FOR EACH ROW
        BEGIN
            INSERT INTO billing_audit (
                billingid, patientid, totalTransactionCost, totalcost, paid, payable, 
                totalrefunded, discount, outstanding, balance, billedon, clientstatus, 
                year, month, day, amountIncurredDueTax, lastupdated, action_type
            ) VALUES (
                NEW.billingid, NEW.patientid, NEW.totalTransactionCost, NEW.totalcost, NEW.paid, NEW.payable,
                NEW.totalrefunded, NEW.discount, NEW.outstanding, NEW.balance, NEW.billedon, NEW.clientstatus,
                NEW.year, NEW.month, NEW.day, NEW.amountIncurredDueTax, NEW.lastupdated, 'INSERT'
            );
        END
    `);
    // Update trigger
    await knex.raw(`
        CREATE TRIGGER trg_billing_update
        AFTER UPDATE ON billing
        FOR EACH ROW
        BEGIN
            INSERT INTO billing_audit (
                billingid, patientid, totalTransactionCost, totalcost, paid, payable, 
                totalrefunded, discount, outstanding, balance, billedon, clientstatus, 
                year, month, day, amountIncurredDueTax, lastupdated, action_type
            ) VALUES (
                NEW.billingid, NEW.patientid, NEW.totalTransactionCost, NEW.totalcost, NEW.paid, NEW.payable,
                NEW.totalrefunded, NEW.discount, NEW.outstanding, NEW.balance, NEW.billedon, NEW.clientstatus,
                NEW.year, NEW.month, NEW.day, NEW.amountIncurredDueTax, NEW.lastupdated, 'UPDATE'
            );
        END
    `);
    // Delete trigger
    await knex.raw(`
        CREATE TRIGGER trg_billing_delete
        AFTER DELETE ON billing
        FOR EACH ROW
        BEGIN
            INSERT INTO billing_audit (
                billingid, patientid, totalTransactionCost, totalcost, paid, payable, 
                totalrefunded, discount, outstanding, balance, billedon, clientstatus, 
                year, month, day, amountIncurredDueTax, lastupdated, action_type
            ) VALUES (
                OLD.billingid, OLD.patientid, OLD.totalTransactionCost, OLD.totalcost, OLD.paid, OLD.payable,
                OLD.totalrefunded, OLD.discount, OLD.outstanding, OLD.balance, OLD.billedon, OLD.clientstatus,
                OLD.year, OLD.month, OLD.day, OLD.amountIncurredDueTax, OLD.lastupdated, 'DELETE'
            );
        END
    `);
    await knex.schema.createTable('dboservices_audit', table => {
        table.bigIncrements('audit_id').primary();
        table.integer('serviceid');
        table.integer('billingid');
        table.integer('trackId');
        table.decimal('cost', 10, 2);
        table.integer('employeeid');
        table.enum('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']);
        table.integer('categoryTrackId');
        table.integer('clinicianId');
        table.integer('organizationId');
        table.enum('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']);
        table.integer('branchid');
        table.boolean('isoutsourced');
        table.integer('outsourceid');
        table.datetime('serviceAddedOn', { precision: 6 });
        table.longtext('taxList').charset('utf8mb4').collate('utf8mb4_bin');
        table.decimal('taxValue', 6, 2);
        table.decimal('amountIncurredDueTax', 10, 2);
        table.boolean('taxIncluded');
        table.decimal('discount', 6, 2);
        table.decimal('totalcost', 10, 2);
        table.decimal('totalpayable', 10, 2);
        table.boolean('isNHIS');
        table.boolean('isPHIS');
        table.string('insuranceid', 30);
        table.string('claimCode', 30);
        table.boolean('hasNightAdjustment');
        table.decimal('nightAdjustmentValue', 6, 2);
        table.enum('nightAdjustmentMode', ['absolute', 'percentage', 'none']);
        table.boolean('isPackageUsed');
        table.integer('packageid');
        table.enum('action_type', ['INSERT', 'UPDATE', 'DELETE']);
        table.datetime('action_timestamp').defaultTo(knex.fn.now());
        table.string('actor', 100).nullable();
    });
    await knex.raw(`
        CREATE TRIGGER trg_dboservices_insert
        AFTER INSERT ON dboservices
        FOR EACH ROW
        BEGIN
            INSERT INTO dboservices_audit (
                serviceid, billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId,
                clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid,
                serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount,
                totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode,
                hasNightAdjustment, nightAdjustmentValue, nightAdjustmentMode,
                isPackageUsed, packageid, action_type
            ) VALUES (
                NEW.serviceid, NEW.billingid, NEW.trackId, NEW.cost, NEW.employeeid, NEW.serviceCategory, NEW.categoryTrackId,
                NEW.clinicianId, NEW.organizationId, NEW.registrationType, NEW.branchid, NEW.isoutsourced, NEW.outsourceid,
                NEW.serviceAddedOn, NEW.taxList, NEW.taxValue, NEW.amountIncurredDueTax, NEW.taxIncluded, NEW.discount,
                NEW.totalcost, NEW.totalpayable, NEW.isNHIS, NEW.isPHIS, NEW.insuranceid, NEW.claimCode,
                NEW.hasNightAdjustment, NEW.nightAdjustmentValue, NEW.nightAdjustmentMode,
                NEW.isPackageUsed, NEW.packageid, 'INSERT'
            );
        END
    `);
    await knex.raw(`
        CREATE TRIGGER trg_dboservices_update
        AFTER UPDATE ON dboservices
        FOR EACH ROW
        BEGIN
            INSERT INTO dboservices_audit (
                serviceid, billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId,
                clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid,
                serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount,
                totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode,
                hasNightAdjustment, nightAdjustmentValue, nightAdjustmentMode,
                isPackageUsed, packageid, action_type
            ) VALUES (
                NEW.serviceid, NEW.billingid, NEW.trackId, NEW.cost, NEW.employeeid, NEW.serviceCategory, NEW.categoryTrackId,
                NEW.clinicianId, NEW.organizationId, NEW.registrationType, NEW.branchid, NEW.isoutsourced, NEW.outsourceid,
                NEW.serviceAddedOn, NEW.taxList, NEW.taxValue, NEW.amountIncurredDueTax, NEW.taxIncluded, NEW.discount,
                NEW.totalcost, NEW.totalpayable, NEW.isNHIS, NEW.isPHIS, NEW.insuranceid, NEW.claimCode,
                NEW.hasNightAdjustment, NEW.nightAdjustmentValue, NEW.nightAdjustmentMode,
                NEW.isPackageUsed, NEW.packageid, 'UPDATE'
            );
        END
    `);
    await knex.raw(`
        CREATE TRIGGER trg_dboservices_delete
        AFTER DELETE ON dboservices
        FOR EACH ROW
        BEGIN
            INSERT INTO dboservices_audit (
                serviceid, billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId,
                clinicianId, organizationId, registrationType, branchid, isoutsourced, outsourceid,
                serviceAddedOn, taxList, taxValue, amountIncurredDueTax, taxIncluded, discount,
                totalcost, totalpayable, isNHIS, isPHIS, insuranceid, claimCode,
                hasNightAdjustment, nightAdjustmentValue, nightAdjustmentMode,
                isPackageUsed, packageid, action_type
            ) VALUES (
                OLD.serviceid, OLD.billingid, OLD.trackId, OLD.cost, OLD.employeeid, OLD.serviceCategory, OLD.categoryTrackId,
                OLD.clinicianId, OLD.organizationId, OLD.registrationType, OLD.branchid, OLD.isoutsourced, OLD.outsourceid,
                OLD.serviceAddedOn, OLD.taxList, OLD.taxValue, OLD.amountIncurredDueTax, OLD.taxIncluded, OLD.discount,
                OLD.totalcost, OLD.totalpayable, OLD.isNHIS, OLD.isPHIS, OLD.insuranceid, OLD.claimCode,
                OLD.hasNightAdjustment, OLD.nightAdjustmentValue, OLD.nightAdjustmentMode,
                OLD.isPackageUsed, OLD.packageid, 'DELETE'
            );
        END
    `);
    await knex.raw(`
        CREATE TABLE patient_clinical_history_ultrasound (
            id int(11) NOT NULL AUTO_INCREMENT,
            ascensionid int(10) unsigned NOT NULL,
            clinical_history text DEFAULT NULL,
            created_at timestamp NOT NULL DEFAULT current_timestamp(),
            updated_at timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
            PRIMARY KEY (id),
            KEY idx_ascensionid (ascensionid)
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
         `);
};
exports.down = async function (knex) {
    await knex.raw('DROP TRIGGER IF EXISTS trg_billing_insert');
    await knex.raw('DROP TRIGGER IF EXISTS trg_billing_update');
    await knex.raw('DROP TRIGGER IF EXISTS trg_billing_delete');
    await knex.raw('DROP TRIGGER IF EXISTS trg_dboservices_insert');
    await knex.raw('DROP TRIGGER IF EXISTS trg_dboservices_update');
    await knex.raw('DROP TRIGGER IF EXISTS trg_dboservices_delete');
    await knex.schema.dropTableIfExists('dboservices_audit');
    await knex.schema.dropTableIfExists('billing_audit');
};
