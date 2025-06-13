


-- DROP TABLES IF EXISTS (for clean test setupDROP TABLE IF EXISTS `test_refundpaymenthx`;
DROP TABLE IF EXISTS `test_billinghx`;
DROP TABLE IF EXISTS `test_dbobillingrefundtable`;
DROP TABLE IF EXISTS `test_dboservices`;
DROP TABLE IF EXISTS `test_billing`;
DROP TABLE IF EXISTS `test_billinghx`;
DROP TABLE IF EXISTS `test_refundpaymenthx`;


-- CREATE TABLE: test_billing
CREATE TABLE `test_billing` (
  `billingid` INT(255) NOT NULL AUTO_INCREMENT,
  `patientid` INT(20) NOT NULL,
  `totalTransactionCost` DECIMAL(10,2) DEFAULT 0.00,
  `totalcost` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `paid` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `payable` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `totalrefunded` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `discount` DECIMAL(10,2) NOT NULL,
  `outstanding` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `balance` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `billedon` DATETIME(6) NOT NULL DEFAULT current_timestamp(6),
  `clientstatus` VARCHAR(15) NOT NULL DEFAULT 'normal',
     `branchid` INT(10) NOT NULL,
  `year` INT(11) NOT NULL DEFAULT year(curdate()),
  `month` INT(11) NOT NULL DEFAULT month(curdate()),
  `day` INT(11) DEFAULT dayofmonth(curdate()),
  `amountIncurredDueTax` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `lastupdated` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`billingid`, `year`, `month`),
  KEY `BILLINGID` (`billingid`),
  KEY `billingid_2` (`billingid`, `patientid`),
  KEY `patientid` (`patientid`, `year`, `month`),
  KEY `branchid` (`year`, `month`, `day`)
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- CREATE TABLE: test_dboservices
CREATE TABLE `test_dboservices` (
  `serviceid` INT(20) NOT NULL AUTO_INCREMENT,
  `billingid` INT(255) NOT NULL,
  `trackId` INT(10) NOT NULL,
  `cost` DECIMAL(10,2) NOT NULL,
  `employeeid` INT(10) NOT NULL,
  `serviceCategory` ENUM('PHIS','NHIS','GENERAL','ORGANIZATION','SERVICES','CLINICIAN_SPECIAL_BILLING') DEFAULT NULL,
  `categoryTrackId` INT(10) NOT NULL,
  `clinicianId` INT(10) DEFAULT NULL,
  `organizationId` INT(10) DEFAULT NULL,
  `registrationType` ENUM('self','organization','clinician','phis','nhis') DEFAULT NULL,
  `branchid` INT(10) NOT NULL,
  `isoutsourced` TINYINT(1) NOT NULL DEFAULT 0,
  `outsourceid` INT(10) DEFAULT NULL,
  `serviceAddedOn` DATETIME(6) NOT NULL DEFAULT current_timestamp(6),
  `taxList` LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`taxList`)),
  `taxValue` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `amountIncurredDueTax` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `taxIncluded` TINYINT(1) NOT NULL DEFAULT 0,
  `discount` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `totalcost` DECIMAL(10,2) NOT NULL,
  `totalpayable` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `isNHIS` TINYINT(1) NOT NULL DEFAULT 0,
  `isPHIS` TINYINT(1) NOT NULL DEFAULT 0,
  `insuranceid` VARCHAR(30) DEFAULT NULL,
  `claimCode` VARCHAR(30) DEFAULT NULL,
  `hasNightAdjustment` TINYINT(1) NOT NULL DEFAULT 0,
  `nightAdjustmentValue` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `nightAdjustmentMode` ENUM('absolute','percentage','none') NOT NULL DEFAULT 'none',
  `isPackageUsed` TINYINT(1) NOT NULL DEFAULT 0,
  `packageid` INT(10) DEFAULT NULL,
  PRIMARY KEY (`serviceid`),
  UNIQUE KEY `billingid` (`billingid`,`trackId`),
  CONSTRAINT `fk_test_services_billing` FOREIGN KEY (`billingid`) REFERENCES `test_billing` (`billingid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- CREATE TABLE: test_dbobillingrefundtable
CREATE TABLE `test_dbobillingrefundtable` (
  `refundid` INT(20) NOT NULL AUTO_INCREMENT,
  `serviceid` INT(20) NOT NULL,
  `refundedBy` INT(10) NOT NULL,
  `firstWitness` INT(10) NOT NULL,
  `secondWitness` INT(10) NOT NULL,
  `thirdWitness` INT(10) NOT NULL,
  `firstWitnessPurpose` LONGTEXT DEFAULT NULL,
  `firstWitnessDate` DATETIME(6) DEFAULT NULL,
  `secondWitnessDate` DATETIME(6) DEFAULT NULL,
  `thirdWitnessDate` DATETIME(6) DEFAULT NULL,
  `isRefundCompleted` INT(1) NOT NULL DEFAULT 0,
  `isRefundInitiated` TINYINT(1) NOT NULL DEFAULT 0,
  `initiatedBy` INT(10) DEFAULT NULL,
  `secondWitnessPurpose` LONGTEXT DEFAULT NULL,
  `thirdWitnessPurpose` LONGTEXT DEFAULT NULL,
  `isRefundApproved` TINYINT(1) NOT NULL DEFAULT 0,
  `approvalDate` TINYINT(1) NOT NULL DEFAULT 0,
  `approvedby` INT(20) DEFAULT NULL,
  `amountRefunded` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`refundid`),
  KEY `fk_refund_service_constraint` (`serviceid`),
  CONSTRAINT `fk_test_refund_service` FOREIGN KEY (`serviceid`) REFERENCES `test_dboservices` (`serviceid`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


-- CREATE TABLE: test_billinghx
CREATE TABLE `test_billinghx` (
  `KeyID` INT(255) NOT NULL AUTO_INCREMENT,
  `Billingid` INT(255) NOT NULL,
  `Date` DATETIME(6) NOT NULL DEFAULT current_timestamp(6),
  `PaymentMode` INT(25) NOT NULL,
  `Amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `employeeid` INT(10) NOT NULL,
  `type` ENUM('debit','credit') NOT NULL DEFAULT 'credit',
  `description` VARCHAR(255) DEFAULT NULL,
     `isRefund` TINYINT(1) NOT NULL DEFAULT 0,
     `refundId` INT(20) DEFAULT NULL,

       INDEX `idx_billingid_isrefund` (`Billingid`, `isRefund`)
  PRIMARY KEY (`KeyID`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- TRIGGERS FOR AGGREGATION
DELIMITER $$

-- Services triggers
CREATE TRIGGER trg_test_service_insert AFTER INSERT ON test_dboservices
FOR EACH ROW
BEGIN
  UPDATE test_billing
  SET totalcost = totalcost + NEW.totalcost,
      payable = payable + NEW.totalpayable,
      amountIncurredDueTax = amountIncurredDueTax + NEW.amountIncurredDueTax,
          totalTransactionCost = totalTransactionCost + NEW.totalcost,
          totalrefunded = totalrefunded + NEW.totalrefunded,
     
  WHERE billingid = NEW.billingid;
END$$

CREATE TRIGGER trg_test_service_update AFTER UPDATE ON test_dboservices
FOR EACH ROW
BEGIN
  UPDATE test_billing
  SET totalcost = totalcost - OLD.totalcost + NEW.totalcost,
      payable = payable - OLD.totalpayable + NEW.totalpayable
  WHERE billingid = NEW.billingid;
END$$

CREATE TRIGGER trg_test_service_delete AFTER DELETE ON test_dboservices
FOR EACH ROW
BEGIN
  UPDATE test_billing
  SET totalcost = totalcost - OLD.totalcost,
      payable = payable - OLD.totalpayable
  WHERE billingid = OLD.billingid;
END$$

CREATE TRIGGER trg_test_refund_update AFTER UPDATE ON test_dbobillingrefundtable
FOR EACH ROW
BEGIN
  UPDATE test_billing
  SET totalrefunded = totalrefunded - OLD.amountRefunded + NEW.amountRefunded
  WHERE billingid = (SELECT billingid FROM test_dboservices WHERE serviceid = NEW.serviceid);
END$$

CREATE TRIGGER trg_test_refund_delete AFTER DELETE ON test_dbobillingrefundtable
FOR EACH ROW
BEGIN
  UPDATE test_billing
  SET totalrefunded = totalrefunded - OLD.amountRefunded
  WHERE billingid = (SELECT billingid FROM test_dboservices WHERE serviceid = OLD.serviceid);
END$$

DELIMITER ;


DELIMITER $$

CREATE TRIGGER trg_after_refundpaymenthx_insert
AFTER INSERT ON refundpaymenthx
FOR EACH ROW
BEGIN
  UPDATE dbobillingrefundtable
  SET amountRefunded = amountRefunded + NEW.amountRefunded
  WHERE refundid = NEW.refundableid;
END$$

DELIMITER ;


LOGIC FLOW:
1.update dboservices
2.billingtable is updated except totalpaid;
3.update billinghx
4.billing paid is updated
5. after is approved and refund is initiated and completed and completely refunded
6. update dbobillingrefundtable and billing table is automatically updated totalcost
billinghx is inserted into as debit totalTransaction
7. billing paid is updated
8. refundpaymenthx  transaction deleted , dbobillingrefundtable is updated and billing table is updated and 
   billinghx  for that transaction is deleted and billing paid is updated





//-- TRIGGERS FOR AGGREGATION
-- Services triggers
--------------------------------------------------------

-- Trigger: After INSERT on dboservices,ACURATE -START
DELIMITER $$

CREATE TRIGGER trg_after_insert_services 
AFTER INSERT ON test_dboservices
FOR EACH ROW
BEGIN 
    UPDATE test_billing
    SET totalcost = totalcost + NEW.totalcost,
        payable = payable + NEW.totalpayable,
        discount = discount + NEW.discount,
        amountIncurredDueTax = amountIncurredDueTax + NEW.amountIncurredDueTax,
        totalTransactionCost = totalTransactionCost + NEW.totalcost
    WHERE billingid = NEW.billingid;
END$$

CREATE TRIGGER trg_after_update_services
AFTER UPDATE ON test_dboservices
FOR EACH ROW
BEGIN
    UPDATE test_billing
    SET totalcost = totalcost + NEW.totalcost - OLD.totalcost,
        payable = payable + NEW.totalpayable - OLD.totalpayable,
        discount = discount + NEW.discount - OLD.discount,
        amountIncurredDueTax = amountIncurredDueTax + NEW.amountIncurredDueTax - OLD.amountIncurredDueTax,
        totalTransactionCost = totalTransactionCost + NEW.totalcost - OLD.totalcost
    WHERE billingid = NEW.billingid;
END$$

DELIMITER ;


DELIMITER $$

CREATE TRIGGER trg_test_service_delete 
AFTER DELETE ON test_dboservices
FOR EACH ROW
BEGIN
  UPDATE test_billing
  SET totalcost = totalcost - OLD.totalcost,
      amountIncurredDueTax = amountIncurredDueTax - OLD.amountIncurredDueTax,
      totalTransactionCost = totalTransactionCost - OLD.totalcost,
      payable = totalpayable - OLD.totalpayable,
      totaldiscount = totaldiscount - OLD.discount
  WHERE billingid = OLD.billingid;
END$$

DELIMITER ;



DELIMITER $$
DROP TRIGGER IF EXISTS trg_after_billinghx_insert;
DROP TRIGGER IF EXISTS trg_after_billinghx_delete;


DELIMITER $$

CREATE TRIGGER trg_after_billinghx_insert
AFTER INSERT ON test_billinghx
FOR EACH ROW
BEGIN
  DECLARE v_totalPayable DECIMAL(10,2);

  SELECT totalpayable INTO v_totalPayable
  FROM test_billing
  WHERE billingid = NEW.Billingid;

  -- Update billing table
  IF NEW.type = 'credit' THEN
    UPDATE test_billing
    SET paid = paid + NEW.Amount,
        balance = GREATEST(paid + NEW.Amount - v_totalPayable, 0),
      outstanding = v_totalPayable - v_paid - NEW.Amount;
    WHERE billingid = NEW.Billingid;

  ELSEIF NEW.type = 'debit' THEN
    UPDATE test_billing
    SET paid = GREATEST(paid - NEW.Amount, 0),
        balance = GREATEST(GREATEST(paid - NEW.Amount, 0) - v_totalPayable, 0),
        outstanding = GREATEST(v_totalPayable - GREATEST(paid - NEW.Amount, 0), 0),
        totalrefunded = IF(NEW.isRefund = 1 AND NEW.refundId IS NOT NULL,
                           totalrefunded + NEW.Amount, totalrefunded)
    WHERE billingid = NEW.Billingid;

    -- Also update refund table if linked
    IF NEW.isRefund = 1 AND NEW.refundId IS NOT NULL THEN
      UPDATE test_dbobillingrefundtable
      SET amountRefunded = amountRefunded + NEW.Amount
      WHERE refundid = NEW.refundId;
    END IF;

  END IF;
END$$


DELIMITER $$

DROP TRIGGER IF EXISTS trg_after_billinghx_delete $$
CREATE TRIGGER trg_after_billinghx_delete
AFTER DELETE ON test_billinghx
FOR EACH ROW
BEGIN
  DECLARE v_paid DECIMAL(10,2);
  DECLARE v_totalcost DECIMAL(10,2);
  DECLARE v_totalpayable DECIMAL(10,2);
  DECLARE v_totalrefunded DECIMAL(10,2);

  -- Step 1: Fetch current billing values
  SELECT paid, totalcost, totalpayable, totalrefunded
  INTO v_paid, v_totalcost, v_totalpayable, v_totalrefunded
  FROM test_billing
  WHERE billingid = OLD.Billingid;

  -- Step 2: Adjust values in variables
  IF OLD.isRefund = 0 THEN
    IF OLD.type = 'credit' THEN
      SET v_paid = GREATEST(v_paid - OLD.Amount, 0);
    ELSEIF OLD.type = 'debit' THEN
      SET v_paid = v_paid + OLD.Amount;
    END IF;
  ELSE
    -- Reverse refund effect
    UPDATE test_dbobillingrefundtable
    SET amountRefunded = GREATEST(amountRefunded - OLD.Amount, 0)
    WHERE refundid = OLD.refundId;

    SET v_totalrefunded = GREATEST(v_totalrefunded - OLD.Amount, 0);
    SET v_totalcost = v_totalcost + OLD.Amount;
    SET v_totalpayable = v_totalpayable + OLD.Amount;
  END IF;

  -- Step 3: Final update to test_billing (single atomic write)
  UPDATE test_billing
  SET 
    paid = v_paid,
    totalcost = v_totalcost,
    totalpayable = v_totalpayable,
    totalrefunded = v_totalrefunded,
    outstanding = GREATEST(v_totalpayable - v_paid, 0),
    balance = GREATEST(v_totalcost - v_paid, 0)
  WHERE billingid = OLD.Billingid;

END$$
DELIMITER ;





----ACCURATE END 
-- ------------------------------


-- Absolutely, here’s a more detailed set of comments explaining the logic flow step-by-step:

-- * **Check if the deleted billing history record is NOT a refund (`OLD.isRefund = 0`):**
--   This means the record represents a normal payment or charge related to the billing (not a refund). The update must reverse the effect of this record on the billing totals.

-- * **If the record type is `'credit'` (payment made by customer):**
--   The original record increased the amount paid by the customer. So, when this record is deleted, we **reduce** the total paid amount in the billing table by the amount in this record.

--   * Use `GREATEST(v_paid - OLD.Amount, 0)` to ensure that paid amount never goes negative after subtraction.

-- * **Else if the record type is `'debit'` (a charge or adjustment deducted from payments):**
--   The original record reduced the paid amount (for example, a correction or adjustment). So, when this record is deleted, we **add back** the amount to the paid total to reverse that deduction.

-- * **Else (when `OLD.isRefund != 0`), meaning this is a refund transaction:**
--   This branch handles refund-related adjustments separately, such as decreasing refund totals and adjusting billing amounts accordingly.

-- ---

-- **Summary:**
-- This logic carefully reverses the financial effect of a deleted billing history record on the billing totals: if it was a payment, it removes that payment; if it was a deduction, it adds that amount back. The use of `GREATEST` ensures values stay non-negative, maintaining data integrity. Refund cases are handled in a separate branch because refunds affect different billing fields and have distinct logic.


