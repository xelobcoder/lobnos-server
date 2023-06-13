 SELECT 
        ts.collection_date,
        ts.processing_date,
        ts.ready_date,
        pt.URGENCY AS urgency,
        pt.Phelobotomist,
        np.GENDER AS gender,
        CONCAT(np.FIRSTNAME," ",np.MIDDLENAME," ",np.LASTNAME) AS fullname,
        CONCAT(np.age," ",np.agetype) AS age,
        pt.INSPECTION_TIME AS inspectionTime,
        b.NAME as samplingCenter,
        c.NAME as clinician
      
      FROM test_ascension AS ts
      INNER JOIN performing_test AS pt ON pt.BILLINGID = ts.billingid
      INNER JOIN branch AS b ON b.BRANCHID = pt.SAMPLING_CENTER
      INNER JOIN new_patients as np ON np.PATIENTID = pt.PATIENTID
      INNER JOIN billing as bb ON bb.BILLINGID = pt.BILLINGID
      INNER JOIN clinician as c ON bb.CLINICIAN = c.ID
      WHERE ts.billingid = 150 and ts.testid = 13