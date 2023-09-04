INSERT INTO test_ascension (testid,billingid,collection,collection_date)
VALUES(100,100,'true',CURRENT_DATE);

UPDATE samplestatus  SET approvalstatus = 1
WHERE billingid = 100 AND testid = 100