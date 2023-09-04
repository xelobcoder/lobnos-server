SELECT  CASE
    WHEN MIDDLENAME IS NULL THEN CONCAT(
      np.FIRSTNAME,
      ' ',
      np.LASTNAME
    )
    ELSE CONCAT(
      np.FIRSTNAME,
      ' ',
      np.MIDDLENAME,
      ' ',
      np.LASTNAME
    )
  END AS FULLNAME,
  np.PATIENTID,
  pt.BILLINGID,
  tp.CATEGORY
FROM new_patients as np
  INNER JOIN performing_test as pt ON np.PATIENTID = pt.PATIENTID
  INNER JOIN samplestatus AS ss ON ss.billingid = pt.BILLINGID
  INNER JOIN test_ascension AS ta ON ta.billingid = pt.BILLINGID
  INNER JOIN test_panels AS tp ON tp.ID = ss.testid
WHERE ss.approvalstatus = 1
  AND pt.DATE = CURRENT_DATE