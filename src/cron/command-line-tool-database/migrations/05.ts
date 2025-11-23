import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     // Create privateinsurance table
     if (!(await knex.schema.hasTable('privateinsurance'))) {
          await knex.schema.createTable('privateinsurance', (table) => {
               table.increments('id').primary().unsigned();
               table.string('insuranceName', 255).notNullable();
               table.string('insuranceCode', 50).notNullable();
               table.string('insuranceType', 100).nullable();
               table.string('searchCode', 50).nullable();
               table.string('network', 100).nullable();
               table.string('tags', 255).nullable();
               table.string('mailingAddress', 255).nullable();
               table.string('city', 100).nullable();
               table.string('state', 100).nullable();
               table.string('county', 100).nullable();
               table.string('zipCode', 20).nullable();
               table.text('comments').nullable();
               table.tinyint('isDisabled').notNullable().defaultTo(0);
          });
     }

     // Create billing table
     if (!(await knex.schema.hasTable('billing'))) {
          await knex.schema.createTable('billing', (table) => {
               table.increments('billingid').primary().unsigned();
               table.integer('patientid').notNullable();
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
               table.integer('branchid', 20).notNullable();
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

               table.index('billingid');
               table.index('patientid');
               table.index(['year', 'month']);
               table.index('billedon');
               table.index('status');
          });
     }

     // Create billinghx table
     if (!(await knex.schema.hasTable('billinghx'))) {
          await knex.schema.createTable('billinghx', (table) => {
               table.increments('KeyID').primary().unsigned();
               table.integer('Billingid').unsigned().notNullable().unsigned();
               table.datetime('Date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('PaymentMode').notNullable();
               table.decimal('Amount', 10, 2).notNullable().defaultTo(0.00);
               table.integer('employeeid').notNullable();
               table.enum('type', ['debit', 'credit']).notNullable();
               table.foreign('Billingid').references('billingid').inTable('billing').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create billingstrategy table
     if (!(await knex.schema.hasTable('billingstrategy'))) {
          await knex.schema.createTable('billingstrategy', (table) => {
               table.increments('strategyid').primary().unsigned();
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
     }

     // Create billingstrategy_mapping table
     if (!(await knex.schema.hasTable('billingstrategy_mapping'))) {
          await knex.schema.createTable('billingstrategy_mapping', (table) => {
               table.integer('strategyid').unsigned().notNullable();
               table.enum('entity_type', ['clinician', 'insurance', 'organization', 'general']).notNullable();
               table.integer('entity_id').notNullable();
               table.primary(['strategyid', 'entity_type', 'entity_id']);
               table.index(['entity_type', 'entity_id'], null, 'unique');
               table.foreign('strategyid').references('strategyid').inTable('billingstrategy').onDelete('CASCADE');
          });
     }

     // Create billingstrategy_tests table
     if (!(await knex.schema.hasTable('billingstrategy_tests'))) {
          await knex.schema.createTable('billingstrategy_tests', (table) => {
               table.integer('strategyid').unsigned().notNullable();
               table.integer('testid').notNullable().unsigned();
               table.decimal('concessionValue', 6, 2).notNullable();
               table.decimal('discountedValue', 6, 2).notNullable();
               table.enum('concessionMode', ['absolute', 'percentage']).notNullable();
               table.enum('pricingType', ['discount', 'surcharge']).notNullable();
               table.primary(['strategyid', 'testid']);
               table.index('testid');
               table.foreign('strategyid').references('strategyid').inTable('billingstrategy').onDelete('CASCADE');
               table.foreign('testid').references('prim_key').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create billing_audit table
     if (!(await knex.schema.hasTable('billing_audit'))) {
          await knex.schema.createTable('billing_audit', (table) => {
               table.bigIncrements('audit_id').primary();
               table.integer('billingid').nullable().unsigned();
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

               table.foreign('billingid').references('billingid').inTable('billing').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create dboexpensecategory table
     if (!(await knex.schema.hasTable('dboexpensecategory'))) {
          await knex.schema.createTable('dboexpensecategory', (table) => {
               table.increments('id').primary();
               table.string('category', 100).notNullable();
               table.timestamp('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.timestamp('updatedon', { precision: 6 }).nullable();
               table.integer('employeeid', 10).notNullable();
          });
     }

     // Create dbogeneraltesteditcount table
     if (!(await knex.schema.hasTable('dbogeneraltesteditcount'))) {
          await knex.schema.createTable('dbogeneraltesteditcount', (table) => {
               table.increments('id').primary();
               table.integer('ascensionid', 10).notNullable();
               table.integer('billingid', 10).notNullable();
               table.integer('counter', 10).notNullable();
               table.timestamp('updatedon', { precision: 6 }).notNullable();
          });
     }

     // Create dboservices table
     if (!(await knex.schema.hasTable('dboservices'))) {
          await knex.schema.createTable('dboservices', (table) => {
               table.increments('serviceid').primary().unsigned();
               table.integer('billingid').notNullable().unsigned();
               table.integer('trackId', 10).notNullable();
               table.decimal('cost', 10, 2).notNullable();
               table.integer('employeeid', 10).notNullable();
               table.enum('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']).notNullable();
               table.integer('categoryTrackId', 10).notNullable();
               table.integer('clinicianId').nullable().unsigned();
               table.integer('organizationId').nullable().unsigned();
               table.enum('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']).nullable();
               table.integer('branchid').notNullable().unsigned();
               table.tinyint('isoutsourced').notNullable().defaultTo(0);
               table.integer('outsourceid').nullable().unsigned();
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
               table.integer('insuranceid').nullable().unsigned();
               table.string('claimCode', 30).nullable();
               table.tinyint('hasNightAdjustment').notNullable().defaultTo(0);
               table.decimal('nightAdjustmentValue', 6, 2).notNullable().defaultTo(0.00);
               table.enum('nightAdjustmentMode', ['absolute', 'percentage', 'none']).notNullable().defaultTo('none');
               table.tinyint('isPackageUsed').notNullable().defaultTo(0);
               table.integer('packageid', 10).nullable().unsigned();
               table.enum('status', ['active', 'cancelled', 'refunded', 'written-off', 'voided']).notNullable().defaultTo('active');
               table.tinyint('isRefunded').notNullable().defaultTo(0);
               table.tinyint('isLocked').notNullable();
               table.tinyint('isAdjustment').notNullable();
               table.tinyint('isCorrected').nullable();
               table.integer('relatedbillingid', 11).nullable();
               table.decimal('paidamount', 10, 2).defaultTo(0.00);
               table.enum('paymentstatus', ['partial', 'pending', 'paid']).defaultTo('pending');

               table.index("billingid");
               table.index(['billingid', 'trackId'], null, 'unique');
               table.index('serviceAddedOn');
               table.foreign('branchid').references('branchid').inTable('branch').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('billingid').references('billingid').inTable('billing').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('clinicianId').references('id').inTable('clinicianbasicinfo').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('organizationId').references('id').inTable('organization').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('insuranceid').references('id').inTable('privateinsurance').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('packageid').references('id').inTable('packages').onDelete('RESTRICT').onUpdate('CASCADE');
          });
     }

     // Create dboservices_audit table
     if (!(await knex.schema.hasTable('dboservices_audit'))) {
          await knex.schema.createTable('dboservices_audit', (table) => {
               table.increments('audit_id').primary().unsigned();
               table.integer('serviceid').nullable().unsigned();
               table.integer('billingid').nullable().unsigned();
               table.integer('trackId', 11).nullable();
               table.decimal('cost', 10, 2).nullable();
               table.integer('employeeid', 11).nullable();
               table.enum('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']).notNullable();
               table.integer('categoryTrackId', 11).nullable();
               table.integer('clinicianId').nullable().unsigned();
               table.integer('organizationId').nullable().unsigned();
               table.enum('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']).nullable();
               table.integer('branchid').nullable().unsigned();
               table.tinyint('isoutsourced').nullable().defaultTo(0);
               table.integer('outsourceid').nullable().unsigned();
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
               table.integer('insuranceid').nullable().unsigned();
               table.string('claimCode', 30).nullable();
               table.tinyint('hasNightAdjustment').nullable();
               table.decimal('nightAdjustmentValue', 6, 2).nullable();
               table.enum('nightAdjustmentMode', ['absolute', 'percentage', 'none']).nullable();
               table.tinyint('isPackageUsed').nullable();
               table.integer('packageid', 11).nullable().unsigned();
               table.enum('action_type', ['INSERT', 'UPDATE', 'DELETE']).nullable();
               table.datetime('action_timestamp').defaultTo(knex.fn.now());
               table.string('actor', 100).nullable();

            
               table.foreign('billingid').references('billingid').inTable('billing').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('clinicianId').references('id').inTable('clinicianbasicinfo').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('organizationId').references('id').inTable('organization').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('outsourceid').references('outsourceid').inTable('outsourcingorganization').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('insuranceid').references('id').inTable('privateinsurance').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('packageid').references('id').inTable('packages').onDelete('RESTRICT').onUpdate('CASCADE');
               table.foreign('branchid').references('branchid').inTable('branch').onDelete('RESTRICT').onUpdate('CASCADE');
          });
     }

     // Create dbosystemsecurity table
     if (!(await knex.schema.hasTable('dbosystemsecurity'))) {
          await knex.schema.createTable('dbosystemsecurity', (table) => {
               table.increments('id').primary().unsigned();
               table.string('computerName', 100).notNullable();
               table.string('computerDrive', 100).notNullable();
               table.string('userDomain', 100).notNullable();
               table.string('systemRoot', 100).notNullable();
               table.timestamp('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.timestamp('updatedOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.string('appDir', 255).notNullable();
          });
     }

     // Create test_ascension table
     if (!(await knex.schema.hasTable('test_ascension'))) {
          await knex.schema.createTable('test_ascension', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('testid', 11).notNullable().unsigned();
               table.integer('serviceid', 11).notNullable().unsigned();
               table.integer('billingid', 20).notNullable().unsigned();
               table.integer('month', 11).notNullable().defaultTo(knex.raw('MONTH(CURDATE())'));
               table.integer('year', 11).notNullable().defaultTo(knex.raw('YEAR(CURDATE())'));
               table.datetime('ascension_date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.datetime('collectionStartDate', { precision: 6 }).nullable();
               table.datetime('collectionEndDate', { precision: 6 }).nullable();
               table.datetime('processingStartDate', { precision: 6 }).nullable();
               table.datetime('processingEndDate', { precision: 6 }).nullable();
               table.datetime('resultEntryStart', { precision: 6 }).nullable();
               table.datetime('resultEntryEnd', { precision: 6 }).nullable();
               table.integer('sampleCollectedBy', 10).notNullable();
               table.integer('sampleProcessedBy', 10).nullable();
               table.integer('resultEnteredBy', 10).nullable();

               table.primary(['id', 'month', 'year']);
               table.index('serviceid', 'billingid');
               table.index('testid');
               table.index(['testid', 'serviceid'], 'testid_2');

               table.foreign('testid').references('prim_key').inTable('test_panels').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
               table.foreign('billingid').references('billingid').inTable('billing').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create dbotestresultapproval table
     if (!(await knex.schema.hasTable('dbotestresultapproval'))) {
          await knex.schema.createTable('dbotestresultapproval', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('ascensionid', 10).notNullable().unsigned();
               table.tinyint('isapproved').notNullable().defaultTo(0);
               table.string('approvedBy', 20).nullable();
               table.integer('printCount', 10).notNullable();
               table.timestamp('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
               table.integer('maxvalidation').defaultTo(2);
               table.integer('minvalidation').defaultTo(1);

               table.index('ascensionid');
               table.foreign('ascensionid').references('id').inTable('test_ascension').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create dbovitalsigns table (depends on new_patients)
     if (!(await knex.schema.hasTable('dbovitalsigns'))) {
          await knex.schema.createTable('dbovitalsigns', (table) => {
               table.increments('vitalsignid').primary().unsigned();
               table.integer('patientid').notNullable().unsigned();
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
     }

     // Create dbobillingrefundtable
     if (!(await knex.schema.hasTable('dbobillingrefundtable'))) {
          await knex.schema.createTable('dbobillingrefundtable', (table) => {
               table.increments('refundid').primary().unsigned();
               table.integer('serviceid').unsigned().notNullable();
               table.integer('refundedBy').notNullable();
               table.integer('firstWitness');
               table.integer('secondWitness');
               table.integer('thirdWitness');
               table.text('firstWitnessPurpose');
               table.datetime('firstWitnessDate', { precision: 6 }).nullable();
               table.datetime('secondWitnessDate', { precision: 6 }).nullable();
               table.datetime('thirdWitnessDate', { precision: 6 }).nullable();
               table.integer('isRefundCompleted').defaultTo(0);
               table.tinyint('isRefundInitiated').defaultTo(0);
               table.integer('initiatedBy').nullable();
               table.text('secondWitnessPurpose').nullable();
               table.text('thirdWitnessPurpose').nullable();
               table.tinyint('isRefundApproved').defaultTo(0);
               table.tinyint('approvalDate').defaultTo(null);
               table.integer('approvedby').nullable();
               table.decimal('amountRefunded', 10, 2).defaultTo(0.00);
               table.tinyint('isRefundMatterClosed').defaultTo(0);

               table.index('serviceid');
               table.foreign('serviceid').references('serviceid').inTable('dboservices').onDelete('CASCADE').onUpdate('CASCADE');
          });
     }

     // Create organizationalbillingtable
     if (!(await knex.schema.hasTable('organizationalbillingtable'))) {
          await knex.schema.createTable('organizationalbillingtable', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('organizationid').nullable().unsigned();
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
     }

     // Create prime_billing_campaigns
     if (!(await knex.schema.hasTable('prime_billing_campaigns'))) {
          await knex.schema.createTable('prime_billing_campaigns', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 255).notNullable();
               table.text('description').nullable();
               table.datetime('start_date').notNullable();
               table.datetime('end_date').nullable();
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

               table.index('name', null, 'unique');
          });
     }

     // Create prime_billing_promo_codes
     if (!(await knex.schema.hasTable('prime_billing_promo_codes'))) {
          await knex.schema.createTable('prime_billing_promo_codes', (table) => {
               table.increments('id').primary().unsigned();
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


               table.index('code');
               table.index('campaign_id');
               // table.foreign('campaign_id').references('id').inTable('prime_billing_campaigns').onDelete('SET NULL');
          });
     }

     // Create prime_billing_strategies
     if (!(await knex.schema.hasTable('prime_billing_strategies'))) {
          await knex.schema.createTable('prime_billing_strategies', (table) => {
               table.increments('id').primary().unsigned();
               table.string('name', 255).notNullable();
               table.text('description').nullable();
               table.tinyint('is_discount').defaultTo(1);
               table.tinyint('applies_to_all_tests').defaultTo(1);
               table.integer('priority').defaultTo(0);
               table.tinyint('apply_time_based').defaultTo(0);
               table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
               table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
          });
     }

     // Create prime_billing_strategy_assignments
     if (!(await knex.schema.hasTable('prime_billing_strategy_assignments'))) {
          await knex.schema.createTable('prime_billing_strategy_assignments', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billing_strategy_id').unsigned().notNullable();
               table.enum('entity_type', ['organization', 'insurance', 'clinician', 'general']).notNullable();
               table.integer('track_id').nullable();
               table.datetime('applies_from').notNullable();
               table.datetime('applies_to').nullable();

               table.index('billing_strategy_id');
               table.index(['entity_type', 'track_id']);
               table.index(['applies_from', 'applies_to']);
               table.foreign('billing_strategy_id').references('id').inTable('prime_billing_strategies').onDelete('CASCADE');
          });
     }

     // Create prime_billing_strategy_conditions
     if (!(await knex.schema.hasTable('prime_billing_strategy_conditions'))) {
          await knex.schema.createTable('prime_billing_strategy_conditions', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billing_strategy_id').unsigned().notNullable();
               table.enum('condition_type', ['time_of_day', 'day_of_week', 'custom', 'date_time_range']).notNullable();
               table.string('condition_value', 100).nullable();
               table.enum('comparator', ['equals', 'greater_than', 'less_than']).defaultTo('equals');
               table.time('start_time').nullable();
               table.time('end_time').nullable();
               table.string('timezone', 50).defaultTo('Africa/Accra');

               table.index('billing_strategy_id');
               table.foreign('billing_strategy_id').references('id').inTable('prime_billing_strategies').onDelete('CASCADE');
          });
     }

     // Create prime_billing_strategy_prices
     if (!(await knex.schema.hasTable('prime_billing_strategy_prices'))) {
          await knex.schema.createTable('prime_billing_strategy_prices', (table) => {
               table.increments('id').primary().unsigned();
               table.integer('billing_strategy_id').unsigned().notNullable();
               table.integer('test_panel_id').nullable().unsigned();
               table.enum('price_type', ['percentage', 'flat']).notNullable();
               table.decimal('amount', 10, 2).notNullable();

               table.index('billing_strategy_id');
               table.index('test_panel_id');
               table.foreign('billing_strategy_id').references('id').inTable('prime_billing_strategies').onDelete('CASCADE');
               table.foreign('test_panel_id').references('prim_key').inTable('test_panels').onDelete('SET NULL');
          });
     }

     // Create prime_billing_audit
     if (!(await knex.schema.hasTable('prime_billing_audit'))) {
          await knex.schema.createTable('prime_billing_audit', (table) => {
               table.increments('id').primary().unsigned();
               table.enum('entity_type', ['organization', 'insurance', 'clinician', 'general']).notNullable();
               table.integer('track_id').nullable().unsigned();
               table.integer('test_panel_id').notNullable().unsigned();
               table.decimal('base_price', 10, 2).notNullable();
               table.decimal('final_price', 10, 2).notNullable();
               table.integer('strategy_id').nullable().unsigned();
               table.integer('price_id').nullable().unsigned();  
               table.integer('promo_code_id').nullable().unsigned();
               table.text('conditions_applied').nullable();
               table.timestamp('calculated_at').notNullable().defaultTo(knex.fn.now());

               table.index('calculated_at');
               table.index('strategy_id');
               table.index('price_id');
               table.index('promo_code_id');
               table.foreign('strategy_id').references('id').inTable('prime_billing_strategies').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('price_id').references('id').inTable('prime_billing_strategy_prices').onDelete('SET NULL').onUpdate('CASCADE');
               table.foreign('promo_code_id').references('id').inTable('prime_billing_promo_codes').onDelete('SET NULL').onUpdate('CASCADE');
          });
     }

     // Create test_dbobillingrefundtable
     if (!(await knex.schema.hasTable('test_dbobillingrefundtable'))) {
          await knex.schema.createTable('test_dbobillingrefundtable', (table) => {
               table.increments('refundid').primary();
               table.integer('serviceid').unsigned().notNullable();
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



}

export async function down(knex: Knex): Promise<void> {
     // Drop tables in reverse order due to foreign key constraints
     const tables = [
          'dboservices',
          'test_dbobillingrefundtable',
          'test_ascension',
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
          'dbogeneraltesteditcount',
          'dboexpensecategory',
          'dbobillingrefundtable',
          'billing_audit',
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