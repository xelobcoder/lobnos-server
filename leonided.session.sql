 SELECT DISTINCT
    CASE
        WHEN MIDDLENAME IS NULL THEN CONCAT(
            np.FIRSTNAME,
            ' ',
            np.LASTNAME
          )  ELSE CONCAT(  np.FIRSTNAME,
            ' ',
            np.MIDDLENAME,
            ' ',
            np.LASTNAME) END AS FULLNAME,
    np.PATIENTID,
    pt.BILLINGID,
    pt.DATE,
    ta.ready,
    tp.NAME,
    tp.ID AS TESTID,
    tp.CATEGORY,d.department
  FROM new_patients as np
    INNER JOIN performing_test as pt ON np.PATIENTID = pt.PATIENTID
    INNER JOIN samplestatus AS ss ON ss.billingid = pt.BILLINGID
    INNER JOIN test_ascension AS ta ON ta.billingid = pt.BILLINGID
    INNER JOIN test_panels AS tp ON tp.ID = ss.testid
    INNER JOIN departments AS d ON d.ID = tp.CATEGORY
  WHERE ta.ready = 'true' AND d.department = 'ultrasound' OR (np.FIRSTNAME LIKE '%tiifu' AND ta.ready = 'true' AND d.department = 'ultrasound')
      OR (np.LASTNAME LIKE '%tiifu' AND d.department = 'ultrasound' AND ta.ready = 'true')
      OR (np.MOBILE_NUMBER ='%tiifu' AND ta.ready = 'true' AND d.department = 'ultrasound') GROUP BY pt.BILLINGID ORDER BY pt.BILLINGID 
DESC LIMIT 15