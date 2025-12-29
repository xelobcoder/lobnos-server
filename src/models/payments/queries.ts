export const queries = {
  getClientTransactionInformation: `
    SELECT 
  np.patientid,
  np.fullpatientid,
  CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
  np.email,
  CONCAT('0', np.mobile_number) AS mobileNumber,
  b.*,
  (SELECT serviceCategory FROM \`dboservices\` WHERE billingid = b.billingid LIMIT 1) AS billingSource
FROM new_patients AS np
INNER JOIN billing AS b ON np.patientid = b.patientid
  `,
  getClientFullOutstanding: `
    SELECT SUM(paid) AS paid, SUM(payable) AS total 
    FROM billing 
    WHERE PATIENTID = ?
  `,
  getTransactionData: `
    SELECT * 
    FROM billing AS b 
    INNER JOIN new_patients AS np ON b.patientid = np.patientid 
    WHERE np.patientid = ?
  `,
  allClientDebtTransactions: `
    SELECT 
      billedon AS date,
      billingid,
      outstanding,
      paid,
      payable,
      discount
    FROM billing 
    WHERE patientid = ?
    AND outstanding > 0
     AND (adjustmentType IS NULL OR adjustmentType != 'voided')
  `,
  updateSingleTransactionDebt: `
    UPDATE billing 
    SET paid = ?, outstanding = ? 
    WHERE billingid = ?
  `,
  updateTransactionHx: `
    INSERT INTO billingHx (billingid, paymentmode, amount, employeeid) 
    VALUES (?,?,?,?)
  `,
  updatePayment: `
    SELECT * 
    FROM BILLING 
    WHERE billingid = ?
  `,
  updatePaymentUpdate: `
    UPDATE billing 
    SET outstanding = ?, paid_amount = ?
    WHERE billingid = ?
  `,
  insertBillingHx: `
    INSERT INTO billingHx (billing, paymentmode, amount) 
    VALUES (?,?,?)
  `,
  paymentMode: `
    SELECT * 
    FROM paymentmodes
  `,
  specificBillTransactionHx: `
    SELECT * 
    FROM billingHx 
    WHERE billingid = ?  
    ORDER BY keyid DESC
  `,
};
