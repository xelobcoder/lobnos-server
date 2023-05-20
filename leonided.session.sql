-- SELECT p.PATIENTID,p.BILLINGID,p.TEST from performing_test AS p
-- WHERE p.
-- SELECT * from performing_test

-- SELECT CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS Fullname,
--  ta.billingid,
--  ta.ready,
--  ta.ready_date,
--  tp.NAME as TEST,
--  pt.PATIENTID,
--  ta.testid,
--  pt.TEST AS TESTGROUP,
--  b.OUTSTANDING AS OutstandingBill,
--  CASE 
--    WHEN b.OUTSTANDING = 0 THEN '1'
--    WHEN b.OUTSTANDING > 0 THEN '0'
--  ELSE '-1'
--  END AS printValue
-- FROM test_ascension AS ta
--  INNER JOIN performing_test as pt ON ta.billingid = pt.BILLINGID
--  INNER JOIN test_panels AS tp ON tp.ID = ta.testid
--  INNER JOIN new_patients AS np ON np.PATIENTID = pt.PATIENTID
--  INNER JOIN billing AS b ON b.BILLINGID = pt.BILLINGID
-- WHERE ta.ready = 'true'
-- GROUP BY ta.testid
-- ORDER BY ta.ready_date ASC 


-- SELECT * 
-- b.PAID_AMOUNT as PAID_AMOUNT,
-- b.PAYABLE AS PAYABLE,
-- b.DISCOUNT,
-- b.ORGANIZATION AS ORGANIZATION,
-- b.CLINICIAN AS CLINICIAN,
-- b.PAYMENT_MODE as PAYMENT_MODE,
-- b.OUTSTANDING AS OUTSTANDING,
-- b.BILLED_ON AS BILLED_ON,
-- p.PATIENTID AS PATIENTID,
-- p.TEST AS TEST,
-- p.DATE AS DATE,
-- p.BILLINGID AS BILLINGID,
-- p.SAMPLE_STATUS as SAMPLE_STATUS,
-- -- p.INSPECTION_TIME AS INSPECTION_TIME
--  FROM billing as b INNER JOIN performing_test as p ON b.BILLINGID = p.BILLINGID INNER JOIN new_patients as n ON b.
-- PATIENTID = n.PATIENTID 
-- INNER JOIN test_ascension AS ta ON ta.billingid = p.BILLINGID
-- WHERE b.BILLINGID = 31



SELECT * FROM test_panels  AS tp INNER JOIN test_ascension as ta ON tp.ID = ta.testid WHERE ta.billingid = 31
