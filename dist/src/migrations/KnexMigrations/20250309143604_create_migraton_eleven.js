exports.up = async function (knex) {
    await knex.raw(`
    CREATE TABLE test_ascension (
      id INT NOT NULL,
      testid INT NOT NULL,
      serviceid INT NOT NULL,
      billingid INT NOT NULL,
      month INT NOT NULL DEFAULT MONTH(CURDATE()),
      year INT NOT NULL DEFAULT YEAR(CURDATE()),
      ascension_date DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      collectionStartDate DATETIME(6) NULL,
      collectionEndDate DATETIME(6) NULL,
      processingStartDate DATETIME(6) NULL,
      processingEndDate DATETIME(6) NULL,
      resultEntryStart DATETIME(6) NULL,
      resultEntryEnd DATETIME(6) NULL,
      sampleCollectedBy INT  NULL,
      sampleProcessedBy INT NULL,
      resultEnteredBy INT NULL,
      PRIMARY KEY (id, ascension_date),
      INDEX billingid_index (serviceid),
      INDEX testid_index (testid),
      INDEX testid_2_index (testid, serviceid),
      INDEX collection_dates_index (collectionStartDate, collectionEndDate),
      INDEX processing_dates_index (processingStartDate, processingEndDate),
      INDEX result_entry_dates_index (resultEntryStart, resultEntryEnd),
      INDEX ascension_date_index (ascension_date)
    )
    PARTITION BY RANGE (TO_DAYS(ascension_date)) (
      PARTITION p2025_01 VALUES LESS THAN (TO_DAYS('2025-02-01')),
      PARTITION p2025_02 VALUES LESS THAN (TO_DAYS('2025-03-01')),
      PARTITION p2025_03 VALUES LESS THAN (TO_DAYS('2025-04-01')),
      PARTITION p2025_04 VALUES LESS THAN (TO_DAYS('2025-05-01')),
      PARTITION p2025_05 VALUES LESS THAN (TO_DAYS('2025-06-01')),
      PARTITION p2025_06 VALUES LESS THAN (TO_DAYS('2025-07-01')),
      PARTITION p2025_07 VALUES LESS THAN (TO_DAYS('2025-08-01')),
      PARTITION p2025_08 VALUES LESS THAN (TO_DAYS('2025-09-01')),
      PARTITION p2025_09 VALUES LESS THAN (TO_DAYS('2025-10-01')),
      PARTITION p2025_10 VALUES LESS THAN (TO_DAYS('2025-11-01')),
      PARTITION p2025_11 VALUES LESS THAN (TO_DAYS('2025-12-01')),
      PARTITION p2025_12 VALUES LESS THAN (TO_DAYS('2026-01-01')),
      PARTITION pmax VALUES LESS THAN MAXVALUE
    );
  `);
    // Triggers
    await knex.raw(`
    CREATE TRIGGER insertIntoDboTestApprovalTable 
    AFTER INSERT ON test_ascension 
    FOR EACH ROW 
   BEGIN
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
    CREATE TRIGGER inserttogeneraleditcounttable 
    AFTER INSERT ON test_ascension 
    FOR EACH ROW 
    BEGIN
      INSERT INTO dbogeneraltesteditcount(ascensionid, billingid) VALUES (NEW.billingid, NEW.id);
    END
  `);
    await knex.raw(`
    CREATE TRIGGER onDelete 
    AFTER DELETE ON test_ascension 
    FOR EACH ROW 
    BEGIN
      DELETE FROM samplestatus WHERE testid = OLD.testid AND billingid = OLD.billingid;
    END
  `);
};
exports.down = async function (knex) {
    await knex.raw('DROP TRIGGER IF EXISTS insertIntoDboTestApprovalTable');
    await knex.raw('DROP TRIGGER IF EXISTS inserttogeneraleditcounttable');
    await knex.raw('DROP TRIGGER IF EXISTS onDelete');
    await knex.raw('DROP TRIGGER IF EXISTS samplestatus');
    await knex.schema.dropTableIfExists('test_ascension');
};
