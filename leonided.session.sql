SELECT p.date,
  b.billingid,
  b.outstanding,
  b.paid_amount AS paid,
  b.payable,
  b.discount
FROM billing AS b
  INNER JOIN performing_test AS pt ON pt.billingid = b.billingid
WHERE b.patientid = 20239723
  AND b.OUTSTANDING > 0