import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
     await knex.raw(`
    CREATE TRIGGER \`DeleteTriggersForBilling\` AFTER DELETE ON \`billing\`
     FOR EACH ROW BEGIN
        DELETE FROM billinghx WHERE billingid = OLD.BILLINGID;
        DELETE FROM dboServices WHERE billingid = OLD.BILLINGID;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`afinliteraturereview\` AFTER INSERT ON \`test_panels\`
     FOR EACH ROW BEGIN
              INSERT INTO setupliteraturereview (testid) VALUES (NEW.id);
      END
  `);

     await knex.raw(`
    CREATE TRIGGER \`after_medicalrecord_update\` AFTER UPDATE ON \`medicalrecords\`
     FOR EACH ROW BEGIN
        INSERT INTO medicalrecordsaudit (
            auditid,
            complaints,
            hpc,
            pmh,
            sh,
            odq,
            dhx,
            se,
            fh,
            obsGynecHistory,
            oe,
            record_type,
            created_at,
            consulationby
        )
        VALUES (
            UUID(),
            NEW.complaints,
            NEW.hpc,
            NEW.pmh,
            NEW.sh,
            NEW.odq,
            NEW.dhx,
            NEW.se,
            NEW.fh,
            NEW.obsGynecHistory,
            NEW.oe,
            NEW.record_type,
            NOW(),
            NEW.consulationby
        );
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`after_test_ascension_insert_result_lock\` AFTER INSERT ON \`test_ascension\`
     FOR EACH ROW BEGIN
        INSERT INTO result_lock (ascensionid, isResultLock, created_at, updated_at)
        VALUES (NEW.id, FALSE, NOW(), NOW());
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`after_test_results_delete\` AFTER DELETE ON \`test_results\`
     FOR EACH ROW BEGIN
        INSERT INTO test_results_audit_log (
            previous_value,
            previous_originalvalue,
            billingid,
            patientid,
            testid,
            ascensionid,
            field,
            fieldid,
            employeeid,
            entrymode,
            action_type,
            created_on,
            edit_session_id
        ) VALUES (
            OLD.value,
            OLD.originalvalue,
            OLD.billingid,
            OLD.patientid,
            OLD.testid,
            OLD.ascensionid,
            OLD.field,
            OLD.id,
            OLD.employeeid,
            OLD.entrymode,
            'DELETE',
            NOW(6),
            OLD.edit_session_id
        );
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`after_test_results_update\` AFTER UPDATE ON \`test_results\`
     FOR EACH ROW BEGIN
        INSERT INTO test_results_audit_log (
            previous_value,
            previous_originalvalue,
            billingid,
            patientid,
            testid,
            ascensionid,
            field,
            fieldid,
            employeeid,
            entrymode,
            action_type,
            created_on,
            edit_session_id
        ) VALUES (
            OLD.value,
            OLD.originalvalue,
            OLD.billingid,
            OLD.patientid,
            OLD.testid,
            OLD.ascensionid,
            OLD.field,
            OLD.id,
            OLD.employeeid,
            OLD.entrymode,
            'UPDATE',
            NOW(6),
            OLD.edit_session_id
        );
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`autoAddClients\` AFTER INSERT ON \`new_patients\`
     FOR EACH ROW BEGIN
        INSERT INTO patients_credentials(PATIENTID,USERNAME,PASSWORD)
        VALUES(NEW.PATIENTID,CONCAT(NEW.FIRSTNAME,NEW.LASTNAME),CONCAT(NEW.FIRSTNAME,NEW.LASTNAME,NEW.PATIENTID));

        INSERT INTO patientemmergencycontactinformation(patientid) VALUES (NEW.patientid);

        INSERT INTO patientsaddress(patientid)VALUES (NEW.patientid);

        INSERT INTO patients_settings(PATIENTID)VALUES(NEW.PATIENTID);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`autoDeleteClient\` AFTER DELETE ON \`new_patients\`
     FOR EACH ROW BEGIN
        DELETE FROM patientemmergencycontactinformation WHERE patientid = OLD.PATIENTID;

        DELETE FROM patients_settings WHERE patientid = OLD.PATIENTID;

        DELETE FROM patients_credentials WHERE patientid = OLD.PATIENTID;

        DELETE FROM patientsaddress WHERE patientid = OLD.PATIENTID;
     END
  `);

     await knex.raw(`
    CREATE TRIGGER \`createIndentifier\` BEFORE INSERT ON \`clinicianbasicinfo\`
     FOR EACH ROW BEGIN
        DECLARE last_id INT;
        DECLARE counter INT;

        SELECT COUNT(*) INTO counter FROM clinicianbasicinfo;

        IF counter = 0 THEN
            SET NEW.identifier =CONCAT('PLS', 0001, YEAR(CURRENT_DATE));
            ELSE
                -- Fetch the last inserted id
        SELECT id INTO last_id FROM clinicianbasicinfo ORDER BY id DESC LIMIT 1;
                SET NEW.identifier = CONCAT('PLS', last_id + 1,YEAR(CURRENT_DATE));
                END IF;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`expensesrecord_after_update\` AFTER UPDATE ON \`expensesrecord\`
     FOR EACH ROW BEGIN
      INSERT INTO \`expensesrecord_audit_log\` (
        \`uid\`,
        \`operation\`,
        \`record_id\`,
        \`old_data\`,
        \`new_data\`,
        \`changed_by\`,
        \`client_ip\`
      )
      VALUES (
        UUID(), -- Generate a unique identifier
        'UPDATE',
        NEW.id,
        -- OLD DATA
        JSON_OBJECT(
          'name', OLD.name,
          'date', OLD.date,
          'merchant', OLD.merchant,
          'amount', OLD.amount,
          'category', OLD.category,
          'description', OLD.description,
          'employeeid', OLD.employeeid,
          'branchid', OLD.branchid,
          'createdon', OLD.createdon,
          'approved', OLD.approved,
          'approvedby', OLD.approvedby,
          'approvedon', OLD.approvedon,
          'rejectionmessage', OLD.rejectionmessage,
          'isassociatedservice', OLD.isassociatedservice,
          'serviceid', OLD.serviceid
        ),
        -- NEW DATA
        JSON_OBJECT(
          'name', NEW.name,
          'date', NEW.date,
          'merchant', NEW.merchant,
          'amount', NEW.amount,
          'category', NEW.category,
          'description', NEW.description,
          'employeeid', NEW.employeeid,
          'branchid', NEW.branchid,
          'createdon', NEW.createdon,
          'approved', NEW.approved,
          'approvedby', NEW.approvedby,
          'approvedon', NEW.approvedon,
          'rejectionmessage', NEW.rejectionmessage,
          'isassociatedservice', NEW.isassociatedservice,
          'serviceid', NEW.serviceid
        ),
        NULL, -- changed_by (fill with session/user id if available)
        NULL -- client_ip (fill with application-provided IP if available)
      );
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`insertIntoContactNaccount\` AFTER INSERT ON \`organization\`
     FOR EACH ROW BEGIN
        INSERT INTO organizationcontactperson(organizationid) VALUE(NEW.id);
        INSERT INTO organizationaccountinformation (organizationid) VALUE(NEW.id);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`insertIntoDboTestApprovalTable2\` AFTER INSERT ON \`test_ascension\`
     FOR EACH ROW BEGIN
        DECLARE settings_json JSON;
        DECLARE min_validation INT DEFAULT 1;
        DECLARE max_validation INT DEFAULT 2;

        -- Get the resultsettings JSON from the relevant table
        SELECT resultsEntrySettings INTO settings_json
        FROM resultsettings
        WHERE id = 1;

        -- Extract values from the JSON if available
        IF settings_json IS NOT NULL THEN
            SET min_validation = COALESCE(
                CAST(JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.minimumResultValidation')) AS UNSIGNED),
                1
            );

            SET max_validation = COALESCE(
                CAST(JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.maximumResultValidation')) AS UNSIGNED),
                2
            );
        END IF;

        -- Insert into the approval table
        INSERT INTO dbotestresultapproval (ascensionid, minvalidation, maxvalidation)
        VALUES (NEW.id, min_validation, max_validation);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`insertIntoServicesTracking\` AFTER INSERT ON \`dboservices\`
     FOR EACH ROW BEGIN
        IF (NEW.serviceCategory = 'SERVICES' AND NEW.categoryTrackId = 5)
        THEN INSERT INTO servicestracking (serviceid) VALUE(NEW.serviceid);
        END IF;

        INSERT INTO dbobillingrefundtable(serviceid) VALUE(NEW.serviceid);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`insertintooutsourceTraking\` AFTER INSERT ON \`dboservices\`
     FOR EACH ROW BEGIN
        IF (NEW.isoutsourced = 1 AND NEW.outsourceid > 0)
        THEN INSERT INTO outsourcedtesttracking (serviceid, testid,outsourceid,employeeid) VALUE(NEW.serviceid, NEW.trackId, NEW.outsourceid,NEW.employeeid);
        END IF;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`inserttestdetails\` AFTER INSERT ON \`test_panels\`
     FOR EACH ROW BEGIN
        INSERT INTO testdetails (testid,testcost)VALUES(NEW.id,NEW.price);

        IF NEW.iscustom = 1 THEN
          INSERT INTO customtestcreation(testid) VALUES (NEW.id);
        END IF;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`inserttogeneraleditcounttable\` AFTER INSERT ON \`test_ascension\`
     FOR EACH ROW BEGIN
        INSERT INTO dbogeneraltesteditcount (ascensionid,billingid) VALUES(NEW.id, NEW.billingid);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`onDelete\` AFTER DELETE ON \`test_ascension\`
     FOR EACH ROW BEGIN
        DELETE FROM samplestatus WHERE ascensionid = OLD.id;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`onDeleteClinician\` AFTER DELETE ON \`clinicianbasicinfo\`
     FOR EACH ROW BEGIN
        DELETE FROM clinicianpaymentinfo WHERE CLINICIANID = OLD.ID;
        DELETE FROM clinicianscredentials WHERE  CLINICIANID = OLD.ID;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`onInsertClinician\` AFTER INSERT ON \`clinicianbasicinfo\`
     FOR EACH ROW BEGIN
        INSERT INTO clinicianpaymentinfo (clinicianid)
        VALUE(NEW.ID);

        INSERT INTO clinicianscredentials(clinicianid,identifier)
        VALUE(NEW.ID,NEW.identifier);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`ontestdelete\` AFTER DELETE ON \`test_panels\`
     FOR EACH ROW BEGIN
        DELETE FROM testdetails WHERE testid =  OLD.id;

        IF OLD.iscustom = 1 THEN
        DELETE FROM customtestcreation WHERE testid = OLD.id;
        END IF;
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`outsource_contract_trigger\` AFTER INSERT ON \`outsourcingorganization\`
     FOR EACH ROW BEGIN
        INSERT INTO outsourceorganizationcontract (outsourceid,createdby)
        VALUE(NEW.outsourceid,NEW.outsourceCreatedBy);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`samplestatus\` AFTER INSERT ON \`test_ascension\`
     FOR EACH ROW BEGIN
        INSERT INTO samplestatus(testid,approvalstatus,ascensionid) VALUES(NEW.testid,NULL,NEW.id);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`testidgeneration\` BEFORE INSERT ON \`test_panels\`
     FOR EACH ROW BEGIN
        DECLARE last_id INT DEFAULT 101; -- Default starting value
        DECLARE max_id INT;

        -- Get the highest numeric part of existing IDs
        SELECT MAX(CAST(SUBSTRING(prim_key, 4) AS UNSIGNED)) INTO max_id
        FROM test_panels
        WHERE prim_key LIKE '100%' AND prim_key REGEXP '^100[0-9]+$';

        -- If valid IDs found, use the max + 1
        IF max_id IS NOT NULL AND max_id >= 101 THEN
            SET last_id = max_id;
        END IF;

        -- Find the first available ID if there are gaps
        SET last_id = last_id + 1;

        -- Ensure the ID doesn't already exist (in case of gaps or manual inserts)
        WHILE EXISTS (SELECT 1 FROM test_panels WHERE id = CONCAT('100', last_id)) DO
            SET last_id = last_id + 1;
        END WHILE;

        -- Set the new ID
        SET NEW.id = CONCAT('100', last_id);
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`tr_expensesrecord_delete_audit\` AFTER DELETE ON \`expensesrecord\`
     FOR EACH ROW BEGIN
      INSERT INTO \`expensesrecord_audit_log\` (
        \`uid\`,
        \`operation\`,
        \`record_id\`,
        \`old_data\`,
        \`changed_by\`,
        \`client_ip\`
      )
      VALUES (
        UUID(),
        'DELETE',
        OLD.id,
        JSON_OBJECT(
          'name', OLD.name,
          'date', OLD.date,
          'merchant', OLD.merchant,
          'amount', OLD.amount,
          'category', OLD.category,
          'description', OLD.description,
          'employeeid', OLD.employeeid,
          'branchid', OLD.branchid,
          'createdon', OLD.createdon,
          'approved', OLD.approved,
          'approvedby', OLD.approvedby,
          'approvedon', OLD.approvedon,
          'rejectionmessage', OLD.rejectionmessage,
          'isassociatedservice', OLD.isassociatedservice,
          'serviceid', OLD.serviceid
        ),
        NULL, -- Replace with actual user ID if available
        NULL  -- Replace with actual client IP if available
      );
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`tr_expensesrecord_insert_audit\` AFTER INSERT ON \`expensesrecord\`
     FOR EACH ROW BEGIN
      INSERT INTO \`expensesrecord_audit_log\` (
        \`uid\`,
        \`operation\`,
        \`record_id\`,
        \`new_data\`,
        \`changed_by\`,
        \`client_ip\`
      )
      VALUES (
        UUID(), -- Generate a unique identifier
        'INSERT',
        NEW.id,
        JSON_OBJECT(
          'name', NEW.name,
          'date', NEW.date,
          'merchant', NEW.merchant,
          'amount', NEW.amount,
          'category', NEW.category,
          'description', NEW.description,
          'employeeid', NEW.employeeid,
          'branchid', NEW.branchid,
          'createdon', NEW.createdon,
          'approved', NEW.approved,
          'approvedby', NEW.approvedby,
          'approvedon', NEW.approvedon,
          'rejectionmessage', NEW.rejectionmessage,
          'isassociatedservice', NEW.isassociatedservice,
          'serviceid', NEW.serviceid
        ),
        NULL, -- Replace with actual user ID if available (e.g., SESSION_USER_ID)
        NULL  -- Replace with actual client IP if available
      );
    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`trg_billing_delete\` AFTER DELETE ON \`billing\`
     FOR EACH ROW BEGIN
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

     await knex.raw(`
    CREATE TRIGGER \`trg_billing_insert\` AFTER INSERT ON \`billing\`
     FOR EACH ROW BEGIN
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

     await knex.raw(`
    CREATE TRIGGER \`trg_billing_update\` AFTER UPDATE ON \`billing\`
     FOR EACH ROW BEGIN
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

     await knex.raw(`
    CREATE TRIGGER \`trg_dboservices_delete\` AFTER DELETE ON \`dboservices\`
     FOR EACH ROW BEGIN
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
    CREATE TRIGGER \`trg_dboservices_insert\` AFTER INSERT ON \`dboservices\`
     FOR EACH ROW BEGIN
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
    CREATE TRIGGER \`trg_dboservices_update\` AFTER UPDATE ON \`dboservices\`
     FOR EACH ROW BEGIN
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
    CREATE TRIGGER \`trg_update_patientfinancials_update\` AFTER UPDATE ON \`billing\`
     FOR EACH ROW BEGIN
      DECLARE billed_delta DECIMAL(10,2);
      DECLARE paid_delta DECIMAL(10,2);
      DECLARE outstanding_delta DECIMAL(10,2);
      DECLARE credit_delta DECIMAL(10,2);

      -- Calculate deltas
      SET billed_delta = NEW.totalcost - OLD.totalcost;
      SET paid_delta = NEW.paid - OLD.paid;
      SET outstanding_delta = GREATEST(NEW.outstanding, 0) - GREATEST(OLD.outstanding, 0);
      SET credit_delta = GREATEST(NEW.paid - NEW.totalcost, 0) - GREATEST(OLD.paid - OLD.totalcost, 0);

      -- Update patientfinancials
      INSERT INTO patientfinancials (
        patientid, totalbilled, totalpaid, totaloutstanding, totalcredit
      )
      VALUES (
        NEW.patientid,
        NEW.totalcost,
        NEW.paid,
        GREATEST(NEW.outstanding, 0),
        GREATEST(NEW.paid - NEW.totalcost, 0)
      )
      ON DUPLICATE KEY UPDATE
        totalbilled = totalbilled + billed_delta,
        totalpaid = totalpaid + paid_delta,
        totaloutstanding = totaloutstanding + outstanding_delta,
        totalcredit = totalcredit + credit_delta,
        lastupdated = CURRENT_TIMESTAMP;

      -- Insert audit logs (only if there's a change)
      IF billed_delta != 0 THEN
        INSERT INTO patient_financial_audit (
          patientid, billingid, action, field_changed,
          oldvalue, newvalue, delta, changedby
        )
        VALUES (
          NEW.patientid, NEW.billingid, 'billing_updated', 'totalbilled',
          OLD.totalcost, NEW.totalcost, billed_delta, NULL
        );
      END IF;

      IF paid_delta != 0 THEN
        INSERT INTO patient_financial_audit (
          patientid, billingid, action, field_changed,
          oldvalue, newvalue, delta, changedby
        )
        VALUES (
          NEW.patientid, NEW.billingid, 'billing_updated', 'totalpaid',
          OLD.paid, NEW.paid, paid_delta, NULL
        );
      END IF;

      IF outstanding_delta != 0 THEN
        INSERT INTO patient_financial_audit (
          patientid, billingid, action, field_changed,
          oldvalue, newvalue, delta, changedby
        )
        VALUES (
          NEW.patientid, NEW.billingid, 'billing_updated', 'totaloutstanding',
          GREATEST(OLD.outstanding, 0), GREATEST(NEW.outstanding, 0), outstanding_delta, NULL
        );
      END IF;

      IF credit_delta != 0 THEN
        INSERT INTO patient_financial_audit (
          patientid, billingid, action, field_changed,
          oldvalue, newvalue, delta, changedby
        )
        VALUES (
          NEW.patientid, NEW.billingid, 'billing_updated', 'totalcredit',
          GREATEST(OLD.paid - OLD.totalcost, 0),
          GREATEST(NEW.paid - NEW.totalcost, 0),
          credit_delta, NULL
        );
      END IF;

    END
  `);

     await knex.raw(`
    CREATE TRIGGER \`updateSessionTracker\` AFTER INSERT ON \`loginlogs\`
     FOR EACH ROW BEGIN
        INSERT INTO sessiontracker (employeeid,loginSessionId,logoutTime,loginhxid) VALUE(NEW.employeeid,NEW.loginSessionId,NEW.logoutTime,NEW.keyid);
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
     await knex.raw('DROP TRIGGER IF EXISTS `DeleteTriggersForBilling`');
     await knex.raw('DROP TRIGGER IF EXISTS `afinliteraturereview`');
     await knex.raw('DROP TRIGGER IF EXISTS `after_medicalrecord_update`');
     await knex.raw('DROP TRIGGER IF EXISTS `after_test_ascension_insert_result_lock`');
     await knex.raw('DROP TRIGGER IF EXISTS `after_test_results_delete`');
     await knex.raw('DROP TRIGGER IF EXISTS `after_test_results_update`');
     await knex.raw('DROP TRIGGER IF EXISTS `autoAddClients`');
     await knex.raw('DROP TRIGGER IF EXISTS `autoDeleteClient`');
     await knex.raw('DROP TRIGGER IF EXISTS `createIndentifier`');
     await knex.raw('DROP TRIGGER IF EXISTS `expensesrecord_after_update`');
     await knex.raw('DROP TRIGGER IF EXISTS `insertIntoContactNaccount`');
     await knex.raw('DROP TRIGGER IF EXISTS `insertIntoDboTestApprovalTable2`');
     await knex.raw('DROP TRIGGER IF EXISTS `insertIntoServicesTracking`');
     await knex.raw('DROP TRIGGER IF EXISTS `insertintooutsourceTraking`');
     await knex.raw('DROP TRIGGER IF EXISTS `inserttestdetails`');
     await knex.raw('DROP TRIGGER IF EXISTS `inserttogeneraleditcounttable`');
     await knex.raw('DROP TRIGGER IF EXISTS `onDelete`');
     await knex.raw('DROP TRIGGER IF EXISTS `onDeleteClinician`');
     await knex.raw('DROP TRIGGER IF EXISTS `onInsertClinician`');
     await knex.raw('DROP TRIGGER IF EXISTS `ontestdelete`');
     await knex.raw('DROP TRIGGER IF EXISTS `outsource_contract_trigger`');
     await knex.raw('DROP TRIGGER IF EXISTS `samplestatus`');
     await knex.raw('DROP TRIGGER IF EXISTS `testidgeneration`');
     await knex.raw('DROP TRIGGER IF EXISTS `tr_expensesrecord_delete_audit`');
     await knex.raw('DROP TRIGGER IF EXISTS `tr_expensesrecord_insert_audit`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_billing_delete`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_billing_insert`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_billing_update`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_dboservices_delete`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_dboservices_insert`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_dboservices_update`');
     await knex.raw('DROP TRIGGER IF EXISTS `trg_update_patientfinancials_update`');
     await knex.raw('DROP TRIGGER IF EXISTS `updateSessionTracker`');
}