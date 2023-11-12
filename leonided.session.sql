 SELECT b.BILLINGID AS BILLINGID,
          CASE
            WHEN np.MIDDLENAME IS NULL THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
            ELSE CONCAT(
              np.FIRSTNAME,
              ' ',
              np.MIDDLENAME,
              ' ',
              np.LASTNAME
            )
          END AS FULLNAME,
          b.PAID_AMOUNT AS PAID,
          b.PAYABLE,
          b.PATIENTID,
          b.TYPE,
          b.OUTSTANDING,
          b.DISCOUNT,
          DATE(p.DATE) AS DATE,
          pm.PaymentMode AS PAYMENT_MODE
        FROM billing AS b
          INNER JOIN performing_test AS p ON b.PATIENTID = p.PATIENTID
          INNER JOIN new_patients AS np ON np.PATIENTID = b.PATIENTID
          INNER JOIN billinghx AS bhx ON bhx.Billingid = b.BILLINGID
          INNER JOIN paymentmodes AS pm ON pm.KeyID = bhx.PaymentMode
          WHERE p.DATE = CURRENT_DATE
    GROUP BY b.BILLINGID
    ORDER BY B.BILLINGID DESC
    LIMIT 20