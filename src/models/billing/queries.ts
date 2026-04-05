export let updatebillHistoryQuery: string = "UPDATE billinghx SET paymentMode = ?, Amount = ? WHERE billingid = ?";


export let insertbillHistoryQuery: string = "INSERT INTO billinghx(billingid,paymentmode,amount,employeeid,type) VALUES(?,?,?,?,?)";


export const deleteNewBillPaymentHx: string = "DELETE FROM billinghx WHERE billingid = ?";

export let insertBillQuery: string = `INSERT INTO billing
               (patientid,
               paid,
               payable,
               outstanding,
               discount,
               amountIncurredDueTax,
               clientstatus,totalcost)
          VALUES(?,?,?,?,?,?,?,?)`;

export let updateApprovalStatusQuery: string = `UPDATE samplestatus SET approvalstatus = 1 WHERE billingid = ? AND testid = ?`;

export let patientBilledTodayQuery: string =
  "SELECT COUNT(*) AS count FROM billing WHERE patientid = ? AND DATE(billedon) = CURRENT_DATE";

export let AddtoTestAscenstionQuery: string =
  "INSERT INTO test_ascension (testid,serviceid,billingid,month,year) VALUES(?,?,?,?,?)";

export let deleteAscensionidQuery: string = "DELETE FROM test_ascension WHERE testid = ? AND serviceid = ?";

export let clientPaymentStatusQuery: string = `SELECT
      SUM(paid) AS paidAmount,
          SUM(PAYABLE) AS totalcostincurred,
          CASE
            WHEN SUM(paid) = SUM(PAYABLE) THEN 1
            WHEN SUM(paid) > SUM(PAYABLE) THEN -1
            WHEN SUM(paid) < SUM(PAYABLE) THEN 0
          END AS status
          FROM BILLING
      WHERE PATIENTID = ?`;

export const q_get_today_client_billingid = ` SELECT billingid FROM billing WHERE patientid = ? AND DATE(billedon) = CURRENT_DATE  ORDER BY 
billedon DESC lIMIT 1`;

export let clientBillInformationQuery: string =
  "SELECT * FROM billing as b  INNER JOIN new_patients as n ON b.PATIENTID = n.PATIENTID WHERE b.BILLINGID = ?";

export let billCountDateQ: string = "SELECT COUNT(*) AS count FROM billing WHERE DATE(billedon) = ?";

export let currentDateBilledClients: string = `
     SELECT b.billingid,
          CONCAT( np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
          b.paid_amount AS paid,
          b.payable,
          b.patientid,
          b.type,
          b.outstanding,
          b.discount,
          DATE(b.billedon) AS date
        FROM billing AS b
          INNER JOIN new_patients AS np ON np.patientid = b.patientid
          WHERE year  = ? AND month = ? AND day = ? AND branchid =  ?
    ORDER BY b.billingid DESC
    LIMIT ? OFFSET ?`;

export let q_currentDateBilledClientsAllBranches: string = `
     SELECT b.billingid,
          CONCAT( np.firstname, ' ', np.middlename, ' ', np.lastname) AS fullname,
          b.paid_amount AS paid,
          b.payable,
          b.patientid,
          b.type,
          b.outstanding,
          b.discount,
          DATE(b.billedon) AS date
        FROM billing AS b
          INNER JOIN new_patients AS np ON np.patientid = b.patientid
          WHERE year  = ? AND month = ? AND day = ? 
    ORDER BY b.billingid DESC
    LIMIT ? OFFSET ?`;

export const updateCurrentBill: string = `UPDATE billing  SET testCost = ?, payable = ?, outstanding = ?
    WHERE billingid = ?`;

export const getBillAscesnsion: string = `SELECT * FROM test_ascension WHERE billingid = ?`;

export const deleteBillTransactionQuery: string = `DELETE FROM billing WHERE billingid = ?`;

export const q_getAllpartiton: string = `SELECT * FROM information_schema.partitions WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`;

export const q_addNewPartition = (tablename: string, partitionName: string, year: number, month: number): string => `
    ALTER TABLE ${tablename} 
    ADD PARTITION (PARTITION ${partitionName} VALUES LESS THAN (${year}, ${month}));
`;


export const q_insert_new_services_billing_test = "INSERT INTO dboServices(billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid,isoutsourced,outsourceid,taxList,amountIncurredDueTax,taxValue,taxIncluded,totalcost,isNHIS,isPHIS,insuranceid,claimCode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";


export const q_dropTableAllPartition: string = `ALTER TABLE billing REMOVE PARTITIONING`;

export const q_dropSpecificTablePartition: string = `ALTER TABLE ?? DROP PARTITION ??`;



export const q_reorganization_query: string = `ALTER TABLE billing REORGANIZE PARTITION ?? INTO (`


export const add_additional_service_as_a_service: string = `INSERT INTO dboservices (billingid,trackid,employeeid,categoryTrackId,serviceCategory,branchid,cost,taxValue,taxList,taxIncluded,amountIncurredDueTax,discount,totalcost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`


export const q_get_saved_billing_information = `
SELECT * FROM billing  WHERE billingid = ?
`

export const q_update_Billing_Information =
  `UPDATE billing SET
              paid = ?,
              payable = ?,
              outstanding = ?,
              discount = ?,
              amountincurredduetax = ?,
              balance = ?,
              totalrefunded = ?,
              totalcost = ?,
              totalTransactionCost = ?
 WHERE billingid = ? `;



export const q_initiate_refund_first_witness = `
  UPDATE dbobillingrefundtable 
  SET 
    isRefundInitiated = ?, 
    initiatedBy = ?, 
    firstWitness = ?, 
    firstWitnessPurpose = ?,
    firstWitnessDate = NOW()
  WHERE serviceid = ?
`;


export const q_insert_into_dbo_Services: string = `
  INSERT INTO dboservices(
  billingid, trackId, cost, employeeid,
  serviceCategory, categoryTrackId, clinicianId, organizationId,
  registrationType, branchid, isoutsourced, outsourceid,
  serviceAddedOn,taxList, taxValue, amountIncurredDueTax,
  taxIncluded, discount,totalcost, totalpayable,
  isNHIS, isPHIS, insuranceid, claimCode,hasNightAdjustment, nightAdjustmentMode, nightAdjustmentValue,isPackageUsed, packageid
  ) 
    VALUES (
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?,?, ?,
    ?, ?, ?, ?,
    ?, ?, ?, ?,
    ?, ?,?,?,?,
    ?,?,?,?)`;

