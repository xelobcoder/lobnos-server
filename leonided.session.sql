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
      (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,
      CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) AS fullname
   FROM 
      TEST_ASCENSION AS ta 
      INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
      INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
   WHERE ta.ready = 'true' AND DATE(ta.ready_date) = '2023-05-11'
   GROUP BY
      ta.billingid
   ORDER BY ta.billingid DESC LIMIT 100


