--  SELECT 
--           ta.billingid AS billingid,
--       CASE
--          WHEN COUNT(ta.testid) = (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Ready'
--          WHEN COUNT(ta.testid) < (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Partial'
--          ELSE 'Unknown'
--       END AS status,
--          ta.ready,
--          ta.ready_date,
--          b.OUTSTANDING AS outstanding,
--          b.PAID_AMOUNT AS paid_amount,
--          np.PATIENTID AS patientid,
--          COUNT(ta.testid) AS readycount,
--          (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,
--       CASE 
--         WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
--         WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) 
--         END AS fullname
--       FROM 
--          TEST_ASCENSION AS ta 
--          INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
--          INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
--       WHERE 
--          ta.ready = 'true' and ta.ApprovalStatus = 1 
--          GROUP BY b.BILLINGID
--          HAVING DATE(ta.ready_date) BETWEEN  '2023-07-19' AND '2023-07-26'
--          ORDER BY b.BILLINGID DESC LIMIT 100

  SELECT
              ta.billingid AS billingid,
          CASE
            WHEN COUNT(ta.testid) = (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Ready'
            WHEN COUNT(ta.testid) < (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Partial'
            ELSE 'Unknown'
          END AS status,
            ta.ready,
            ta.ready_date,
            b.OUTSTANDING AS outstanding,
            b.PAID_AMOUNT AS paid_amount,
            np.PATIENTID AS patientid,
            COUNT(ta.testid) AS readycount,
            (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,          CASE
            WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
            WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME)
            END AS fullname
          FROM
            TEST_ASCENSION AS ta
            INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
            INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
          WHERE
            ta.ready = 'true' and ta.ApprovalStatus = 1
    GROUP BY b.billingid HAVING DATE(ta.ready_date) BETWEEN '2023-07-19' AND '2023-07-26' ORDER BY b.billingid DESC LIMIT 100