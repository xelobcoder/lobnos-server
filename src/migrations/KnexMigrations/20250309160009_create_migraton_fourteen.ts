exports.up = async function (knex) {
     // Example: Adding unique constraint "clinicianid" on billingstrategy if it doesn't exist.
     const [rows1] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'billingstrategy' 
      AND index_name = 'clinicianid'
  `);
     if (rows1[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE billingstrategy 
      ADD UNIQUE KEY clinicianid (associatedid)
    `);
     }

     // Next, add unique key on (associatedid, category) on billingstrategy if not exists.
     const [rows2] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'billingstrategy' 
      AND index_name = 'associatedid'
  `);
     if (rows2[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE billingstrategy 
      ADD UNIQUE KEY associatedid (associatedid, category)
    `);
     }

     // Check for unique key "phone" on clinicianbasicinfo.
     const [rows3] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'clinicianbasicinfo' 
      AND index_name = 'phone'
  `);
     if (rows3[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE clinicianbasicinfo 
      ADD UNIQUE KEY phone (phone)
    `);
     }

     // Check for unique key "clinicianid" on clinicianscredentials.
     const [rows4] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'clinicianscredentials' 
      AND index_name = 'clinicianid'
  `);
     if (rows4[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE clinicianscredentials 
      ADD UNIQUE KEY clinicianid (clinicianid)
    `);
     }

     // Check for unique key "email" on clinicianscredentials.
     const [rows5] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'clinicianscredentials' 
      AND index_name = 'email'
  `);
     if (rows5[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE clinicianscredentials 
      ADD UNIQUE KEY email (identifier)
    `);
     }

     // Check for unique key "clinician_id" on clinician_packages.
     const [rows6] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'clinician_packages' 
      AND index_name = 'clinician_id'
  `);
     if (rows6[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE clinician_packages 
      ADD UNIQUE KEY clinician_id (clinician_id, package_id)
    `);
     }

     // Check for key "package_id" on clinician_packages.
     const [rows7] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'clinician_packages' 
      AND index_name = 'package_id'
  `);
     if (rows7[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE clinician_packages 
      ADD KEY package_id (package_id)
    `);
     }

     // Check for key "fk_refund_service_constraint" on dbobillingrefundtable.
     const [rows8] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'dbobillingrefundtable' 
      AND index_name = 'fk_refund_service_constraint'
  `);
     if (rows8[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE dbobillingrefundtable 
      ADD KEY fk_refund_service_constraint (serviceid)
    `);
     }

     // Check for unique key "billingid" on dboservices.
     const [rows9] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'dboservices' 
      AND index_name = 'billingid'
  `);
     if (rows9[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE dboservices 
      ADD UNIQUE KEY billingid (billingid, trackId)
    `);
     }

     // Check for key "fk_vitalsign_new_patients" on dbovitalsigns.
     const [rows10] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'dbovitalsigns' 
      AND index_name = 'fk_vitalsign_new_patients'
  `);
     if (rows10[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE dbovitalsigns 
      ADD KEY fk_vitalsign_new_patients (patientid)
    `);
     }

     // Check for key "dpt_consumphx_mapper_employee" on departmentconsumptionhx.
     const [rows11] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentconsumptionhx' 
      AND index_name = 'dpt_consumphx_mapper_employee'
  `);
     if (rows11[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentconsumptionhx 
      ADD KEY dpt_consumphx_mapper_employee (employeeid)
    `);
     }

     // Check for key "dpt_consumphx_mapper_productorder" on departmentconsumptionhx.
     const [rows12] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentconsumptionhx' 
      AND index_name = 'dpt_consumphx_mapper_productorder'
  `);
     if (rows12[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentconsumptionhx 
      ADD KEY dpt_consumphx_mapper_productorder (productordersid)
    `);
     }

     // Check for key "dpt_main_tracking" on departmentmainstoresupplyproductorderlefttracking.
     const [rows13] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentmainstoresupplyproductorderlefttracking' 
      AND index_name = 'dpt_main_tracking'
  `);
     if (rows13[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentmainstoresupplyproductorderlefttracking 
      ADD KEY dpt_main_tracking (productordersid)
    `);
     }

     // Check for key "dpt_rqt_mapper_employee" on departmentrequisition.
     const [rows14] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentrequisition' 
      AND index_name = 'dpt_rqt_mapper_employee'
  `);
     if (rows14[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentrequisition 
      ADD KEY dpt_rqt_mapper_employee (requestingemployee)
    `);
     }

     // Check for key "dpt_rqt_mapper_receiving_employee" on departmentrequisition.
     const [rows15] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentrequisition' 
      AND index_name = 'dpt_rqt_mapper_receiving_employee'
  `);
     if (rows15[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentrequisition 
      ADD KEY dpt_rqt_mapper_receiving_employee (receivingemployee)
    `);
     }

     // Check for key "dpt_rqthx_mapper_employee" on departmentrequisitionhx.
     const [rows16] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentrequisitionhx' 
      AND index_name = 'dpt_rqthx_mapper_employee'
  `);
     if (rows16[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentrequisitionhx 
      ADD KEY dpt_rqthx_mapper_employee (employeeid)
    `);
     }

     // Check for key "dpt_deptreqtphx_mapper_productorder" on departmentrequisitionhx.
     const [rows17] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentrequisitionhx' 
      AND index_name = 'dpt_deptreqtphx_mapper_productorder'
  `);
     if (rows17[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentrequisitionhx 
      ADD KEY dpt_deptreqtphx_mapper_productorder (productordersid)
    `);
     }

     // Check for unique key "department" on departments.
     const [rows18] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departments' 
      AND index_name = 'department'
  `);
     if (rows18[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departments 
      ADD UNIQUE KEY department (department)
    `);
     }

     // Check for key "dept_creation_map_employee" on departments.
     const [rows19] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departments' 
      AND index_name = 'dept_creation_map_employee'
  `);
     if (rows19[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departments 
      ADD KEY dept_creation_map_employee (employeeid)
    `);
     }

     // Check for key "dpt_main_supply_map_employee" on departmentsmainsupply.
     const [rows20] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentsmainsupply' 
      AND index_name = 'dpt_main_supply_map_employee'
  `);
     if (rows20[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentsmainsupply 
      ADD KEY dpt_main_supply_map_employee (employeeid)
    `);
     }

     // Check for key "dpt_main_supply_map_productorder" on departmentsmainsupply.
     const [rows21] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'departmentsmainsupply' 
      AND index_name = 'dpt_main_supply_map_productorder'
  `);
     if (rows21[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE departmentsmainsupply 
      ADD KEY dpt_main_supply_map_productorder (productordersid)
    `);
     }

     // Check for unique key "name" on districts.
     const [rows22] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'districts' 
      AND index_name = 'name'
  `);
     if (rows22[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE districts 
      ADD UNIQUE KEY name (name, code)
    `);
     }

     // Check for unique key "name_2" on districts.
     const [rows23] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'districts' 
      AND index_name = 'name_2'
  `);
     if (rows23[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE districts 
      ADD UNIQUE KEY name_2 (name, code, regionid)
    `);
     }

     // Check for key "region_id" on districts.
     const [rows24] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'districts' 
      AND index_name = 'region_id'
  `);
     if (rows24[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE districts 
      ADD KEY region_id (regionid)
    `);
     }

     // Check for unique key "drug" on drugs.
     const [rows25] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'drugs' 
      AND index_name = 'drug'
  `);
     if (rows25[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE drugs 
      ADD UNIQUE KEY drug (drug, category)
    `);
     }

     // Check for key "fk_drugs_map_category" on drugs.
     const [rows26] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'drugs' 
      AND index_name = 'fk_drugs_map_category'
  `);
     if (rows26[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE drugs 
      ADD KEY fk_drugs_map_category (category)
    `);
     }

     // Check for unique key "categoryName" on drugscategory.
     const [rows27] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'drugscategory' 
      AND index_name = 'categoryName'
  `);
     if (rows27[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE drugscategory 
      ADD UNIQUE KEY categoryName (categoryName)
    `);
     }

     // Check for unique key "employeeid" on employeepreferredshifts.
     const [rows28] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'employeepreferredshifts' 
      AND index_name = 'employeeid'
  `);
     if (rows28[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE employeepreferredshifts 
      ADD UNIQUE KEY employeeid (employeeid, shiftid)
    `);
     }

     // Check for key "shiftid" on employeepreferredshifts.
     const [rows29] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'employeepreferredshifts' 
      AND index_name = 'shiftid'
  `);
     if (rows29[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE employeepreferredshifts 
      ADD KEY shiftid (shiftid)
    `);
     }

     // Check for unique key "employeeid" on employeeunavailabledays.
     const [rows30] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'employeeunavailabledays' 
      AND index_name = 'employeeid'
  `);
     if (rows30[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE employeeunavailabledays 
      ADD UNIQUE KEY employeeid (employeeid)
    `);
     }

     // Check for unique key "employeeid_2" on employeeunavailabledays.
     const [rows31] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'employeeunavailabledays' 
      AND index_name = 'employeeid_2'
  `);
     if (rows31[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE employeeunavailabledays 
      ADD UNIQUE KEY employeeid_2 (employeeid)
    `);
     }

     // Check for primary key on expensesrecord.
     const [rows32] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'expensesrecord'
      AND constraint_type = 'PRIMARY KEY'
  `);
     if (rows32[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE expensesrecord 
      ADD PRIMARY KEY (id)
    `);
     }

     // Check for primary key on generalemailsettings.
     const [rows33] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalemailsettings'
      AND constraint_type = 'PRIMARY KEY'
  `);
     if (rows33[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalemailsettings 
      ADD PRIMARY KEY (id)
    `);
     }

     // Check for unique key "transactionId" on generalledger.
     const [rows34] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalledger' 
      AND index_name = 'transactionId'
  `);
     if (rows34[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalledger 
      ADD UNIQUE KEY transactionId (transactionId, accountId, subAccountId, type)
    `);
     }

     // Check for key "generalledger_ibfk_1" on generalledger.
     const [rows35] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalledger' 
      AND index_name = 'generalledger_ibfk_1'
  `);
     if (rows35[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalledger 
      ADD KEY generalledger_ibfk_1 (accountId)
    `);
     }

     // Check for key "generalledger_ibfk_2" on generalledger.
     const [rows36] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalledger' 
      AND index_name = 'generalledger_ibfk_2'
  `);
     if (rows36[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalledger 
      ADD KEY generalledger_ibfk_2 (subAccountId)
    `);
     }

     // Check for primary key on generalstocks.
     const [rows37] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstocks'
      AND constraint_type = 'PRIMARY KEY'
  `);
     if (rows37[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstocks 
      ADD PRIMARY KEY (stockid)
    `);
     }

     // Check for primary key on generalstorecredithx.
     const [rows38] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstorecredithx'
      AND constraint_type = 'PRIMARY KEY'
  `);
     if (rows38[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstorecredithx 
      ADD PRIMARY KEY (id)
    `);
     }

     // Check for key "general_credit_mapper_orders" on generalstorecredithx.
     const [rows39] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstorecredithx' 
      AND index_name = 'general_credit_mapper_orders'
  `);
     if (rows39[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstorecredithx 
      ADD KEY general_credit_mapper_orders (productordersid)
    `);
     }

     // Check for key "general_credit_mapper_stockid" on generalstorecredithx.
     const [rows40] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstorecredithx' 
      AND index_name = 'general_credit_mapper_stockid'
  `);
     if (rows40[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstorecredithx 
      ADD KEY general_credit_mapper_stockid (stockid)
    `);
     }

     // Check for primary key on generalstoredebithx.
     const [rows41] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstoredebithx'
      AND constraint_type = 'PRIMARY KEY'
  `);
     if (rows41[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstoredebithx 
      ADD PRIMARY KEY (id)
    `);
     }

     // Check for key "general_debit_mapper_orders" on generalstoredebithx.
     const [rows42] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstoredebithx' 
      AND index_name = 'general_debit_mapper_orders'
  `);
     if (rows42[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstoredebithx 
      ADD KEY general_debit_mapper_orders (productordersid)
    `);
     }

     // Check for key "general_debit_mapper_stockid" on generalstoredebithx.
     const [rows43] = await knex.raw(`
    SELECT COUNT(*) as cnt 
    FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'generalstoredebithx' 
      AND index_name = 'general_debit_mapper_stockid'
  `);
     if (rows43[0].cnt === 0) {
          await knex.raw(`
      ALTER TABLE generalstoredebithx 
      ADD KEY general_debit_mapper_stockid (stockid)
    `);
     }
};

exports.down = async function (knex) {
    
};
