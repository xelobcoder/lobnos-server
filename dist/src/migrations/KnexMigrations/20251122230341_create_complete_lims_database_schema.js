"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(knex) {
    // ==========================================
    // PHASE 1: Basic Reference/Lookup Tables (No Foreign Keys)
    // ==========================================
    // Basic settings and configuration tables
    await knex.schema.createTable('applicationsettings', (table) => {
        table.increments('keyid').primary();
        table.tinyint('bulkregistration').notNullable().defaultTo(0);
        table.string('fontsize', 14).notNullable().defaultTo('13px');
        table.string('textcolor', 11).notNullable().defaultTo('black');
        table.string('BackgroundColor', 50).notNullable().defaultTo('wheat');
        table.tinyint('DeactivateBilling24hrs').notNullable().defaultTo(0);
        table.tinyint('PaidBillsBeforeTransaction').notNullable().defaultTo(1);
        table.tinyint('completeFlow').notNullable().defaultTo(1);
        table.tinyint('approvalbeforeprinting').notNullable().defaultTo(1);
        table.tinyint('smsActivated').notNullable().defaultTo(0);
        table.json('smsSettings').notNullable().defaultTo('{"result":"No","registration":"Yes","sample":"No","birthday":"No"}');
        table.tinyint('emailNotification').notNullable().defaultTo(0);
        table.tinyint('includeTax').notNullable().defaultTo(0);
        table.string('patientIdPrefix', 50).nullable();
        table.string('fontFamily', 50).nullable();
        table.string('billingidPrefix', 50).nullable();
        table.json('services').nullable();
        table.json('billingsettings').nullable();
        table.integer('regioncode').notNullable();
        table.integer('districtcode').notNullable();
    });
    await knex.schema.createTable('companyprofile', (table) => {
        table.increments('ID').primary();
        table.string('NAME', 100).notNullable();
        table.string('EMAIL', 100).notNullable();
        table.string('MOTTO', 255).notNullable();
        table.string('PHONENUMBER', 13).notNullable();
        table.string('ADDRESS', 255).notNullable();
        table.string('ALTERNATIVENUMBER', 13).nullable();
        table.string('WEBSITE', 50).nullable();
        table.string('STREET', 100).notNullable();
    });
    await knex.schema.createTable('companydaystimeschedule', (table) => {
        table.string('dayOne', 50).notNullable();
    });
    // Accounting tables
    await knex.schema.createTable('accounts', (table) => {
        table.increments('id').primary();
        table.string('accountId', 255).notNullable();
        table.string('accountName', 255).notNullable();
        table.enu('type', ['asset', 'liability', 'equity', 'revenue', 'expense', 'dividends']).notNullable();
        table.tinyint('isImmutable').defaultTo(0);
        table.enu('normalBalance', ['debit', 'credit']).notNullable();
    });
    await knex.schema.createTable('generalledger', (table) => {
        table.increments('id').primary();
        table.string('transactionId', 255).notNullable();
        table.datetime('date').notNullable();
        table.text('description').nullable();
        table.integer('accountId').notNullable();
        table.integer('subAccountId').nullable();
        table.enu('type', ['debit', 'credit']).notNullable();
        table.decimal('amount', 15, 2).notNullable();
    });
    // Basic drug and category tables
    await knex.schema.createTable('drugscategory', (table) => {
        table.increments('id').primary();
        table.string('categoryName', 255).notNullable();
        table.text('description').nullable();
        table.datetime('createdOn').defaultTo(knex.fn.now());
        table.string('createdBy', 255).notNullable();
    });
    await knex.schema.createTable('drugs', (table) => {
        table.increments('id').primary();
        table.string('drug', 255).notNullable();
        table.integer('category').nullable();
        table.integer('createdby').notNullable();
        table.datetime('addedOn', { precision: 6 }).defaultTo(knex.fn.now(6));
    });
    // Districts and regions
    await knex.schema.createTable('districts', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('code', 10).notNullable();
        table.integer('regionid').nullable();
    });
    // ==========================================
    // PHASE 2: User/Employee Tables
    // ==========================================
    // Employee-related tables
    await knex.schema.createTable('hr_employeelogincredentials', (table) => {
        table.increments('credentialid').primary();
        table.integer('employeeid').notNullable();
        table.string('password', 255).notNullable();
        table.integer('pin').defaultTo(0);
        table.enu('authenticationmethod', ['password', 'sms', 'email']).defaultTo('password');
        table.enu('accountstatus', ['Active', 'Inactive', 'Locked']).defaultTo('Active');
        table.tinyint('activation').notNullable().defaultTo(0);
        table.string('refreshtoken', 255).nullable();
        table.datetime('lastlogin').nullable();
        table.tinyint('emailauthenticated').defaultTo(0);
        table.date('datecreated').defaultTo(knex.fn.now());
        table.datetime('timecreated', { precision: 6 }).defaultTo(knex.fn.now(6));
        table.datetime('updatedon', { precision: 6 }).nullable();
    });
    await knex.schema.createTable('hr_employeemergencycontacts', (table) => {
        table.increments('contactid').primary();
        table.integer('employeeid').notNullable();
        table.string('contactname', 255).notNullable();
        table.string('relationship', 100).nullable();
        table.string('contactphone', 15).nullable();
        table.string('contactemail', 200).nullable();
    });
    await knex.schema.createTable('hr_rolespermissions', (table) => {
        table.increments('roleid').primary();
        table.integer('employeeid').notNullable();
        table.string('rolename', 255).notNullable();
        table.json('permissions').defaultTo('{}');
        table.text('accessrights').nullable();
    });
    await knex.schema.createTable('hr_trainingrecords', (table) => {
        table.increments('trainingid').primary();
        table.integer('employeeid').notNullable();
        table.string('trainingname', 255).nullable();
        table.date('completiondate').nullable();
        table.date('refresherduedate').nullable();
        table.decimal('competencyscore', 5, 2).nullable();
        table.string('certificationfileurl', 255).nullable();
    });
    await knex.schema.createTable('hr_workflowassignments', (table) => {
        table.increments('assignmentid').primary();
        table.integer('employeeid').notNullable();
        table.string('workflowname', 255).nullable();
        table.string('instrumentname', 255).nullable();
        table.string('projectname', 255).nullable();
    });
    await knex.schema.createTable('hr_performancemetrics', (table) => {
        table.increments('metricid').primary();
        table.integer('employeeid').notNullable();
        table.integer('samplesprocessed').defaultTo(0);
        table.integer('errorsreported').defaultTo(0);
        table.text('qaoutcomes').nullable();
        table.date('reportdate').defaultTo(knex.fn.now());
    });
    await knex.schema.createTable('hr_auditlogs', (table) => {
        table.increments('auditid').primary();
        table.integer('employeeid').notNullable();
        table.string('action', 255).nullable();
        table.datetime('timestamp').defaultTo(knex.fn.now());
        table.string('digitalsignature', 255).nullable();
    });
    // ==========================================
    // PHASE 3: Organization/Branch Tables
    // ==========================================
    await knex.schema.createTable('branch', (table) => {
        table.increments('branchid').primary();
        table.string('name', 255).notNullable();
        table.date('date').notNullable().defaultTo(knex.fn.now());
        table.tinyint('activation').notNullable().defaultTo(0);
        table.string('address', 200).nullable();
        table.string('email', 100).nullable();
        table.integer('contact').notNullable();
        table.string('managerid', 10).notNullable();
    });
    // ==========================================
    // PHASE 4: Patient/Clinician Tables
    // ==========================================
    await knex.schema.createTable('clinicianbasicinfo', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('location', 100).nullable();
        table.string('address', 255).nullable();
        table.string('occupation', 100).nullable();
        table.integer('organization').nullable();
        table.date('updated_on').nullable();
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('phone', 10).notNullable();
        table.string('email', 100).nullable();
        table.string('identifier', 20).notNullable();
    });
    await knex.schema.createTable('clinicianpaymentinfo', (table) => {
        table.increments('id').primary();
        table.integer('clinicianid').notNullable();
        table.string('module', 100).notNullable();
        table.string('momo', 15).nullable();
        table.string('bankname', 255).nullable();
        table.string('bankbranch', 255).nullable();
        table.string('accountnumber', 30).nullable();
        table.string('accountname', 255).nullable();
        table.date('updated_on').nullable();
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('commission').nullable();
        table.string('momoname', 50).nullable();
    });
    await knex.schema.createTable('clinicianscredentials', (table) => {
        table.increments('id').primary();
        table.integer('clinicianid').notNullable();
        table.string('identifier', 20).notNullable();
        table.string('password', 100).notNullable();
        table.tinyint('isAuthenticated').notNullable().defaultTo(0);
        table.enu('authenticationMode', ['SMS', 'EMAIL']).notNullable();
        table.timestamp('authenticatedon').nullable();
        table.tinyint('ispasswordUpdated').defaultTo(0);
    });
    await knex.schema.createTable('clinician_packages', (table) => {
        table.bigIncrements('id').primary();
        table.integer('clinician_id').notNullable();
        table.integer('package_id').notNullable();
        table.timestamp('assigned_at').notNullable().defaultTo(knex.fn.now());
    });
    // ==========================================
    // PHASE 5: Test/Service Related Tables
    // ==========================================
    // Test creation and constraints
    await knex.schema.createTable('customtestcreation', (table) => {
        table.increments('id').primary();
        table.integer('testid').notNullable();
        table.json('creationrule').defaultTo('{}');
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.datetime('updatedon', { precision: 6 }).nullable();
    });
    await knex.schema.createTable('field_constraints', (table) => {
        table.increments('id').primary();
        table.integer('testid').notNullable();
        table.integer('fieldid').notNullable();
        table.enu('action', ['none', 'alert', 'ignore', 'replace', 'lock-result', 'prefix-suffix', 'prefix', 'suffix']).notNullable();
        table.enu('constraint_type', ['null', 'less', 'greater', 'match', 'notmatch', 'between', 'contains']).notNullable();
        table.text('replacement_text').nullable();
        table.string('value', 255).nullable();
        table.string('prefix', 255).nullable();
        table.string('suffix', 255).nullable();
    });
    // Device and control materials
    await knex.schema.createTable('devices', (table) => {
        table.string('id', 36).primary().defaultTo(knex.raw('uuid()'));
        table.string('deviceName', 255).notNullable();
        table.string('model', 255).notNullable();
        table.string('serialNumber', 255).notNullable();
        table.string('manufacturer', 255).notNullable();
        table.date('installationDate').notNullable();
        table.date('lastCalibrationDate').notNullable();
        table.integer('calibrationFrequency').notNullable();
        table.integer('createdby').notNullable();
        table.string('location', 255).notNullable();
        table.enu('status', ['active', 'maintenance', 'inactive']).notNullable().defaultTo('active');
        table.text('notes').nullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.integer('updatedby').notNullable();
    });
    await knex.schema.createTable('control_materials', (table) => {
        table.string('id', 36).primary().defaultTo(knex.raw('uuid()'));
        table.string('name', 255).notNullable();
        table.string('lotNumber', 255).notNullable();
        table.enu('sourceType', ['manufacturer', 'sister_lab', 'trusted_source']).notNullable();
        table.string('manufacturer', 255).nullable();
        table.string('sourceName', 255).nullable();
        table.date('expiryDate').notNullable();
        table.date('openedDate').nullable();
        table.string('storageConditions', 255).notNullable();
        table.enu('status', ['active', 'expired', 'depleted']).notNullable().defaultTo('active');
        table.text('notes').nullable();
        table.string('deviceId', 36).notNullable();
        table.integer('createdby').notNullable();
        table.integer('updatedby').notNullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.integer('testId').notNullable();
    });
    await knex.schema.createTable('control_parameters', (table) => {
        table.string('id', 36).primary().defaultTo(knex.raw('uuid()'));
        table.string('controlMaterialId', 36).notNullable();
        table.string('parameter', 255).notNullable();
        table.decimal('value', 10, 4).notNullable().checkPositive();
        table.string('unit', 50).notNullable();
        table.decimal('standardDeviation', 10, 4).nullable();
        table.decimal('warningLimit', 10, 4).nullable();
        table.decimal('actionLimit', 10, 4).nullable();
        table.text('validationNotes').nullable();
        table.integer('createdby').notNullable();
        table.integer('updatedby').notNullable();
        table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updatedAt').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    // ==========================================
    // PHASE 6: Inventory and Stock Tables
    // ==========================================
    await knex.schema.createTable('generalstocks', (table) => {
        table.increments('stockid').primary();
        table.string('name', 255).notNullable();
        table.integer('category').notNullable();
        table.string('consumptionunit', 255).notNullable();
        table.string('purchaseunit', 255).notNullable();
        table.integer('quantity').notNullable();
        table.integer('alertlevel').notNullable();
        table.string('materialcode', 255).notNullable();
        table.datetime('updatedOn', { precision: 6 }).nullable();
        table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('warehouse').nullable();
        table.integer('shelf').nullable();
    });
    await knex.schema.createTable('departments', (table) => {
        table.increments('id').primary();
        table.string('department', 100).notNullable();
        table.string('departmentManager', 100).notNullable();
        table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('employeeid').notNullable();
    });
    await knex.schema.createTable('departmentstocks', (table) => {
        table.increments('id').primary();
        table.integer('deptid').notNullable();
        table.integer('stockid').notNullable();
        table.integer('quantityAvailable').notNullable();
        table.date('date_added').notNullable().defaultTo(knex.fn.now());
        table.date('dateupdated').nullable();
        table.string('comsumptionunit', 210).notNullable();
    });
    await knex.schema.createTable('commodity', (table) => {
        table.increments('comid').primary();
        table.string('commodity', 255).notNullable();
        table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('category', 255).notNullable();
        table.string('suppliedby', 255).nullable();
    });
    // ==========================================
    // PHASE 7: Billing and Financial Tables
    // ==========================================
    await knex.schema.createTable('billingstrategy', (table) => {
        table.increments('strategyid').primary();
        table.string('name', 100).notNullable();
        table.text('description').nullable();
        table.enu('concessionMode', ['absolute', 'percentage']).nullable();
        table.decimal('concessionValue', 6, 2).nullable();
        table.enu('price_type', ['discount', 'surcharge']).nullable();
        table.tinyint('allconcessionApplied').notNullable().defaultTo(0);
        table.datetime('valid_from').nullable();
        table.datetime('valid_until').nullable();
        table.tinyint('is_expired').notNullable().defaultTo(0);
        table.datetime('createdon').notNullable().defaultTo(knex.fn.now());
        table.datetime('updatedon').nullable();
    });
    await knex.schema.createTable('billingstrategy_mapping', (table) => {
        table.increments('strategyid').primary();
        table.enu('entity_type', ['clinician', 'insurance', 'organization', 'general']).notNullable();
        table.integer('entity_id').notNullable();
    });
    await knex.schema.createTable('billingstrategy_tests', (table) => {
        table.integer('strategyid').notNullable();
        table.integer('testid').notNullable();
        table.decimal('concessionValue', 6, 2).notNullable();
        table.decimal('discountedValue', 6, 2).notNullable();
        table.enu('concessionMode', ['absolute', 'percentage']).notNullable();
        table.enu('pricingType', ['discount', 'surcharge']).notNullable();
        table.primary(['strategyid', 'testid']);
    });
    await knex.schema.createTable('billingtemporarytable', (table) => {
        table.increments('orderid').primary();
        table.integer('clinicianid').notNullable();
        table.integer('organizationid').notNullable();
        table.json('data').notNullable().defaultTo('{}');
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.tinyint('processed').notNullable().defaultTo(0);
        table.bigInteger('patientid').notNullable();
    });
    // Main billing table with partitioning
    await knex.schema.raw(`
    CREATE TABLE billing (
      billingid int(255) NOT NULL,
      patientid bigint(20) NOT NULL,
      totalTransactionCost decimal(10,2) DEFAULT 0.00,
      totalcost decimal(10,2) NOT NULL DEFAULT 0.00,
      paid decimal(10,2) NOT NULL DEFAULT 0.00,
      payable decimal(10,2) NOT NULL DEFAULT 0.00,
      totalrefunded decimal(10,2) NOT NULL DEFAULT 0.00,
      discount decimal(10,2) NOT NULL,
      outstanding decimal(10,2) NOT NULL DEFAULT 0.00,
      balance decimal(10,2) NOT NULL DEFAULT 0.00,
      billedon datetime(6) NOT NULL DEFAULT current_timestamp(6),
      clientstatus varchar(15) NOT NULL DEFAULT 'normal',
      year int(11) NOT NULL DEFAULT year(curdate()),
      month int(11) NOT NULL DEFAULT month(curdate()),
      day int(11) DEFAULT dayofmonth(curdate()),
      amountIncurredDueTax decimal(6,2) NOT NULL DEFAULT 0.00,
      lastupdated timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
      branchid int(20) NOT NULL,
      isPromo tinyint(1) DEFAULT 0,
      promoValue decimal(10,2) DEFAULT 0.00,
      promoMethod enum('percentage','flat') DEFAULT NULL,
      promoCodeId int(11) DEFAULT NULL,
      status enum('pending','partial','paid','corrected','voided','adjustment','written-off') NOT NULL DEFAULT 'pending',
      relatedBillingId int(11) DEFAULT NULL,
      isAdjustment tinyint(1) DEFAULT 0,
      adjustedBy int(10) DEFAULT NULL,
      adjustmentReason text DEFAULT NULL,
      adjustmentType enum('addition','correction','void','written-off','referer-error') DEFAULT NULL,
      islocked tinyint(1) DEFAULT 0,
      adjustmentdate datetime DEFAULT NULL,
      adjustmentamount decimal(10,2) DEFAULT NULL,
      additionalinformation text DEFAULT NULL,
      writeoff decimal(10,2) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    PARTITION BY RANGE COLUMNS(year,month)
    (
      PARTITION billing_2025_01 VALUES LESS THAN (2025,2) ENGINE=InnoDB,
      PARTITION billing_2025_02 VALUES LESS THAN (2025,3) ENGINE=InnoDB,
      PARTITION billing_2025_03 VALUES LESS THAN (2025,4) ENGINE=InnoDB,
      PARTITION billing_2025_04 VALUES LESS THAN (2025,5) ENGINE=InnoDB,
      PARTITION billing_2025_05 VALUES LESS THAN (2025,6) ENGINE=InnoDB,
      PARTITION billing_2025_06 VALUES LESS THAN (2025,7) ENGINE=InnoDB,
      PARTITION billing_2025_07 VALUES LESS THAN (2025,8) ENGINE=InnoDB,
      PARTITION billing_2025_08 VALUES LESS THAN (2025,9) ENGINE=InnoDB,
      PARTITION billing_2025_09 VALUES LESS THAN (2025,10) ENGINE=InnoDB,
      PARTITION billing_2025_10 VALUES LESS THAN (2025,11) ENGINE=InnoDB,
      PARTITION billing_2025_11 VALUES LESS THAN (2025,12) ENGINE=InnoDB,
      PARTITION billing_2025_12 VALUES LESS THAN (2026,1) ENGINE=InnoDB
    )
  `);
    await knex.schema.alterTable('billing', (table) => {
        table.primary('billingid');
    });
    await knex.schema.createTable('billinghx', (table) => {
        table.increments('KeyID').primary();
        table.integer('Billingid').notNullable();
        table.datetime('Date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('PaymentMode').notNullable();
        table.decimal('Amount', 10, 2).notNullable().defaultTo(0.00);
        table.integer('employeeid').notNullable();
        table.enu('type', ['debit', 'credit']).notNullable().defaultTo('credit');
    });
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
        table.enu('action_type', ['INSERT', 'UPDATE', 'DELETE']).nullable();
        table.datetime('action_timestamp').defaultTo(knex.fn.now());
        table.string('actor', 100).nullable();
    });
    // ==========================================
    // PHASE 8: Services and Transactions Tables
    // ==========================================
    await knex.schema.createTable('dboservices', (table) => {
        table.integer('serviceid').primary();
        table.integer('billingid').notNullable();
        table.integer('trackId').notNullable();
        table.decimal('cost', 10, 2).notNullable();
        table.integer('employeeid').notNullable();
        table.enu('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']).nullable();
        table.integer('categoryTrackId').notNullable();
        table.integer('clinicianId').nullable();
        table.integer('organizationId').nullable();
        table.enu('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']).nullable();
        table.integer('branchid').notNullable();
        table.tinyint('isoutsourced').notNullable().defaultTo(0);
        table.integer('outsourceid').nullable();
        table.datetime('serviceAddedOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.json('taxList').nullable();
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
        table.enu('nightAdjustmentMode', ['absolute', 'percentage', 'none']).notNullable().defaultTo('none');
        table.tinyint('isPackageUsed').notNullable().defaultTo(0);
        table.integer('packageid').nullable();
        table.enu('status', ['active', 'cancelled', 'refunded', 'written-off', 'voided']).notNullable().defaultTo('active');
        table.tinyint('isRefunded').notNullable().defaultTo(0);
        table.tinyint('isLocked').notNullable();
        table.tinyint('isAdjustment').notNullable();
        table.tinyint('isCorrected').nullable();
        table.integer('relatedbillingid').nullable();
        table.decimal('paidamount', 10, 2).defaultTo(0.00);
        table.enu('paymentstatus', ['partial', 'pending', 'paid']).defaultTo('pending');
    });
    await knex.schema.createTable('dboservices_audit', (table) => {
        table.bigIncrements('audit_id').primary();
        table.integer('serviceid').nullable();
        table.integer('billingid').nullable();
        table.integer('trackId').nullable();
        table.decimal('cost', 10, 2).nullable();
        table.integer('employeeid').nullable();
        table.enu('serviceCategory', ['PHIS', 'NHIS', 'GENERAL', 'ORGANIZATION', 'SERVICES', 'CLINICIAN_SPECIAL_BILLING']).nullable();
        table.integer('categoryTrackId').nullable();
        table.integer('clinicianId').nullable();
        table.integer('organizationId').nullable();
        table.enu('registrationType', ['self', 'organization', 'clinician', 'phis', 'nhis']).nullable();
        table.integer('branchid').nullable();
        table.tinyint('isoutsourced').nullable();
        table.integer('outsourceid').nullable();
        table.datetime('serviceAddedOn', { precision: 6 }).nullable();
        table.json('taxList').nullable();
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
        table.enu('nightAdjustmentMode', ['absolute', 'percentage', 'none']).nullable();
        table.tinyint('isPackageUsed').nullable();
        table.integer('packageid').nullable();
        table.enu('action_type', ['INSERT', 'UPDATE', 'DELETE']).nullable();
        table.datetime('action_timestamp').defaultTo(knex.fn.now());
        table.string('actor', 100).nullable();
    });
    // ==========================================
    // PHASE 9: Additional Service and Utility Tables
    // ==========================================
    await knex.schema.createTable('additionalservices', (table) => {
        table.integer('keyid').primary();
        table.string('serviceName', 100).notNullable();
        table.integer('servicePrice').notNullable();
        table.datetime('serviceCreatedOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('serviceUpdatedBy').notNullable();
        table.integer('createdBy').notNullable();
        table.datetime('serviceUpdatedOn', { precision: 6 }).notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'));
        table.tinyint('issystem').notNullable().defaultTo(0);
    });
    await knex.schema.createTable('dbobillingrefundtable', (table) => {
        table.integer('refundid').primary();
        table.integer('serviceid').notNullable();
        table.integer('refundedBy').notNullable();
        table.integer('firstWitness').notNullable();
        table.integer('secondWitness').notNullable();
        table.integer('thirdWitness').notNullable();
        table.text('firstWitnessPurpose').nullable();
        table.datetime('firstWitnessDate', { precision: 6 }).nullable();
        table.datetime('secondWitnessDate', { precision: 6 }).nullable();
        table.datetime('thirdWitnessDate', { precision: 6 }).nullable();
        table.tinyint('isRefundCompleted').notNullable().defaultTo(0);
        table.tinyint('isRefundInitiated').notNullable().defaultTo(0);
        table.integer('initiatedBy').nullable();
        table.text('secondWitnessPurpose').nullable();
        table.text('thirdWitnessPurpose').nullable();
        table.tinyint('isRefundApproved').notNullable().defaultTo(0);
        table.tinyint('approvalDate').notNullable().defaultTo(0);
        table.integer('approvedby').nullable();
        table.decimal('amountRefunded', 10, 2).notNullable().defaultTo(0.00);
        table.tinyint('isRefundMatterClosed').notNullable().defaultTo(0);
    });
    await knex.schema.createTable('dboexpensecategory', (table) => {
        table.integer('id').primary();
        table.string('category', 100).notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.datetime('updatedon', { precision: 6 }).nullable();
        table.integer('employeeid').notNullable();
    });
    await knex.schema.createTable('dbogeneraltesteditcount', (table) => {
        table.integer('id').primary();
        table.integer('ascensionid').notNullable();
        table.integer('billingid').notNullable();
        table.integer('counter').notNullable();
        table.datetime('updatedon', { precision: 6 }).notNullable();
    });
    await knex.schema.createTable('dbosystemsecurity', (table) => {
        table.increments('id').primary();
        table.string('computerName', 100).notNullable();
        table.string('computerDrive', 100).notNullable();
        table.string('userDomain', 100).notNullable();
        table.string('systemRoot', 100).notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable();
        table.datetime('updatedOn', { precision: 6 }).notNullable();
        table.string('appDir', 255).notNullable();
    });
    await knex.schema.createTable('dbotestresultapproval', (table) => {
        table.integer('id').primary();
        table.integer('ascensionid').notNullable();
        table.tinyint('isapproved').notNullable().defaultTo(0);
        table.string('approvedBy', 20).nullable();
        table.integer('printCount').notNullable();
        table.datetime('lastupdatedon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.integer('maxvalidation').defaultTo(2);
        table.integer('minvalidation').defaultTo(1);
    });
    await knex.schema.createTable('dbovitalsigns', (table) => {
        table.integer('vitalsignid').primary();
        table.integer('patientid').notNullable();
        table.string('bp', 10).notNullable();
        table.decimal('temperature', 6, 2).notNullable();
        table.integer('pulse').notNullable();
        table.integer('respiration').notNullable();
        table.integer('employeeid').notNullable();
        table.date('date').notNullable().defaultTo(knex.fn.now());
        table.time('time', { precision: 6 }).notNullable().defaultTo(knex.fn.now());
        table.integer('spo2').notNullable();
        table.integer('isConsulation').nullable();
        table.integer('consultationid').nullable();
    });
    // ==========================================
    // PHASE 10: Communication and Email Tables
    // ==========================================
    await knex.schema.createTable('generalemailsettings', (table) => {
        table.integer('id').primary();
        table.string('provider', 50).notNullable();
        table.string('email', 100).notNullable();
        table.string('apppassword', 100).notNullable();
        table.string('verificationSubject', 200).notNullable();
        table.string('readySubject', 200).notNullable();
        table.string('sampleSubject', 200).notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
    });
    await knex.schema.createTable('emailpreference', (table) => {
        table.increments('id').primary();
        table.string('registration', 3).notNullable().defaultTo('No');
        table.string('result', 3).notNullable().defaultTo('No');
        table.string('rejection', 3).notNullable().defaultTo('No');
        table.string('approval', 3).notNullable().defaultTo('No');
        table.string('transactions', 3).notNullable().defaultTo('No');
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.string('birthday', 3).notNullable().defaultTo('Yes');
        table.string('billing', 3).notNullable().defaultTo('Yes');
    });
    await knex.schema.createTable('composedemails', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.string('subject', 200).notNullable();
        table.text('target').notNullable();
        table.string('ispublished', 10).notNullable().defaultTo('false');
        table.datetime('created_on', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.datetime('updated_on', { precision: 6 }).nullable();
        table.longtext('body').notNullable();
        table.datetime('scheduledate', { precision: 6 }).nullable();
    });
    await knex.schema.createTable('emaillog', (table) => {
        table.increments('id').primary();
        table.integer('target').notNullable();
        table.string('type', 100).notNullable();
        table.integer('success').notNullable();
        table.datetime('date', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('reason', 100).nullable();
    });
    // ==========================================
    // PHASE 11: Access Control and Security Tables
    // ==========================================
    await knex.schema.createTable('access_windows', (table) => {
        table.integer('id', 10).unsigned().primary();
        table.integer('employeeid').notNullable();
        table.enu('category', ['global', 'individual']).notNullable().defaultTo('individual');
        table.enu('edit_window', ['1h', '4h', '8h', '12h', '24h', '1d', '1w', '2w', '1m']).notNullable();
        table.enu('access_window', ['1h', '4h', '8h', '12h', '24h', '1d', '1w', '2w', '1m']).notNullable();
        table.enu('applicable_role', ['scientist', 'phlebotomist', 'customer service representative', 'sonographer']).nullable();
        table.tinyint('require_approval').notNullable().defaultTo(0);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    await knex.schema.createTable('employeepreferredshifts', (table) => {
        table.integer('employeeid').notNullable();
        table.integer('shiftid').notNullable();
        table.integer('preferenceid').notNullable();
        table.primary(['employeeid', 'shiftid']);
    });
    await knex.schema.createTable('employeeunavailabledays', (table) => {
        table.integer('employeeid').notNullable();
        table.string('dayofweek', 20).notNullable();
        table.integer('unavailableid').notNullable();
        table.primary(['employeeid', 'dayofweek']);
    });
    // ==========================================
    // PHASE 12: Accounting Journal Tables
    // ==========================================
    await knex.schema.createTable('acc_journal_entry_lines', (table) => {
        table.string('id', 50).primary();
        table.string('account_id', 50).notNullable().comment('Account being debited or credited');
        table.decimal('debit_amount', 12, 2).defaultTo(0.00).comment('Debit amount (if any)');
        table.decimal('credit_amount', 12, 2).defaultTo(0.00).comment('Credit amount (if any)');
        table.string('line_description', 255).nullable().comment('Description for this specific line');
        table.string('reference_id', 50).nullable().comment('Optional reference to specific item/transaction');
        table.string('reference_type', 50).nullable().comment('Type of reference (order_item, payment_allocation, etc.)');
        table.date('entry_date').notNullable().comment('Date of the journal line');
        table.enu('source_module', ['inventory', 'billing', 'expense', 'other']).defaultTo('inventory').comment('Which module created this entry');
        table.enu('entry_status', ['draft', 'posted', 'reversed']).defaultTo('draft').comment('Status of the journal line');
        table.string('posted_by', 100).nullable().comment('User who posted this line');
        table.timestamp('posted_at').nullable().comment('When line was posted');
        table.timestamp('created_at').nullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').nullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    // ==========================================
    // PHASE 13: Patient and Activation Tables
    // ==========================================
    await knex.schema.createTable('activation', (table) => {
        table.integer('ID', 255).primary();
        table.string('STATUS', 100).notNullable().defaultTo('INACTIVE');
        table.integer('PATIENTID', 100).notNullable();
        table.date('DATE').notNullable().defaultTo(knex.fn.now());
        table.integer('mimi', 44).notNullable();
    });
    await knex.schema.createTable('appointments', (table) => {
        table.integer('refid', 100).primary();
        table.integer('patientid').notNullable();
        table.integer('duration').notNullable();
        table.string('status', 50).defaultTo('pending');
        table.string('appointment_time', 10).notNullable();
        table.date('appointment_date').notNullable();
        table.string('inviteMethod', 20).notNullable();
        table.string('purpose', 500).notNullable();
        table.string('title', 300).notNullable();
        table.string('preference', 50).notNullable();
        table.integer('practioner').notNullable();
        table.string('location', 50).notNullable();
        table.string('notes', 500).nullable();
    });
    await knex.schema.createTable('attendancecycles', (table) => {
        table.increments('id').primary();
        table.date('cyclestart').notNullable();
        table.cycleend('cycleend').notNullable();
        table.text('description').nullable();
    });
    // ==========================================
    // PHASE 14: Backup and Security Tables
    // ==========================================
    await knex.schema.createTable('backup_logs', (table) => {
        table.increments('id').primary();
        table.string('backup_name', 255).notNullable();
        table.tinyint('is_successful').notNullable().defaultTo(0);
        table.tinyint('is_full_backup').notNullable().defaultTo(0);
        table.bigInteger('backup_size_bytes').nullable();
        table.enu('backup_type', ['database', 'files', 'full_system']).notNullable();
        table.enu('backup_mode', ['automated', 'manual']).notNullable();
        table.datetime('backup_date').notNullable().defaultTo(knex.fn.now());
        table.string('backup_path', 255).nullable();
        table.text('error_message').nullable();
        table.integer('duration_seconds').nullable();
        table.string('created_by', 255).nullable();
        table.integer('schedule_id').nullable();
        table.string('encryption_key_id', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    await knex.schema.createTable('backup_schedules', (table) => {
        table.increments('id').primary();
        table.string('schedule_name', 255).notNullable();
        table.enu('frequency', ['daily', 'weekly', 'monthly', 'hourly']).notNullable();
        table.time('backup_time').notNullable();
        table.integer('retention_days').notNullable();
        table.integer('employeeid').notNullable();
        table.string('backup_path', 255).nullable();
        table.enu('backup_type', ['database', 'files', 'full_system']).notNullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.string('database_name', 255).nullable();
        table.string('source_path', 255).nullable();
        table.timestamp('last_run').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    await knex.schema.createTable('backup_security_settings', (table) => {
        table.integer('id', 10).unsigned().primary();
        table.tinyint('encryption_enabled').notNullable().defaultTo(0);
        table.string('encryption_algorithm', 255).notNullable().defaultTo('AES-256');
        table.integer('key_rotation_days').notNullable().defaultTo(90);
        table.tinyint('secure_deletion_enabled').notNullable().defaultTo(0);
        table.integer('deletion_passes').notNullable().defaultTo(1);
        table.string('current_key_id', 255).nullable();
        table.date('key_last_rotated').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.timestamp('created_at').nullable();
        table.timestamp('updated_at').nullable();
    });
    await knex.schema.createTable('encryption_keys', (table) => {
        table.increments('id').primary();
        table.string('key_id', 255).notNullable();
        table.text('encrypted_key').notNullable();
        table.string('algorithm', 255).notNullable().defaultTo('aes-256-cbc');
        table.date('expires_at').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.date('deactivated_at').nullable();
        table.string('created_by', 255).nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
    });
    // ==========================================
    // PHASE 15: Event and Template Tables
    // ==========================================
    await knex.schema.createTable('event_template_map', (table) => {
        table.bigInteger('event_id').unsigned().primary();
        table.integer('template_id').notNullable();
    });
    // ==========================================
    // PHASE 16: Expense and Merchant Tables
    // ==========================================
    await knex.schema.createTable('expense_merchants', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('email', 255).nullable();
        table.string('phone', 32).nullable();
        table.string('address', 255).nullable();
        table.string('website', 255).nullable();
        table.text('notes').nullable();
        table.datetime('created_at').defaultTo(knex.fn.now());
        table.datetime('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.integer('created_by').notNullable();
        table.integer('updated_by').nullable();
    });
    await knex.schema.createTable('expensesrecord', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.datetime('date', { precision: 6 }).notNullable();
        table.integer('merchant').nullable();
        table.integer('amount').notNullable();
        table.integer('category').notNullable();
        table.text('description').notNullable();
        table.integer('employeeid').notNullable();
        table.integer('branchid').notNullable();
        table.datetime('createdon', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.tinyint('approved').notNullable().defaultTo(0);
        table.integer('approvedby').notNullable();
        table.datetime('approvedon', { precision: 6 }).nullable();
        table.text('rejectionmessage').nullable();
        table.tinyint('isassociatedservice').defaultTo(0);
        table.integer('serviceid').nullable();
        table.string('groupId', 255).nullable();
    });
    await knex.schema.createTable('expense_payments', (table) => {
        table.increments('id').primary();
        table.integer('expense_id').notNullable();
        table.integer('invoice_id').nullable();
        table.datetime('payment_date').notNullable();
        table.decimal('amount', 12, 2).notNullable();
        table.string('method', 50).nullable();
        table.enu('status', ['Paid', 'Pending', 'Failed']).defaultTo('Pending');
        table.integer('created_by').notNullable();
        table.datetime('created_on').defaultTo(knex.fn.now());
    });
    await knex.schema.createTable('expensesrecord_audit_log', (table) => {
        table.increments('audit_id').primary();
        table.string('uid', 36).notNullable();
        table.enu('operation', ['INSERT', 'UPDATE', 'DELETE']).notNullable();
        table.string('table_name', 255).notNullable().defaultTo('expensesrecord');
        table.integer('record_id').notNullable();
        table.json('old_data').nullable();
        table.json('new_data').nullable();
        table.integer('changed_by').nullable();
        table.datetime('changed_on', { precision: 6 }).defaultTo(knex.fn.now(6));
        table.string('client_ip', 45).nullable();
    });
    // ==========================================
    // PHASE 17: Department and Stock Management Tables
    // ==========================================
    await knex.schema.createTable('departmentrequisition', (table) => {
        table.increments('id').primary();
        table.integer('departmentid').notNullable();
        table.integer('stockid').notNullable();
        table.integer('quantity_requested').notNullable();
        table.integer('quantity_approved').nullable();
        table.string('comsumptionunit', 255).notNullable();
        table.string('status', 20).defaultTo('pending');
        table.date('date').notNullable().defaultTo(knex.fn.now());
        table.text('issue_message').nullable();
        table.integer('departmentReceived').defaultTo(0);
        table.integer('store_supplied').defaultTo(0);
        table.integer('quantityReceived').defaultTo(0);
        table.integer('requestingemployee').notNullable();
        table.integer('receivingemployee').notNullable();
        table.date('approvedon').nullable();
        table.time('approvedTime', { precision: 6 }).notNullable().defaultTo(knex.fn.now());
        table.integer('requestapprovedby').notNullable();
    });
    await knex.schema.createTable('departmentrequisitionhx', (table) => {
        table.integer('id').primary();
        table.integer('stockid').notNullable();
        table.integer('brandid').notNullable();
        table.string('batchnumber', 50).notNullable();
        table.string('status', 20).notNullable().defaultTo('pending');
        table.integer('qty').notNullable();
        table.integer('requisitionid').notNullable();
        table.datetime('receivedon', { precision: 6 }).nullable();
        table.integer('departmentid').notNullable();
        table.integer('productordersid').notNullable();
        table.integer('employeeid').notNullable();
    });
    await knex.schema.createTable('departmentsmainsupply', (table) => {
        table.integer('id').primary();
        table.integer('quantity').notNullable();
        table.integer('stockid').notNullable();
        table.integer('departmentid').notNullable();
        table.string('batchnumber', 50).nullable();
        table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('brand', 50).nullable();
        table.tinyint('expiredDisposed').notNullable().defaultTo(0);
        table.datetime('disposaldate', { precision: 6 }).nullable();
        table.integer('employeeid').nullable();
        table.integer('productordersid').notNullable();
    });
    await knex.schema.createTable('departmentmainstoresupplyproductorderlefttracking', (table) => {
        table.integer('id').primary();
        table.integer('quantity').notNullable();
        table.integer('stockid').notNullable();
        table.integer('departmentid').notNullable();
        table.string('batchnumber', 50).nullable();
        table.datetime('createdOn', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('brand', 50).nullable();
        table.tinyint('expiredDisposed').notNullable().defaultTo(0);
        table.datetime('disposaldate', { precision: 6 }).nullable();
        table.integer('employeeid').nullable();
        table.integer('productordersid').nullable();
    });
    await knex.schema.createTable('departmentconsumptionhx', (table) => {
        table.integer('comsumeid').primary();
        table.integer('department').notNullable();
        table.integer('stockid').notNullable();
        table.string('batchnumber', 50).nullable();
        table.string('brand', 50).nullable();
        table.integer('debit').notNullable();
        table.date('date').notNullable().defaultTo(knex.fn.now());
        table.time('time', { precision: 6 }).notNullable().defaultTo(knex.fn.now());
        table.integer('employeeid').notNullable();
        table.tinyint('wastage').notNullable().defaultTo(0);
        table.integer('productordersid').notNullable();
    });
    await knex.schema.createTable('generalstorecredithx', (table) => {
        table.integer('id').primary();
        table.integer('productordersid').notNullable();
        table.integer('stockid').notNullable();
        table.integer('credit').nullable();
        table.integer('brandid').notNullable();
        table.string('batchnumber', 100).notNullable();
        table.datetime('creditDate', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
    });
    await knex.schema.createTable('generalstoredebithx', (table) => {
        table.integer('id').primary();
        table.integer('stockid').notNullable();
        table.integer('brandid').notNullable();
        table.datetime('debitdate', { precision: 6 }).notNullable().defaultTo(knex.fn.now(6));
        table.string('batchnumber', 100).notNullable();
        table.integer('productordersid').nullable();
        table.integer('debitqty').notNullable();
        table.integer('departmentid').notNullable();
        table.tinyint('wastage').notNullable().defaultTo(0);
    });
    // ==========================================
    // PHASE 18: Incident and Compliance Tables
    // ==========================================
    await knex.schema.createTable('incidents', (table) => {
        table.string('id', 50).primary();
        table.enu('type', ['patient-safety', 'quality', 'security', 'compliance']).notNullable();
        table.string('title', 255).notNullable();
        table.text('description').notNullable();
        table.enu('severity', ['low', 'medium', 'high', 'critical']).notNullable();
        table.enu('status', ['reported', 'investigating', 'root-cause-analysis', 'corrective-actions', 'resolved', 'closed']).notNullable().defaultTo('reported');
        table.timestamp('reported_at').notNullable().defaultTo(knex.fn.now());
        table.text('affected_parties').nullable();
        table.string('location', 255).nullable();
        table.text('immediate_actions').nullable();
        table.text('root_cause').nullable();
        table.json('root_cause_analysis').nullable();
        table.text('corrective_actions').nullable();
        table.json('corrective_action_plan').nullable();
        table.tinyint('regulatory_reporting').defaultTo(0);
        table.json('escalated_to').nullable();
        table.date('follow_up_date').nullable();
        table.date('resolution_date').nullable();
        table.json('attachments').nullable();
        table.json('investigation_notes').nullable();
        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        table.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
        table.integer('reported_by').notNullable();
    });
    // ==========================================
    // PHASE 19: Security and Clearance Tables
    // ==========================================
    await knex.schema.createTable('securityclearancelevels', (table) => {
        table.increments('id').primary();
        table.string('level_name', 100).notNullable();
        table.text('description').nullable();
        table.integer('access_level').notNullable();
        table.json('permissions').notNullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('securityclearance', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.integer('clearance_level_id').notNullable();
        table.datetime('granted_date').notNullable().defaultTo(knex.fn.now());
        table.datetime('expiry_date').nullable();
        table.integer('granted_by').notNullable();
        table.text('notes').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('performancereviews', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.datetime('review_date').notNullable().defaultTo(knex.fn.now());
        table.integer('reviewer_id').notNullable();
        table.decimal('overall_rating', 3, 2).notNullable();
        table.text('comments').nullable();
        table.json('category_ratings').nullable();
        table.datetime('next_review_date').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('salarystructure', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.decimal('basic_salary', 12, 2).notNullable();
        table.decimal('house_allowance', 10, 2).defaultTo(0.00);
        table.decimal('transport_allowance', 10, 2).defaultTo(0.00);
        table.decimal('medical_allowance', 10, 2).defaultTo(0.00);
        table.decimal('other_allowances', 10, 2).defaultTo(0.00);
        table.decimal('tax_deductible', 10, 2).defaultTo(0.00);
        table.decimal('pension_contribution', 10, 2).defaultTo(0.00);
        table.decimal('other_deductions', 10, 2).defaultTo(0.00);
        table.decimal('net_salary', 12, 2).notNullable();
        table.date('effective_date').notNullable().defaultTo(knex.fn.now());
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('allowancesdeductions', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.enu('type', ['allowance', 'deduction']).notNullable();
        table.string('name', 100).notNullable();
        table.decimal('amount', 10, 2).notNullable();
        table.enu('frequency', ['monthly', 'quarterly', 'annually', 'one-time']).notNullable().defaultTo('monthly');
        table.tinyint('is_taxable').notNullable().defaultTo(0);
        table.date('start_date').notNullable().defaultTo(knex.fn.now());
        table.date('end_date').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('paymenthistory', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.datetime('payment_date').notNullable().defaultTo(knex.fn.now());
        table.decimal('gross_salary', 12, 2).notNullable();
        table.decimal('net_salary', 12, 2).notNullable();
        table.decimal('total_allowances', 10, 2).defaultTo(0.00);
        table.decimal('total_deductions', 10, 2).defaultTo(0.00);
        table.decimal('tax_amount', 10, 2).defaultTo(0.00);
        table.string('payment_method', 50).nullable();
        table.string('reference_number', 100).nullable();
        table.integer('processed_by').notNullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('employmentdocuments', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.string('document_type', 100).notNullable();
        table.string('document_name', 255).notNullable();
        table.string('file_path', 500).notNullable();
        table.datetime('upload_date').notNullable().defaultTo(knex.fn.now());
        table.date('expiry_date').nullable();
        table.tinyint('is_verified').notNullable().defaultTo(0);
        table.integer('verified_by').nullable();
        table.datetime('verification_date').nullable();
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('sopsignoffs', (table) => {
        table.increments('id').primary();
        table.integer('employeeid').notNullable();
        table.string('sop_id', 100).notNullable();
        table.string('sop_title', 255).notNullable();
        table.string('version', 20).notNullable();
        table.datetime('signoff_date').notNullable().defaultTo(knex.fn.now());
        table.integer('approved_by').notNullable();
        table.datetime('next_review_date').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    // ==========================================
    // PHASE 20: SMS and Communication Tables
    // ==========================================
    await knex.schema.createTable('sms_logs', (table) => {
        table.increments('id').primary();
        table.string('recipient', 15).notNullable();
        table.text('message').notNullable();
        table.enu('message_type', ['result', 'registration', 'sample', 'birthday', 'billing', 'appointment', 'reminder']).notNullable();
        table.enu('status', ['sent', 'failed', 'pending']).notNullable().defaultTo('pending');
        table.string('provider_response', 500).nullable();
        table.integer('reference_id').nullable();
        table.string('reference_type', 50).nullable();
        table.datetime('sent_at').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.integer('created_by').nullable();
    });
    // ==========================================
    // PHASE 21: Result Access and Approval Tables
    // ==========================================
    await knex.schema.createTable('result_access_requests', (table) => {
        table.increments('id').primary();
        table.integer('patient_id').notNullable();
        table.integer('requested_by').notNullable();
        table.string('relationship', 100).notNullable();
        table.text('reason').notNullable();
        table.enu('status', ['pending', 'approved', 'rejected', 'expired']).notNullable().defaultTo('pending');
        table.datetime('requested_at').notNullable().defaultTo(knex.fn.now());
        table.integer('approved_by').nullable();
        table.datetime('approved_at').nullable();
        table.datetime('expires_at').nullable();
        table.text('approval_notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    // ==========================================
    // PHASE 22: QC and Quality Control Tables
    // ==========================================
    await knex.schema.createTable('qc_sessions', (table) => {
        table.increments('id').primary();
        table.integer('test_id').notNullable();
        table.integer('control_material_id').notNullable();
        table.integer('performed_by').notNullable();
        table.datetime('session_date').notNullable().defaultTo(knex.fn.now());
        table.enu('status', ['in_progress', 'completed', 'failed']).notNullable().defaultTo('in_progress');
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('qc_readings', (table) => {
        table.increments('id').primary();
        table.integer('qc_session_id').notNullable();
        table.integer('parameter_id').notNullable();
        table.decimal('reading_value', 10, 4).notNullable();
        table.enu('status', ['within_range', 'out_of_range', 'critical']).notNullable();
        table.decimal('expected_value', 10, 4).nullable();
        table.decimal('tolerance', 5, 2).nullable();
        table.text('comments').nullable();
        table.datetime('reading_time').notNullable().defaultTo(knex.fn.now());
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    });
    // ==========================================
    // PHASE 23: Critical Value Logging Tables
    // ==========================================
    await knex.schema.createTable('critical_value_logs', (table) => {
        table.increments('id').primary();
        table.integer('test_result_id').notNullable();
        table.integer('patient_id').notNullable();
        table.integer('test_id').notNullable();
        table.string('parameter', 255).notNullable();
        table.string('result_value', 100).notNullable();
        table.string('unit', 50).nullable();
        table.string('reference_range', 100).nullable();
        table.enu('severity', ['low', 'high', 'critical']).notNullable();
        table.integer('reported_by').notNullable();
        table.datetime('reported_at').notNullable().defaultTo(knex.fn.now());
        table.integer('acknowledged_by').nullable();
        table.datetime('acknowledged_at').nullable();
        table.text('follow_up_actions').nullable();
        table.enu('status', ['reported', 'acknowledged', 'resolved']).notNullable().defaultTo('reported');
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    // ==========================================
    // PHASE 24: Sales and Session Management Tables
    // ==========================================
    await knex.schema.createTable('sales_sessions', (table) => {
        table.increments('id').primary();
        table.integer('employee_id').notNullable();
        table.datetime('start_time').notNullable().defaultTo(knex.fn.now());
        table.datetime('end_time').nullable();
        table.decimal('opening_balance', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('closing_balance', 10, 2).nullable();
        table.decimal('cash_sales', 10, 2).defaultTo(0.00);
        table.decimal('card_sales', 10, 2).defaultTo(0.00);
        table.decimal('total_sales', 10, 2).defaultTo(0.00);
        table.enu('status', ['active', 'closed', 'reconciled']).notNullable().defaultTo('active');
        table.integer('closed_by').nullable();
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    // ==========================================
    // PHASE 25: Test Results and Processing Tables
    // ==========================================
    await knex.schema.createTable('test_results', (table) => {
        table.increments('id').primary();
        table.integer('ascension_id').notNullable();
        table.integer('test_id').notNullable();
        table.integer('parameter_id').notNullable();
        table.string('result_value', 255).nullable();
        table.string('unit', 50).nullable();
        table.string('reference_range', 100).nullable();
        table.enu('status', ['pending', 'completed', 'reviewed', 'approved', 'rejected']).notNullable().defaultTo('pending');
        table.integer('performed_by').notNullable();
        table.datetime('performed_at').notNullable().defaultTo(knex.fn.now());
        table.integer('reviewed_by').nullable();
        table.datetime('reviewed_at').nullable();
        table.integer('approved_by').nullable();
        table.datetime('approved_at').nullable();
        table.text('comments').nullable();
        table.tinyint('is_critical').defaultTo(0);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('result_lock_table', (table) => {
        table.increments('id').primary();
        table.integer('ascension_id').notNullable();
        table.integer('test_id').notNullable();
        table.integer('locked_by').notNullable();
        table.datetime('locked_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('expires_at').nullable();
        table.enu('lock_reason', ['editing', 'reviewing', 'approving']).notNullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    });
    // ==========================================
    // PHASE 26: Event and Notification Tables
    // ==========================================
    await knex.schema.createTable('events', (table) => {
        table.bigIncrements('id').primary();
        table.string('event_type', 100).notNullable();
        table.string('title', 255).notNullable();
        table.text('description').nullable();
        table.json('event_data').nullable();
        table.enu('priority', ['low', 'medium', 'high', 'critical']).notNullable().defaultTo('medium');
        table.enu('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending');
        table.integer('created_by').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('processed_at').nullable();
        table.text('error_message').nullable();
    });
    // ==========================================
    // PHASE 27: Inventory Management Tables
    // ==========================================
    await knex.schema.createTable('brands', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('manufacturer', 255).nullable();
        table.text('description').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
    });
    await knex.schema.createTable('categories', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.integer('parent_id').nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
    });
    await knex.schema.createTable('suppliers', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('contact_person', 255).nullable();
        table.string('email', 255).nullable();
        table.string('phone', 20).nullable();
        table.text('address').nullable();
        table.string('tax_id', 50).nullable();
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
    });
    await knex.schema.createTable('storage_locations', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('location_code', 50).notNullable();
        table.text('description').nullable();
        table.enu('type', ['warehouse', 'room', 'cabinet', 'shelf', 'freezer', 'refrigerator']).notNullable();
        table.decimal('temperature_min', 5, 2).nullable();
        table.decimal('temperature_max', 5, 2).nullable();
        table.tinyint('requires_monitoring').notNullable().defaultTo(0);
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
    });
    await knex.schema.createTable('inventory_items', (table) => {
        table.increments('id').primary();
        table.string('item_code', 100).notNullable();
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.integer('category_id').notNullable();
        table.integer('supplier_id').nullable();
        table.integer('brand_id').nullable();
        table.string('unit_of_measure', 50).notNullable();
        table.integer('minimum_stock_level').notNullable().defaultTo(0);
        table.integer('maximum_stock_level').nullable();
        table.integer('reorder_point').nullable();
        table.decimal('unit_cost', 10, 2).nullable();
        table.decimal('selling_price', 10, 2).nullable();
        table.enu('item_type', ['consumable', 'equipment', 'reagent', 'disposable']).notNullable();
        table.tinyint('requires_expiry_tracking').notNullable().defaultTo(0);
        table.tinyint('is_active').notNullable().defaultTo(1);
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
    });
    await knex.schema.createTable('purchase_orders', (table) => {
        table.increments('id').primary();
        table.string('po_number', 50).notNullable();
        table.integer('supplier_id').notNullable();
        table.datetime('order_date').notNullable().defaultTo(knex.fn.now());
        table.date('expected_delivery_date').nullable();
        table.date('actual_delivery_date').nullable();
        table.enu('status', ['draft', 'pending_approval', 'approved', 'ordered', 'partially_received', 'received', 'cancelled']).notNullable().defaultTo('draft');
        table.decimal('subtotal', 12, 2).notNullable().defaultTo(0.00);
        table.decimal('tax_amount', 10, 2).defaultTo(0.00);
        table.decimal('discount_amount', 10, 2).defaultTo(0.00);
        table.decimal('total_amount', 12, 2).notNullable().defaultTo(0.00);
        table.string('currency', 3).notNullable().defaultTo('USD');
        table.text('notes').nullable();
        table.integer('approved_by').nullable();
        table.datetime('approved_at').nullable();
        table.integer('ordered_by').notNullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
        table.integer('updated_by').nullable();
    });
    await knex.schema.createTable('purchase_order_items', (table) => {
        table.increments('id').primary();
        table.integer('purchase_order_id').notNullable();
        table.integer('inventory_item_id').notNullable();
        table.integer('quantity_ordered').notNullable();
        table.integer('quantity_received').notNullable().defaultTo(0);
        table.decimal('unit_price', 10, 2).notNullable();
        table.decimal('line_total', 12, 2).notNullable();
        table.date('expiry_date').nullable();
        table.string('batch_number', 100).nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('purchase_order_receipts', (table) => {
        table.increments('id').primary();
        table.integer('purchase_order_id').notNullable();
        table.integer('purchase_order_item_id').notNullable();
        table.integer('quantity_received').notNullable();
        table.datetime('received_date').notNullable().defaultTo(knex.fn.now());
        table.integer('received_by').notNullable();
        table.string('batch_number', 100).nullable();
        table.date('expiry_date').nullable();
        table.integer('storage_location_id').nullable();
        table.enu('condition', ['good', 'damaged', 'expired']).notNullable().defaultTo('good');
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
    });
    await knex.schema.createTable('inventory_transactions', (table) => {
        table.increments('id').primary();
        table.integer('inventory_item_id').notNullable();
        table.enu('transaction_type', ['purchase', 'sale', 'adjustment', 'transfer', 'consumption', 'wastage']).notNullable();
        table.integer('quantity').notNullable();
        table.integer('balance_before').notNullable();
        table.integer('balance_after').notNullable();
        table.decimal('unit_cost', 10, 2).nullable();
        table.decimal('total_cost', 12, 2).nullable();
        table.integer('reference_id').nullable();
        table.string('reference_type', 50).nullable();
        table.integer('patient_ascension_id').nullable();
        table.integer('test_id').nullable();
        table.integer('performed_by').notNullable();
        table.datetime('transaction_date').notNullable().defaultTo(knex.fn.now());
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    });
    await knex.schema.createTable('consumption_history', (table) => {
        table.increments('id').primary();
        table.integer('inventory_transaction_id').notNullable();
        table.integer('patient_id').nullable();
        table.integer('test_id').nullable();
        table.integer('department_id').nullable();
        table.string('batch_number', 100).nullable();
        table.string('brand_name', 255).nullable();
        table.integer('quantity_used').notNullable();
        table.datetime('consumption_date').notNullable().defaultTo(knex.fn.now());
        table.integer('consumed_by').notNullable();
        table.enu('waste_type', ['none', 'expired', 'damaged', 'contamination', 'other']).defaultTo('none');
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    });
    // ==========================================
    // PHASE 28: Invoice and Payment Tables
    // ==========================================
    await knex.schema.createTable('invoices', (table) => {
        table.increments('id').primary();
        table.string('invoice_number', 50).notNullable();
        table.integer('billing_id').nullable();
        table.integer('patient_id').notNullable();
        table.datetime('invoice_date').notNullable().defaultTo(knex.fn.now());
        table.date('due_date').notNullable();
        table.decimal('subtotal', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('tax_amount', 10, 2).defaultTo(0.00);
        table.decimal('discount_amount', 10, 2).defaultTo(0.00);
        table.decimal('total_amount', 10, 2).notNullable().defaultTo(0.00);
        table.decimal('amount_paid', 10, 2).defaultTo(0.00);
        table.decimal('balance_due', 10, 2).notNullable().defaultTo(0.00);
        table.enu('status', ['draft', 'sent', 'paid', 'overdue', 'cancelled']).notNullable().defaultTo('draft');
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.datetime('updated_at').nullable();
        table.integer('created_by').notNullable();
    });
    await knex.schema.createTable('invoice_items', (table) => {
        table.increments('id').primary();
        table.integer('invoice_id').notNullable();
        table.string('description', 255).notNullable();
        table.integer('quantity').notNullable().defaultTo(1);
        table.decimal('unit_price', 10, 2).notNullable();
        table.decimal('line_total', 10, 2).notNullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    });
    await knex.schema.createTable('invoice_payments', (table) => {
        table.increments('id').primary();
        table.integer('invoice_id').notNullable();
        table.datetime('payment_date').notNullable().defaultTo(knex.fn.now());
        table.decimal('amount', 10, 2).notNullable();
        table.enu('payment_method', ['cash', 'card', 'bank_transfer', 'check', 'insurance']).notNullable();
        table.string('reference_number', 100).nullable();
        table.text('notes').nullable();
        table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
        table.integer('received_by').notNullable();
    });
    // ==========================================
    // PHASE 29: Final Audit and System Tables
    // ==========================================
    await knex.schema.createTable('incident_audit_trail', (table) => {
        table.increments('id').primary();
        table.string('incident_id', 50).notNullable();
        table.enu('action', ['created', 'updated', 'status_changed', 'comment_added', 'attachment_added', 'escalated']).notNullable();
        table.integer('performed_by').notNullable();
        table.datetime('performed_at').notNullable().defaultTo(knex.fn.now());
        table.text('old_value').nullable();
        table.text('new_value').nullable();
        table.text('comments').nullable();
        table.json('additional_data').nullable();
    });
    // Create indexes for better performance
    await knex.schema.raw(`
    CREATE INDEX idx_billing_patient_year_month ON billing (patientid, year, month);
    CREATE INDEX idx_billing_status ON billing (status);
    CREATE INDEX idx_billing_branch_year ON billing (branchid, year);
    CREATE INDEX idx_dboservices_billingid ON dboservices (billingid);
    CREATE INDEX idx_dboservices_branchid ON dboservices (branchid);
    CREATE INDEX idx_test_results_ascension ON test_results (ascension_id);
    CREATE INDEX idx_inventory_transactions_item_date ON inventory_transactions (inventory_item_id, transaction_date);
    CREATE INDEX idx_expensesrecord_employee_date ON expensesrecord (employeeid, date);
  `);
}
exports.up = up;
async function down(knex) {
    // Drop tables in reverse order to avoid foreign key constraint issues
    // Drop indexes first
    await knex.schema.raw(`
    DROP INDEX IF EXISTS idx_expensesrecord_employee_date;
    DROP INDEX IF EXISTS idx_inventory_transactions_item_date;
    DROP INDEX IF EXISTS idx_test_results_ascension;
    DROP INDEX IF EXISTS idx_dboservices_branchid;
    DROP INDEX IF EXISTS idx_dboservices_billingid;
    DROP INDEX IF EXISTS idx_billing_branch_year;
    DROP INDEX IF EXISTS idx_billing_status;
    DROP INDEX IF EXISTS idx_billing_patient_year_month;
  `);
    // Drop audit and system tables first
    await knex.schema.dropTableIfExists('incident_audit_trail');
    // Drop invoice and payment tables
    await knex.schema.dropTableIfExists('invoice_payments');
    await knex.schema.dropTableIfExists('invoice_items');
    await knex.schema.dropTableIfExists('invoices');
    // Drop inventory and consumption tables
    await knex.schema.dropTableIfExists('consumption_history');
    await knex.schema.dropTableIfExists('inventory_transactions');
    await knex.schema.dropTableIfExists('purchase_order_receipts');
    await knex.schema.dropTableIfExists('purchase_order_items');
    await knex.schema.dropTableIfExists('purchase_orders');
    await knex.schema.dropTableIfExists('inventory_items');
    await knex.schema.dropTableIfExists('storage_locations');
    await knex.schema.dropTableIfExists('suppliers');
    await knex.schema.dropTableIfExists('categories');
    await knex.schema.dropTableIfExists('brands');
    // Drop event and notification tables
    await knex.schema.dropTableIfExists('events');
    // Drop test results and processing tables
    await knex.schema.dropTableIfExists('result_lock_table');
    await knex.schema.dropTableIfExists('test_results');
    // Drop sales and session management tables
    await knex.schema.dropTableIfExists('sales_sessions');
    // Drop critical value logging tables
    await knex.schema.dropTableIfExists('critical_value_logs');
    // Drop QC and quality control tables
    await knex.schema.dropTableIfExists('qc_readings');
    await knex.schema.dropTableIfExists('qc_sessions');
    // Drop result access and approval tables
    await knex.schema.dropTableIfExists('result_access_requests');
    // Drop SMS and communication tables
    await knex.schema.dropTableIfExists('sms_logs');
    // Drop HR and employment tables
    await knex.schema.dropTableIfExists('sopsignoffs');
    await knex.schema.dropTableIfExists('employmentdocuments');
    await knex.schema.dropTableIfExists('paymenthistory');
    await knex.schema.dropTableIfExists('allowancesdeductions');
    await knex.schema.dropTableIfExists('salarystructure');
    await knex.schema.dropTableIfExists('performancereviews');
    await knex.schema.dropTableIfExists('securityclearance');
    await knex.schema.dropTableIfExists('securityclearancelevels');
    // Drop incident and compliance tables
    await knex.schema.dropTableIfExists('incidents');
    // Drop department and stock management tables
    await knex.schema.dropTableIfExists('generalstoredebithx');
    await knex.schema.dropTableIfExists('generalstorecredithx');
    await knex.schema.dropTableIfExists('departmentconsumptionhx');
    await knex.schema.dropTableIfExists('departmentmainstoresupplyproductorderlefttracking');
    await knex.schema.dropTableIfExists('departmentsmainsupply');
    await knex.schema.dropTableIfExists('departmentrequisitionhx');
    await knex.schema.dropTableIfExists('departmentrequisition');
    // Drop expense and merchant tables
    await knex.schema.dropTableIfExists('expensesrecord_audit_log');
    await knex.schema.dropTableIfExists('expense_payments');
    await knex.schema.dropTableIfExists('expensesrecord');
    await knex.schema.dropTableIfExists('expense_merchants');
    // Drop event and template tables
    await knex.schema.dropTableIfExists('event_template_map');
    // Drop backup and security tables
    await knex.schema.dropTableIfExists('encryption_keys');
    await knex.schema.dropTableIfExists('backup_security_settings');
    await knex.schema.dropTableIfExists('backup_schedules');
    await knex.schema.dropTableIfExists('backup_logs');
    // Drop patient and activation tables
    await knex.schema.dropTableIfExists('attendancecycles');
    await knex.schema.dropTableIfExists('appointments');
    await knex.schema.dropTableIfExists('activation');
    // Drop accounting journal tables
    await knex.schema.dropTableIfExists('acc_journal_entry_lines');
    // Drop access control and security tables
    await knex.schema.dropTableIfExists('employeeunavailabledays');
    await knex.schema.dropTableIfExists('employeepreferredshifts');
    await knex.schema.dropTableIfExists('access_windows');
    // Drop communication and email tables
    await knex.schema.dropTableIfExists('emaillog');
    await knex.schema.dropTableIfExists('composedemails');
    await knex.schema.dropTableIfExists('emailpreference');
    await knex.schema.dropTableIfExists('generalemailsettings');
    // Drop additional service and utility tables
    await knex.schema.dropTableIfExists('dbovitalsigns');
    await knex.schema.dropTableIfExists('dbotestresultapproval');
    await knex.schema.dropTableIfExists('dbosystemsecurity');
    await knex.schema.dropTableIfExists('dbogeneraltesteditcount');
    await knex.schema.dropTableIfExists('dboexpensecategory');
    await knex.schema.dropTableIfExists('dbobillingrefundtable');
    await knex.schema.dropTableIfExists('additionalservices');
    // Drop services and transactions tables
    await knex.schema.dropTableIfExists('dboservices_audit');
    await knex.schema.dropTableIfExists('dboservices');
    // Drop billing and financial tables
    await knex.schema.dropTableIfExists('billing_audit');
    await knex.schema.dropTableIfExists('billinghx');
    await knex.schema.dropTableIfExists('billingtemporarytable');
    await knex.schema.dropTableIfExists('billingstrategy_tests');
    await knex.schema.dropTableIfExists('billingstrategy_mapping');
    await knex.schema.dropTableIfExists('billingstrategy');
    await knex.schema.dropTableIfExists('billing');
    // Drop test/service related tables
    await knex.schema.dropTableIfExists('control_parameters');
    await knex.schema.dropTableIfExists('control_materials');
    await knex.schema.dropTableIfExists('devices');
    await knex.schema.dropTableIfExists('field_constraints');
    await knex.schema.dropTableIfExists('customtestcreation');
    // Drop inventory and stock tables
    await knex.schema.dropTableIfExists('departmentstocks');
    await knex.schema.dropTableIfExists('departments');
    await knex.schema.dropTableIfExists('commodity');
    await knex.schema.dropTableIfExists('generalstocks');
    // Drop patient/clinician tables
    await knex.schema.dropTableIfExists('clinician_packages');
    await knex.schema.dropTableIfExists('clinicianscredentials');
    await knex.schema.dropTableIfExists('clinicianpaymentinfo');
    await knex.schema.dropTableIfExists('clinicianbasicinfo');
    // Drop organization/branch tables
    await knex.schema.dropTableIfExists('branch');
    // Drop user/employee tables
    await knex.schema.dropTableIfExists('hr_auditlogs');
    await knex.schema.dropTableIfExists('hr_performancemetrics');
    await knex.schema.dropTableIfExists('hr_workflowassignments');
    await knex.schema.dropTableIfExists('hr_trainingrecords');
    await knex.schema.dropTableIfExists('hr_rolespermissions');
    await knex.schema.dropTableIfExists('hr_employeemergencycontacts');
    await knex.schema.dropTableIfExists('hr_employeelogincredentials');
    // Drop basic reference/lookup tables
    await knex.schema.dropTableIfExists('districts');
    await knex.schema.dropTableIfExists('drugs');
    await knex.schema.dropTableIfExists('drugscategory');
    await knex.schema.dropTableIfExists('generalledger');
    await knex.schema.dropTableIfExists('accounts');
    await knex.schema.dropTableIfExists('companydaystimeschedule');
    await knex.schema.dropTableIfExists('companyprofile');
    await knex.schema.dropTableIfExists('applicationsettings');
}
exports.down = down;
