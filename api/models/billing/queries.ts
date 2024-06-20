export let updatebillHistoryQuery: string = "UPDATE billinghx SET paymentMode = ?, Amount = ? WHERE billingid = ?";

export const deleteNewBillPaymentHx: string = "DELETE FROM billinghx WHERE billingid = ?";

export let insertBillQuery: string = `INSERT INTO billing
               (patientid,
               clinician,
               organization,
               paid_amount,
               payable,
               type,
               outstanding,
               discount,
               branchid,
               taxIncluded,
               taxValue,
               clientstatus,
               testcost,
               employeeid)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

export let updateApprovalStatusQuery: string = `UPDATE samplestatus SET approvalstatus = 1 WHERE billingid = ? AND testid = ?`;

export let patientBilledTodayQuery: string =
  "SELECT COUNT(*) AS count FROM billing WHERE patientid = ? AND DATE(billedon) = CURRENT_DATE";

export let AddtoTestAscenstionQuery: string =
  "INSERT INTO test_ascension (testid,billingid,collection,collection_date) VALUES(?,?,?,CURRENT_DATE)";

export let deleteAscensionidQuery: string = "DELETE FROM test_ascension WHERE testid = ? AND billingid = ?";

export let clientPaymentStatusQuery: string = `SELECT
      SUM(PAID_AMOUNT) AS paidAmount,
          SUM(PAYABLE) AS totalcostincurred,
          CASE
            WHEN SUM(PAID_AMOUNT) = SUM(PAYABLE) THEN 1
            WHEN SUM(PAID_AMOUNT) > SUM(PAYABLE) THEN -1
            WHEN SUM(PAID_AMOUNT) < SUM(PAYABLE) THEN 0
          END AS status
          FROM BILLING
      WHERE PATIENTID = ?`;

export let clientBillInformationQuery: string =
  "SELECT * FROM billing as b  INNER JOIN new_patients as n ON b.PATIENTID = n.PATIENTID WHERE b.BILLINGID = ?";

export let billCountDateQ: string = "SELECT COUNT(*) AS count FROM billing WHERE DATE(billedon) = ?";

export const billedClientsQuery: string = `
     SELECT b.billingid AS billingid,
          CONCAT( np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
          b.paid_amount AS paid,
          b.payable,
          b.patientid,
          b.type,
          b.outstanding,
          pm.PaymentMode,
          b.discount,
          DATE(b.billedon) AS date
        FROM billing AS b
          INNER JOIN new_patients AS np ON np.patientid = b.patientid
          INNER JOIN billinghx AS bhx ON bhx.billingid = b.billingid
          INNER JOIN paymentmodes AS pm ON pm.KeyID = bhx.PaymentMode
          WHERE DATE(b.billedon) = CURRENT_DATE
    GROUP BY b.billingid
    ORDER BY B.billingid DESC
    LIMIT 20`;

export const updateCurrentBill: string = `UPDATE billing  SET testCost = ?, payable = ?, outstanding = ?
    WHERE billingid = ?`;

export const getBillAscesnsion: string = `SELECT * FROM test_ascension WHERE billingid = ?`;

export const deleteBillTransactionQuery: string = `DELETE FROM billing WHERE billingid = ?`;
