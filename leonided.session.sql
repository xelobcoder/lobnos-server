-- SELECT p.PATIENTID,p.BILLINGID,p.TEST from performing_test AS p
-- WHERE p.
-- SELECT * from performing_test

SELECT CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS Fullname,
 ta.billingid,
 ta.ready,
 ta.ready_date,
 tp.NAME as TEST,
 pt.PATIENTID,
 ta.testid,
 pt.TEST AS TESTGROUP,
 b.OUTSTANDING AS OutstandingBill,
 CASE 
   WHEN b.OUTSTANDING = 0 THEN '1'
   WHEN b.OUTSTANDING > 0 THEN '0'
 ELSE '-1'
 END AS printValue
FROM test_ascension AS ta
 INNER JOIN performing_test as pt ON ta.billingid = pt.BILLINGID
 INNER JOIN test_panels AS tp ON tp.ID = ta.testid
 INNER JOIN new_patients AS np ON np.PATIENTID = pt.PATIENTID
 INNER JOIN billing AS b ON b.BILLINGID = pt.BILLINGID
WHERE ta.ready = 'true'
GROUP BY ta.testid
ORDER BY ta.ready_date ASC 


