exports.up = async function (knex) {
    await knex.raw(`CREATE TABLE test_results (
        id int NOT NULL AUTO_INCREMENT,
        field varchar(100) NOT NULL,
        ascensionid int unsigned NOT NULL,
        billingid int NOT NULL,
        patientid int unsigned NOT NULL,
        testid int NOT NULL,
        fieldid int NOT NULL,
        value varchar(60),
        originalvalue varchar(60),
        created_on datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
        updated_on datetime(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        employeeid int NOT NULL,
        entrymode enum('manual', 'automatic') DEFAULT 'manual',
        PRIMARY KEY (id, created_on),
        
        INDEX idx_ascensionid (ascensionid),
                INDEX idx_as_field(ascensionid,field),
        INDEX idx_testid (testid),
        INDEX idx_billingid (billingid),
        INDEX idx_created_on (created_on),
        INDEX idx_billingid_patientid (billingid, patientid),
         INDEX idxm_check_test_exist(billingid,field,ascensionid,patientid,testid)
    )
    PARTITION BY RANGE COLUMNS(created_on) (
        PARTITION p_jan_2025 VALUES LESS THAN ('2025-02-01'),
        PARTITION p_feb_2025 VALUES LESS THAN ('2025-03-01'),
        PARTITION p_mar_2025 VALUES LESS THAN ('2025-04-01'),
        PARTITION p_apr_2025 VALUES LESS THAN ('2025-05-01'),
        PARTITION p_may_2025 VALUES LESS THAN ('2025-06-01'),
        PARTITION p_jun_2025 VALUES LESS THAN ('2025-07-01'),
        PARTITION p_jul_2025 VALUES LESS THAN ('2025-08-01'),
        PARTITION p_aug_2025 VALUES LESS THAN ('2025-09-01'),
        PARTITION p_sep_2025 VALUES LESS THAN ('2025-10-01'),
        PARTITION p_oct_2025 VALUES LESS THAN ('2025-11-01'),
        PARTITION p_nov_2025 VALUES LESS THAN ('2025-12-01'),
        PARTITION p_dec_2025 VALUES LESS THAN ('2026-01-01'),
        PARTITION p_future VALUES LESS THAN MAXVALUE
    );`);
    await knex.raw(`CREATE TABLE test_results_audit_log (
        id int NOT NULL AUTO_INCREMENT,
        field varchar(100) NOT NULL,
        ascensionid int unsigned NOT NULL,
        billingid int NOT NULL,
        patientid int unsigned NOT NULL,
        testid int NOT NULL,
        previous_value varchar(60),
        previous_originalvalue varchar(60),
        employeeid int NOT NULL,
        fieldid int NOT NULL,
        entrymode enum('manual', 'automatic') DEFAULT 'manual',
        created_on datetime(6) DEFAULT CURRENT_TIMESTAMP(6),
        action_type enum('UPDATE', 'DELETE') NOT NULL,
        PRIMARY KEY (id, created_on),
  
        INDEX idx_ascensionid (ascensionid),
        INDEX idx_as_field(ascensionid,field),
        INDEX idx_testid (testid),
        INDEX idx_billingid (billingid),
        INDEX idx_created_on (created_on),
        INDEX idx_fieldid (fieldid),
        INDEX idxp_check_test_exist(billingid,field,ascensionid,patientid,testid)
    )
    PARTITION BY RANGE COLUMNS(created_on) (
        PARTITION p_jan_2025 VALUES LESS THAN ('2025-02-01'),
        PARTITION p_feb_2025 VALUES LESS THAN ('2025-03-01'),
        PARTITION p_mar_2025 VALUES LESS THAN ('2025-04-01'),
        PARTITION p_apr_2025 VALUES LESS THAN ('2025-05-01'),
        PARTITION p_may_2025 VALUES LESS THAN ('2025-06-01'),
        PARTITION p_jun_2025 VALUES LESS THAN ('2025-07-01'),
        PARTITION p_jul_2025 VALUES LESS THAN ('2025-08-01'),
        PARTITION p_aug_2025 VALUES LESS THAN ('2025-09-01'),
        PARTITION p_sep_2025 VALUES LESS THAN ('2025-10-01'),
        PARTITION p_oct_2025 VALUES LESS THAN ('2025-11-01'),
        PARTITION p_nov_2025 VALUES LESS THAN ('2025-12-01'),
        PARTITION p_dec_2025 VALUES LESS THAN ('2026-01-01'),
        PARTITION p_future VALUES LESS THAN MAXVALUE
    );`);
    await knex.raw(`
        CREATE TRIGGER after_test_results_update
        AFTER UPDATE ON test_results
        FOR EACH ROW
        BEGIN
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
                created_on
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
                NOW(6)
            );
        END;
    `);
    await knex.raw(`
        CREATE TRIGGER after_test_results_delete
        AFTER DELETE ON test_results
        FOR EACH ROW
        BEGIN
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
                created_on
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
                NOW(6)
            );
        END;
    `);
};
exports.down = async function (knex) {
    await knex.raw('DROP TRIGGER IF EXISTS after_test_results_update');
    await knex.raw('DROP TRIGGER IF EXISTS after_test_results_delete');
    await knex.schema.dropTableIfExists('test_results_audit_log');
    await knex.schema.dropTableIfExists('test_results');
};
