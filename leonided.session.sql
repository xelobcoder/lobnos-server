 SELECT 
        ts.ready_date,
        b.clientstatus as urgency,
        ts.collection_date,
        ss.approvalstatus,
        ss.ascensionid,
        b.branchid,
        ts.processing_date,
        np.GENDER AS gender,
        np.mobile_number,
        r.employeeid,
        r.USERNAME AS phelobotomist,
        np.GENDER AS gender,
        CASE 
          WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
          WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) 
        END AS clientname,
        CONCAT(np.age," ",np.agetype) AS age
      FROM test_ascension AS ts
       INNER JOIN billing  AS b ON ts.billingid = b.billingid
       INNER JOIN new_patients AS np ON np.patientid = b.patientid
       INNER JOIN samplestatus AS ss ON ss.billingid = b.billingid
       INNER JOIN roles AS r ON r.employeeid = ss.phelobotomist
       INNER JOIN branch AS br ON br.branchid = b.branchid
       where b.billingid = ? AND ts.testid = ?

     