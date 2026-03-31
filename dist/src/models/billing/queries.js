"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_insert_into_dbo_Services = exports.q_initiate_refund_first_witness = exports.q_update_Billing_Information = exports.q_get_saved_billing_information = exports.add_additional_service_as_a_service = exports.q_reorganization_query = exports.q_dropSpecificTablePartition = exports.q_dropTableAllPartition = exports.q_insert_new_services_billing_test = exports.q_addNewPartition = exports.q_getAllpartiton = exports.deleteBillTransactionQuery = exports.getBillAscesnsion = exports.updateCurrentBill = exports.q_currentDateBilledClientsAllBranches = exports.currentDateBilledClients = exports.billCountDateQ = exports.clientBillInformationQuery = exports.q_get_today_client_billingid = exports.clientPaymentStatusQuery = exports.deleteAscensionidQuery = exports.AddtoTestAscenstionQuery = exports.patientBilledTodayQuery = exports.updateApprovalStatusQuery = exports.insertBillQuery = exports.deleteNewBillPaymentHx = exports.insertbillHistoryQuery = exports.updatebillHistoryQuery = void 0;
exports.updatebillHistoryQuery = "UPDATE billinghx SET paymentMode = ?, Amount = ? WHERE billingid = ?";
exports.insertbillHistoryQuery = "INSERT INTO billinghx(billingid,paymentmode,amount,employeeid,type) VALUES(?,?,?,?,?)";
exports.deleteNewBillPaymentHx = "DELETE FROM billinghx WHERE billingid = ?";
exports.insertBillQuery = `INSERT INTO billing
               (patientid,
               paid,
               payable,
               outstanding,
               discount,
               amountIncurredDueTax,
               clientstatus,totalcost)
          VALUES(?,?,?,?,?,?,?,?)`;
exports.updateApprovalStatusQuery = `UPDATE samplestatus SET approvalstatus = 1 WHERE billingid = ? AND testid = ?`;
exports.patientBilledTodayQuery = "SELECT COUNT(*) AS count FROM billing WHERE patientid = ? AND DATE(billedon) = CURRENT_DATE";
exports.AddtoTestAscenstionQuery = "INSERT INTO test_ascension (testid,serviceid,billingid) VALUES(?,?,?)";
exports.deleteAscensionidQuery = "DELETE FROM test_ascension WHERE testid = ? AND serviceid = ?";
exports.clientPaymentStatusQuery = `SELECT
      SUM(paid) AS paidAmount,
          SUM(PAYABLE) AS totalcostincurred,
          CASE
            WHEN SUM(paid) = SUM(PAYABLE) THEN 1
            WHEN SUM(paid) > SUM(PAYABLE) THEN -1
            WHEN SUM(paid) < SUM(PAYABLE) THEN 0
          END AS status
          FROM BILLING
      WHERE PATIENTID = ?`;
exports.q_get_today_client_billingid = ` SELECT billingid FROM billing WHERE patientid = ? AND DATE(billedon) = CURRENT_DATE  ORDER BY 
billedon DESC lIMIT 1`;
exports.clientBillInformationQuery = "SELECT * FROM billing as b  INNER JOIN new_patients as n ON b.PATIENTID = n.PATIENTID WHERE b.BILLINGID = ?";
exports.billCountDateQ = "SELECT COUNT(*) AS count FROM billing WHERE DATE(billedon) = ?";
exports.currentDateBilledClients = `
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
exports.q_currentDateBilledClientsAllBranches = `
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
exports.updateCurrentBill = `UPDATE billing  SET testCost = ?, payable = ?, outstanding = ?
    WHERE billingid = ?`;
exports.getBillAscesnsion = `SELECT * FROM test_ascension WHERE billingid = ?`;
exports.deleteBillTransactionQuery = `DELETE FROM billing WHERE billingid = ?`;
exports.q_getAllpartiton = `SELECT * FROM information_schema.partitions WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`;
const q_addNewPartition = (tablename, partitionName, year, month) => `
    ALTER TABLE ${tablename} 
    ADD PARTITION (PARTITION ${partitionName} VALUES LESS THAN (${year}, ${month}));
`;
exports.q_addNewPartition = q_addNewPartition;
exports.q_insert_new_services_billing_test = "INSERT INTO dboServices(billingid, trackId, cost, employeeid, serviceCategory, categoryTrackId, clinicianId, organizationId, registrationType, branchid,isoutsourced,outsourceid,taxList,amountIncurredDueTax,taxValue,taxIncluded,totalcost,isNHIS,isPHIS,insuranceid,claimCode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";
exports.q_dropTableAllPartition = `ALTER TABLE billing REMOVE PARTITIONING`;
exports.q_dropSpecificTablePartition = `ALTER TABLE ?? DROP PARTITION ??`;
exports.q_reorganization_query = `ALTER TABLE billing REORGANIZE PARTITION ?? INTO (`;
exports.add_additional_service_as_a_service = `INSERT INTO dboservices (billingid,trackid,employeeid,categoryTrackId,serviceCategory,branchid,cost,taxValue,taxList,taxIncluded,amountIncurredDueTax,discount,totalcost) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;
exports.q_get_saved_billing_information = `
SELECT * FROM billing  WHERE billingid = ?
`;
exports.q_update_Billing_Information = `UPDATE billing SET
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
exports.q_initiate_refund_first_witness = `
  UPDATE dbobillingrefundtable 
  SET 
    isRefundInitiated = ?, 
    initiatedBy = ?, 
    firstWitness = ?, 
    firstWitnessPurpose = ?,
    firstWitnessDate = NOW()
  WHERE serviceid = ?
`;
exports.q_insert_into_dbo_Services = `
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
