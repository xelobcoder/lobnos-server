"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // Create billing table with partitioning (simplified - Knex doesn't support partitioning directly)
    await knex.schema.createTable('billing', (table) => {
        table.increments('billingid');
        table.bigInteger('patientid').notNullable();
        table.decimal('totalTransactionCost', 10, 2).defaultTo(0.00);
        table.decimal('totalcost', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('paid', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('payable', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('totalrefunded', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('discount', 10, 2).notNullable();
        table.decimal('outstanding', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('balance', 10, 2).notNullable().defaultTo(0.00);
        table.datetime('billedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('clientstatus', 15).notNullable().defaultTo('normal');
        table.integer('year').notNullable().defaultTo(knex.raw('YEAR(CURDATE())'));
        table.integer('month').notNullable().defaultTo(knex.raw('MONTH(CURDATE())'));
        table.integer('day').defaultTo(knex.raw('DAYOFMONTH(CURDATE())'));
        table.decimal('amountIncurredDueTax', 6, 2).notNullable().defaultTo(0.00);
        table.timestamp('lastupdated').notNullable().defaultTo(knex.fn.now());
        table.integer('branchid').notNullable();
        table.tinyint('isPromo').defaultTo(0);
        table.decimal('promoValue', 10, 2).defaultTo(0.00);
        table.enum('promoMethod', ['percentage', 'flat']).nullable();
        table.integer('promoCodeId').nullable();
        table.enum('status', ['pending', 'partial', 'paid', 'corrected', 'voided', 'adjustment', 'written-off']).notNullable().defaultTo('pending');
        table.integer('relatedBillingId').nullable();
        table.tinyint('isAdjustment').defaultTo(0);
        table.integer('adjustedBy').nullable();
        table.text('adjustmentReason').nullable();
        table.enum('adjustmentType', ['addition', 'correction', 'void', 'written-off', 'referer-error']).nullable();
        table.tinyint('islocked').defaultTo(0);
        table.datetime('adjustmentdate').nullable();
        table.decimal('adjustmentamount', 10, 2).nullable();
        table.text('additionalinformation').nullable();
        table.decimal('writeoff', 10, 2).nullable();
        // Composite primary key (billingid, year, month)
        table.primary(['billingid', 'year', 'month']);
        // Indexes
        table.index('billingid');
        table.index(['billingid', 'patientid']);
        table.index(['patientid', 'year', 'month']);
        table.index(['year', 'month', 'day']);
        table.index('adjustmentType');
    });
    // Create billinghx table
    await knex.schema.createTable('billinghx', (table) => {
        table.increments('KeyID').primary();
        table.integer('Billingid').notNullable();
        table.datetime('Date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('PaymentMode').notNullable();
        table.decimal('Amount', 10, 2).notNullable().defaultTo(0.00);
        table.integer('employeeid').notNullable();
        table.enum('type', ['debit', 'credit']).notNullable().defaultTo('credit');
    });
    // Create billingstrategy table
    await knex.schema.createTable('billingstrategy', (table) => {
        table.increments('strategyid').primary();
        table.string('name', 100).notNullable();
        table.text('description').nullable();
        table.enum('concessionMode', ['absolute', 'percentage']).nullable();
        table.decimal('concessionValue', 6, 2).nullable();
        table.enum('price_type', ['discount', 'surcharge']).nullable();
        table.tinyint('allconcessionApplied').notNullable().defaultTo(0);
        table.datetime('valid_from').nullable();
        table.datetime('valid_until').nullable();
        table.tinyint('is_expired').notNullable().defaultTo(0);
        table.datetime('createdon').notNullable().defaultTo(knex.fn.now());
        table.datetime('updatedon').nullable();
        table.index(['name'], 'idx_name', 'unique');
    });
    // Create billingstrategy_mapping table
    await knex.schema.createTable('billingstrategy_mapping', (table) => {
        table.integer('strategyid').notNullable();
        table.enum('entity_type', ['clinician', 'insurance', 'organization', 'general']).notNullable();
        table.integer('entity_id').notNullable();
        table.primary(['strategyid', 'entity_type', 'entity_id']);
        table.index(['entity_type', 'entity_id'], null, 'unique');
        table.foreign('strategyid').references('strategyid').inTable('billingstrategy').onDelete('CASCADE');
    });
    // Create billingstrategy_tests table
    await knex.schema.createTable('billingstrategy_tests', (table) => {
        table.integer('strategyid').notNullable();
        table.integer('testid').notNullable();
        table.decimal('concessionValue', 6, 2).notNullable();
        table.decimal('discountedValue', 6, 2).notNullable();
        table.enum('concessionMode', ['absolute', 'percentage']).notNullable();
        table.enum('pricingType', ['discount', 'surcharge']).notNullable();
        table.primary(['strategyid', 'testid']);
        table.index('testid');
        table.foreign('strategyid').references('strategyid').inTable('billingstrategy').onDelete('CASCADE');
        table.foreign('testid').references('id').inTable('test_panels');
    });
    // Create billingtemporarytable
    await knex.schema.createTable('billingtemporarytable', (table) => {
        table.increments('orderid').primary();
        table.integer('clinicianid').notNullable();
        table.integer('organizationid').notNullable();
        table.text('data').notNullable().defaultTo('{}');
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.tinyint('processed').notNullable().defaultTo(0);
        table.bigInteger('patientid').notNullable();
    });
    // Create billing_audit table
    await knex.schema.createTable('billing_audit', (table) => {
        table.bigIncrements('audit_id').primary();
        table.integer('billingid').nullable();
        table.bigInteger('patientid').nullable();
        table.decimal('totalTransactionCost', 10, 2).nullable();
        table.decimal('totalcost', 10, 2).nullable();
        table.decimal('paid', 10, 2).nullable();
        table.decimal('payable', 10, 2).nullable();
        table.decimal('totalrefunded', 6, 2).nullable();
        table.decimal('discount', 10, 2).nullable();
        table.decimal('outstanding', 10, 2).nullable();
        table.decimal('balance', 10, 2).nullable();
        table.datetime('billedon', { precision: 6 }).nullable();
        table.string('clientstatus', 15).nullable();
        table.integer('year').nullable();
        table.integer('month').nullable();
        table.integer('day').nullable();
        table.decimal('amountIncurredDueTax', 6, 2).nullable();
        table.timestamp('lastupdated').notNullable().defaultTo(knex.fn.now());
        table.enum('action_type', ['INSERT', 'UPDATE', 'DELETE']).nullable();
        table.datetime('action_timestamp').defaultTo(knex.fn.now());
        table.string('actor', 100).nullable();
    });
    // Create dboexpensecategory table
    await knex.schema.createTable('dboexpensecategory', (table) => {
        table.increments('id').primary();
        table.string('category', 100).notNullable();
        table.timestamp('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.timestamp('updatedon', { precision: 6 }).nullable();
        table.integer('employeeid', 10).notNullable();
    });
    // Create dbogeneraltesteditcount table
    await knex.schema.createTable('dbogeneraltesteditcount', (table) => {
        table.increments('id').primary();
        table.integer('ascensionid', 10).notNullable();
        table.integer('billingid', 10).notNullable();
        table.integer('counter', 10).notNullable();
        table.timestamp('updatedon', { precision: 6 }).notNullable();
    });
    // Create dboservices table
    await knex.schema.createTable('dboservices', (table) => {
        table.increments('serviceid').primary();
        table.integer('billingid', 255).notNullable();
        table.integer('trackId', 10).notNullable();
        table.decimal('cost', 10, 2).notNullable();
        table.integer('employeeid', 10).notNullable();
        table.enum('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']).nullable();
        table.integer('categoryTrackId', 10).notNullable();
        table.integer('clinicianId', 10).nullable();
        table.integer('organizationId', 10).nullable();
        table.enum('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']).nullable();
        table.integer('branchid', 10).notNullable();
        table.tinyint('isoutsourced').notNullable().defaultTo(0);
        table.integer('outsourceid', 10).nullable();
        table.timestamp('serviceAddedOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.text('taxList').nullable();
        table.decimal('taxValue', 6, 2).notNullable().defaultTo(0.00);
        table.decimal('amountIncurredDueTax', 10, 2).notNullable().defaultTo(0.00);
        table.tinyint('taxIncluded').notNullable().defaultTo(0);
        table.decimal('discount', 6, 2).notNullable().defaultTo(0.00);
        table.decimal('totalcost', 10, 2).notNullable();
        table.decimal('totalpayable', 10, 2).notNullable().defaultTo(0.00);
        table.tinyint('isNHIS').notNullable().defaultTo(0);
        table.tinyint('isPHIS').notNullable().defaultTo(0);
        table.string('insuranceid', 30).nullable();
        table.string('claimCode', 30).nullable();
        table.tinyint('hasNightAdjustment').notNullable().defaultTo(0);
        table.decimal('nightAdjustmentValue', 6, 2).notNullable().defaultTo(0.00);
        table.enum('nightAdjustmentMode', ['absolute', 'percentage', 'none']).notNullable().defaultTo('none');
        table.tinyint('isPackageUsed').notNullable().defaultTo(0);
        table.integer('packageid', 10).nullable();
        table.enum('status', ['active', 'cancelled', 'refunded', 'written-off', 'voided']).notNullable().defaultTo('active');
        table.tinyint('isRefunded').notNullable().defaultTo(0);
        table.tinyint('isLocked').notNullable();
        table.tinyint('isAdjustment').notNullable();
        table.tinyint('isCorrected').nullable();
        table.integer('relatedbillingid', 11).nullable();
        table.decimal('paidamount', 10, 2).defaultTo(0.00);
        table.enum('paymentstatus', ['partial', 'pending', 'paid']).defaultTo('pending');
        table.index(['billingid', 'trackId'], null, 'unique');
        table.index('serviceAddedOn');
    });
    // Create dboservices_audit table
    await knex.schema.createTable('dboservices_audit', (table) => {
        table.bigIncrements('audit_id').primary();
        table.integer('serviceid', 11).nullable();
        table.integer('billingid', 11).nullable();
        table.integer('trackId', 11).nullable();
        table.decimal('cost', 10, 2).nullable();
        table.integer('employeeid', 11).nullable();
        table.enum('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']).nullable();
        table.integer('categoryTrackId', 11).nullable();
        table.integer('clinicianId', 11).nullable();
        table.integer('organizationId', 11).nullable();
        table.enum('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']).nullable();
        table.integer('branchid', 11).nullable();
        table.tinyint('isoutsourced').nullable();
        table.integer('outsourceid', 11).nullable();
        table.timestamp('serviceAddedOn', { precision: 6 }).nullable();
        table.text('taxList').nullable();
        table.decimal('taxValue', 6, 2).nullable();
        table.decimal('amountIncurredDueTax', 10, 2).nullable();
        table.tinyint('taxIncluded').nullable();
        table.decimal('discount', 6, 2).nullable();
        table.decimal('totalcost', 10, 2).nullable();
        table.decimal('totalpayable', 10, 2).nullable();
        table.tinyint('isNHIS').nullable();
        table.tinyint('isPHIS').nullable();
        table.string('insuranceid', 30).nullable();
        table.string('claimCode', 30).nullable();
        table.tinyint('hasNightAdjustment').nullable();
        table.decimal('nightAdjustmentValue', 6, 2).nullable();
        table.enum('nightAdjustmentMode', ['absolute', 'percentage', 'none']).nullable();
        table.tinyint('isPackageUsed').nullable();
        table.integer('packageid', 11).nullable();
        table.enum('action_type', ['INSERT', 'UPDATE', 'DELETE']).nullable();
        table.datetime('action_timestamp').defaultTo(knex.fn.now());
        table.string('actor', 100).nullable();
    });
    // Create dbosystemsecurity table
    await knex.schema.createTable('dbosystemsecurity', (table) => {
        table.increments('id').primary();
        table.string('computerName', 100).notNullable();
        table.string('computerDrive', 100).notNullable();
        table.string('userDomain', 100).notNullable();
        table.string('systemRoot', 100).notNullable();
        table.timestamp('createdon', { precision: 6 }).notNullable();
        table.timestamp('updatedOn', { precision: 6 }).notNullable();
        table.string('appDir', 255).notNullable();
    });
    // Create dbotestresultapproval table
    await knex.schema.createTable('dbotestresultapproval', (table) => {
        table.increments('id').primary();
        table.integer('ascensionid', 10).notNullable();
        table.tinyint('isapproved').notNullable().defaultTo(0);
        table.string('approvedBy', 20).nullable();
        table.integer('printCount', 10).notNullable();
        table.timestamp('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('maxvalidation').defaultTo(2);
        table.integer('minvalidation').defaultTo(1);
    });
    // Create dbovitalsigns table (depends on new_patients)
    await knex.schema.createTable('dbovitalsigns', (table) => {
        table.increments('vitalsignid').primary();
        table.integer('patientid', 255).notNullable();
        table.string('bp', 10).notNullable();
        table.decimal('temperature', 6, 2).notNullable();
        table.integer('pulse', 10).notNullable();
        table.integer('respiration', 10).notNullable();
        table.integer('employeeid', 10).notNullable();
        table.date('date').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.time('time').notNullable().defaultTo(knex.raw('CURRENT_TIME'));
        table.integer('spo2', 10).notNullable();
        table.integer('isConsulation', 20).nullable();
        table.integer('consultationid', 20).nullable();
        table.index('patientid');
        table.foreign('patientid').references('patientid').inTable('new_patients').onDelete('CASCADE').onUpdate('CASCADE');
    });
    // Create dbobillingrefundtable
    await knex.schema.createTable('dbobillingrefundtable', (table) => {
        table.increments('refundid').primary();
        table.integer('serviceid').notNullable();
        table.integer('refundedBy').notNullable();
        table.integer('firstWitness').notNullable();
        table.integer('secondWitness').notNullable();
        table.integer('thirdWitness').notNullable();
        table.text('firstWitnessPurpose').nullable();
        table.datetime('firstWitnessDate', { precision: 6 }).nullable();
        table.datetime('secondWitnessDate', { precision: 6 }).nullable();
        table.datetime('thirdWitnessDate', { precision: 6 }).nullable();
        table.integer('isRefundCompleted').notNullable().defaultTo(0);
        table.tinyint('isRefundInitiated').notNullable().defaultTo(0);
        table.integer('initiatedBy').nullable();
        table.text('secondWitnessPurpose').nullable();
        table.text('thirdWitnessPurpose').nullable();
        table.tinyint('isRefundApproved').notNullable().defaultTo(0);
        table.tinyint('approvalDate').notNullable().defaultTo(0);
        table.integer('approvedby').nullable();
        table.decimal('amountRefunded', 10, 2).notNullable().defaultTo(0.00);
        table.tinyint('isRefundMatterClosed').notNullable().defaultTo(0);
        table.index('serviceid');
        table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
    });
    // Create organizationalbillingtable
    await knex.schema.createTable('organizationalbillingtable', (table) => {
        table.increments('id').primary();
        table.integer('organizationid').nullable();
        table.text('testpricing').defaultTo('{}');
        table.tinyint('useCustomLetterHeadings').defaultTo(0);
        table.integer('concessionValue').nullable();
        table.enum('concessionMode', ['absolute', 'percentage', 'none']).defaultTo('none');
        table.tinyint('haveDifferentPriceList').defaultTo(0);
        table.datetime('addedon').defaultTo(knex.fn.now());
        table.datetime('updatedon').defaultTo(knex.fn.now());
        table.tinyint('hasConcessionAppliedAcross').notNullable().defaultTo(0);
        table.integer('createdby').notNullable();
        table.enum('organizationBillingType', ['prepaid', 'postpaid']).defaultTo('prepaid');
        table.index('organizationid', null, 'unique');
        table.foreign('organizationid').references('id').inTable('organization').onDelete('CASCADE').onUpdate('CASCADE');
    });
    // Create prime_billing_campaigns
    await knex.schema.createTable('prime_billing_campaigns', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.datetime('start_date').notNullable();
        table.datetime('end_date').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.index('name', null, 'unique');
    });
    // Create prime_billing_promo_codes
    await knex.schema.createTable('prime_billing_promo_codes', (table) => {
        table.increments('id').primary();
        table.string('code', 100).notNullable();
        table.text('description').nullable();
        table.integer('campaign_id').nullable();
        table.enum('discount_type', ['flat', 'percentage']).notNullable();
        table.decimal('discount_value', 10, 2).notNullable();
        table.integer('max_uses').nullable();
        table.integer('times_used').defaultTo(0);
        table.tinyint('is_active').defaultTo(1);
        table.datetime('valid_from').notNullable();
        table.datetime('valid_to').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        table.index('code', null, 'unique');
        table.index('code');
        table.index('campaign_id');
        table.foreign('campaign_id').references('id').inTable('prime_billing_campaigns').onDelete('SET NULL');
    });
    // Create prime_billing_strategies
    await knex.schema.createTable('prime_billing_strategies', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.tinyint('is_discount').defaultTo(1);
        table.tinyint('applies_to_all_tests').defaultTo(1);
        table.integer('priority').defaultTo(0);
        table.tinyint('apply_time_based').defaultTo(0);
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });
    // Create prime_billing_strategy_assignments
    await knex.schema.createTable('prime_billing_strategy_assignments', (table) => {
        table.increments('id').primary();
        table.integer('billing_strategy_id').notNullable();
        table.enum('entity_type', ['organization', 'insurance', 'clinician', 'general']).notNullable();
        table.integer('track_id').nullable();
        table.datetime('applies_from').notNullable();
        table.datetime('applies_to').nullable();
        table.index('billing_strategy_id');
        table.index(['entity_type', 'track_id']);
        table.index(['applies_from', 'applies_to']);
        table.foreign('billing_strategy_id').references('id').inTable('prime_billing_strategies').onDelete('CASCADE');
    });
    // Create prime_billing_strategy_conditions
    await knex.schema.createTable('prime_billing_strategy_conditions', (table) => {
        table.increments('id').primary();
        table.integer('billing_strategy_id').notNullable();
        table.enum('condition_type', ['time_of_day', 'day_of_week', 'custom', 'date_time_range']).notNullable();
        table.string('condition_value', 100).nullable();
        table.enum('comparator', ['equals', 'greater_than', 'less_than']).defaultTo('equals');
        table.time('start_time').nullable();
        table.time('end_time').nullable();
        table.string('timezone', 50).defaultTo('Africa/Accra');
        table.index('billing_strategy_id');
        table.foreign('billing_strategy_id').references('id').inTable('prime_billing_strategies').onDelete('CASCADE');
    });
    // Create prime_billing_strategy_prices
    await knex.schema.createTable('prime_billing_strategy_prices', (table) => {
        table.increments('id').primary();
        table.integer('billing_strategy_id').notNullable();
        table.integer('test_panel_id').nullable();
        table.enum('price_type', ['percentage', 'flat']).notNullable();
        table.decimal('amount', 10, 2).notNullable();
        table.index('billing_strategy_id');
        table.index('test_panel_id');
        table.foreign('billing_strategy_id').references('id').inTable('prime_billing_strategies').onDelete('CASCADE');
        table.foreign('test_panel_id').references('prim_key').inTable('test_panels').onDelete('SET NULL');
    });
    // Create prime_billing_audit
    await knex.schema.createTable('prime_billing_audit', (table) => {
        table.increments('id').primary();
        table.enum('entity_type', ['organization', 'insurance', 'clinician', 'general']).notNullable();
        table.integer('track_id').nullable();
        table.integer('test_panel_id').notNullable();
        table.decimal('base_price', 10, 2).notNullable();
        table.decimal('final_price', 10, 2).notNullable();
        table.integer('strategy_id').nullable();
        table.integer('price_id').nullable();
        table.integer('promo_code_id').nullable();
        table.text('conditions_applied').nullable();
        table.timestamp('calculated_at').notNullable().defaultTo(knex.fn.now());
        table.index('calculated_at');
        table.index('strategy_id');
        table.index('price_id');
        table.index('promo_code_id');
        table.foreign('strategy_id').references('id').inTable('prime_billing_strategies').onDelete('SET NULL');
        table.foreign('price_id').references('id').inTable('prime_billing_strategy_prices').onDelete('SET NULL');
        table.foreign('promo_code_id').references('id').inTable('prime_billing_promo_codes').onDelete('SET NULL');
    });
    // Create test_dbobillingrefundtable
    await knex.schema.createTable('test_dbobillingrefundtable', (table) => {
        table.increments('refundid').primary();
        table.integer('serviceid').notNullable();
        table.integer('refundedBy').notNullable();
        table.integer('firstWitness').notNullable();
        table.integer('secondWitness').notNullable();
        table.integer('thirdWitness').notNullable();
        table.text('firstWitnessPurpose').nullable();
        table.datetime('firstWitnessDate', { precision: 6 }).nullable();
        table.datetime('secondWitnessDate', { precision: 6 }).nullable();
        table.datetime('thirdWitnessDate', { precision: 6 }).nullable();
        table.integer('isRefundCompleted').notNullable().defaultTo(0);
        table.tinyint('isRefundInitiated').notNullable().defaultTo(0);
        table.integer('initiatedBy').nullable();
        table.text('secondWitnessPurpose').nullable();
        table.text('thirdWitnessPurpose').nullable();
        table.tinyint('isRefundApproved').notNullable().defaultTo(0);
        table.tinyint('approvalDate').notNullable().defaultTo(0);
        table.integer('approvedby').nullable();
        table.decimal('amountRefunded', 10, 2).notNullable().defaultTo(0.00);
        table.index('serviceid');
        table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
    });
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order due to foreign key constraints
    const tables = [
        'test_dbobillingrefundtable',
        'prime_billing_audit',
        'prime_billing_strategy_prices',
        'prime_billing_strategy_conditions',
        'prime_billing_strategy_assignments',
        'prime_billing_strategies',
        'prime_billing_promo_codes',
        'prime_billing_campaigns',
        'organizationalbillingtable',
        'dbovitalsigns',
        'dbotestresultapproval',
        'dbosystemsecurity',
        'dboservices_audit',
        'dboservices',
        'dbogeneraltesteditcount',
        'dboexpensecategory',
        'dbobillingrefundtable',
        'billing_audit',
        'billingtemporarytable',
        'billingstrategy_tests',
        'billingstrategy_mapping',
        'billingstrategy',
        'billinghx',
        'billing'
    ];
    for (const table of tables) {
        await knex.schema.dropTableIfExists(table);
    }
}
exports.down = down;
