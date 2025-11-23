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
        table.unique(['name'], 'idx_name');
    });
    // Create billingstrategy_mapping table
    await knex.schema.createTable('billingstrategy_mapping', (table) => {
        table.integer('strategyid').notNullable();
        table.enum('entity_type', ['clinician', 'insurance', 'organization', 'general']).notNullable();
        table.integer('entity_id').notNullable();
        table.primary(['strategyid', 'entity_type', 'entity_id']);
        table.unique(['entity_type', 'entity_id']);
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
        table.unique('organizationid');
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
        table.unique('name');
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
        table.unique('code');
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
        table.foreign('serviceid').references('serviceid').inTable('test_dboservices').onDelete('CASCADE').onUpdate('CASCADE');
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
