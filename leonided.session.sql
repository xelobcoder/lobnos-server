SELECT 
ta.testid,
ta.billingid,
pt.URGENCY,
tt.NAME,
CONCAT(np.FIRSTNAME," ",np.MIDDLENAME," ", np.LASTNAME) as fullname
 FROM test_ascension AS ta
INNER JOIN billing as bb ON bb.BILLINGID = ta.billingid
INNER JOIN performing_test as pt ON pt.BILLINGID = bb.BILLINGID
INNER JOIN new_patients AS np ON np.PATIENTID = bb.PATIENTID
INNER JOIN test_panels AS tt ON tt.ID = ta.testid

 WHERE ta.ready = 'true' AND ta.ApprovalStatus = false