SELECT 
    ta.billingid,
    ta.ready,
    ta.ready_date,
    b.OUTSTANDING,
    b.PAID_AMOUNT,
    np.PATIENTID,
    COUNT(ta.testid) AS TESTCOUNT,
    (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid AND ready = 'true') AS READYCOUNT,
    CONCAT(np.FIRSTNAME, " ", np.MIDDLENAME, " ", np.LASTNAME) AS FULLNAME
FROM 
    TEST_ASCENSION AS ta 
    INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
    INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
GROUP BY
    ta.billingid
ORDER BY ta.billingid DESC LIMIT 100
