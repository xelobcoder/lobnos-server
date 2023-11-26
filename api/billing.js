const { response } = require('express');
const { beginTransaction, query } = require('./models/result');
const connection = require('./db');
const { checkpatient } = require('./register');
const logger = require('../logger')
const { customError, promisifyQuery } = require('../helper');
const { getApplicationSettings } = require('./models/applicationSettings');


class Billing {
  constructor(patientid, clinician, organization, test, payable, testcost, paid, taxIncluded, taxValue, status, discount, paymentmode, samplingCenter,
    outstanding, cost) {
    this.patientid = patientid;
    this.clinician = clinician;
    this.organization = organization;
    this.test = test;
    this.payable = payable;
    this.testcost = testcost;
    this.paid = paid;
    this.taxIncluded = taxIncluded;
    this.taxValue = taxValue;
    this.status = status;
    this.discount = discount;
    this.paymentmode = paymentmode;
    this.samplingCenter = samplingCenter;
    this.outstanding = outstanding;
    this.cost = cost;
  }

  insertNewBilling = async function (request, response) {
    const query = `INSERT INTO billing(patientid,clinician,organization,paid_amount,payable,type,outstanding,discount,branchid,taxIncluded,taxValue,clientstatus,testcost)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`; 

    const values = [this.patientid, this.clinician, this.organization, this.paid, this.payable, this.paymentmode, this.outstanding, this.discount, this.samplingCenter, this.taxIncluded, this.taxValue, this.status, this.testcost];

    try {
      const { affectedRows, insertId } = await promisifyQuery(query, values);
      return affectedRows > 0 ? insertId : false;
    } catch (err) { logger.error(err) }
  }


  updateBillingHistory = async function (billingid) {
    const query = `UPDATE billinghx SET paymentMode = ?,Amount = ? WHERE billingid = ?`;
    const values = [this.paymentmode, this.paid, billingid];
    return promisifyQuery(query, values);
  }

  isCompleteFlow = async function () {
    try {
      const settings = await getApplicationSettings();
      if (settings && settings.length > 0) { return settings[0].completeFlow == 1 ? true : false }
    } catch (err) { logger.error(err) }
  }

  updateApprovalStatus = async function (billingid, testid) {
    const query = `UPDATE samplestatus SET approvalstatus = 1 WHERE billingid = ? AND testid = ?`;
    const values = [billingid, testid];
    return promisifyQuery(query, values);
  }

  isValidForDayEntry = async function () {
    const query = `SELECT COUNT(*) FROM billing WHERE patientid = ? AND DATE(billedon) = CURRENT_DATE`;
    const values = [this.patientid];
    try {
      const result = await promisifyQuery(query, values);
      return result[0]['COUNT(*)'] > 0 ? false : true;
    } catch (err) { logger.error(err) }
  }

  async AddtoTestAscenstion(billingid) {
    if (Array.isArray(this.test) && this.test.length > 0) {
      const query = `INSERT INTO test_ascension (testid,billingid,collection,collection_date)
      VALUES(?,?,?,CURRENT_DATE)`;
      // if settings is a complete flow, then we need to make sure the collection is false,else true for collection and approval status
      if (await this.isCompleteFlow()) {
        this.test.map(async (item, index) => { await promisifyQuery(query, [item, billingid, 'false']) })
      } else {
        this.test.map(async (item, index) => {
          await promisifyQuery(query, [item, billingid, 'true']);
          await this.updateApprovalStatus(billingid, item);
        });
      }
    }
  }

  async insetionProcess(request, response) {
    if (await this.isValidForDayEntry()) {
      try {
        connection.beginTransaction(async (err) => {
          if (err) { logger.error(err) }
          const billingid = await this.insertNewBilling();
          await this.AddtoTestAscenstion(billingid);
          await this.updateBillingHistory(billingid);
          connection.commit((err) => {
            if (err) { logger.error(err);
            connection.rollback();
           }
            console.log(billingid, '--billingid')
            response.status(200).json({ message: 'billing successfully',billingid, statusCode: 200, status: 'success' })
          })
        })
      } catch (err) {
        logger.error(err);
        connection.rollback((err) => {
          if (err) { logger.error(err) }; customError(err.message, 500, response);
        })
      }
    } else {
      customError(`client billed on same day. Kindly check the billing history to update billing`, 401, response);
    }
  }
}



/**
 * 
 * @param {patientid} patientid this represent the unique id of the client throught out the lifespan of the application 
 * @returns promise  0,1,-1 0 means the facillity owns the client in terms of change,1 means paid amount = payables and 0 means client owns

 */
const clientPaymentStatus = async function (patientid) {
  return new Promise((resolve, reject) => {
    const query = `SELECT
        SUM(PAID_AMOUNT) AS paidAmount,
    SUM(PAYABLE) AS totalcostincurred,
      CASE
        WHEN SUM(PAID_AMOUNT) = SUM(PAYABLE) THEN 1
        WHEN SUM(PAID_AMOUNT) > SUM(PAYABLE) THEN -1
        WHEN SUM(PAID_AMOUNT) < SUM(PAYABLE) THEN 0
      END AS status
    FROM BILLING
    WHERE PATIENTID = ${patientid}`;

    connection.query(query, async (err, result) => {
      if (err) {
        reject(err)
      } else {
        //  check new_patients to verify if such client exist      
        const status = result[0]['status']

        if (status == null) {
          const isExist = await checkpatient(patientid);
          isExist ? resolve(1) : resolve(null);
        } else {
          resolve(status)
        }
      }
    })
  })
}


const checkifActivated = async function (request, response) {
  //  get the billing id
  const { billingid } = request.query;
  // check if billing id is not empty
  if (billingid != '') {
    // join the billing and performing test table and new patients table using the aptient id wherw billing id is equal to the billing id
    let mysql = `SELECT * FROM billing as b 
    INNER JOIN new_patients as n
         ON b.PATIENTID = n.PATIENTID WHERE b.BILLINGID = ?`;
    try {
      let result = await promisifyQuery(mysql, [billingid]);
      response.send({ message: 'success', statusCode: 200, result });
    } catch (err) {
      customError(err?.message, 500, response);
    }
  }
  else { // if billing id is isNotEmptyFields
    response.status(400).json({
      message: 'billing id is required',
      status: 'error',
      statusCode: 400
    });
  }
}



const getBilledClients = function (request, response) {
  const mysql = `
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
          DATE(b.billedon) AS DATE
        FROM billing AS b
          INNER JOIN new_patients AS np ON np.PATIENTID = b.PATIENTID
          INNER JOIN billinghx AS bhx ON bhx.Billingid = b.BILLINGID
          INNER JOIN paymentmodes AS pm ON pm.KeyID = bhx.PaymentMode
          WHERE DATE(b.billedon) = CURRENT_DATE
    GROUP BY b.BILLINGID
    ORDER BY B.BILLINGID DESC
    LIMIT 20
  `;

  connection.query(mysql, function (err, result) {
    if (err) {
      response.status(500).json({
        message: 'error',
        status: 'error',
        statusCode: 500
      });
    }
    if (result) {
      response.status(200).json({
        message: 'success',
        result,
        statusCode: 200
      });
    }
  })
}

/**
 * Updates the billing information in the database based on the provided request body.
 * Handles the deletion and addition of test IDs associated with the billing ID.
 * Uses a database connection and performs the necessary queries to update the data.
 * 
 * @param {Object} request - The request object containing the necessary data for updating the billing.
 * @param {Object} response - The response object used to send the result of the update operation.
 * @returns {void}
 */
const updateBilling = async function (request, response) {
  try {
    const { test, totalcost, patientid, billingid, outstanding } = request.body;

    if (!test || !totalcost || !patientid || !billingid || !outstanding) {
      response.send({
        message: 'Invalid request body',
        statusCode: 400,
        status: 'error'
      });
      return;
    }

    // update the billing table first
    const updateCurrentBill = `UPDATE BILLING 
        SET PAYABLE = ?,
        OUTSTANDING = ?
    WHERE BILLINGID = ?`;

    // FLOW
    // 1. update billing table
    // 2. get all the test in the test_ascension table that has this paticular billingid 
    // 3. compare ids in the test arayy with that in the db
    // 4. remove all test from the db that arrent in the test array
    // 5. add all test in the test array that arent in the test_ascention table
    // 6. all should be done using transactions so that if one shoudl fail then the commit should be roolled
    connection.beginTransaction(function (err) {
      if (err) { logger.error(err); }

      connection.query(updateCurrentBill, [totalcost, outstanding, billingid], function (error, results, fields) {
        if (error) {
          return connection.rollback(function () {
            logger.error(err);
          });
        }

        connection.query(`SELECT * FROM TEST_ASCENSION WHERE BILLINGID = ?`, [billingid], function (err, result) {
          if (err) {
            return connection.rollback(function () {
              logger.error(err)
            });
          }

          if (Array.isArray(result) && result.length > 0) {
            const db_testid = result.map((item, index) => { return item.testid })
            const testidArray = test.map((item, index) => { return item.testid })
            // delete all testid that are in db_testid and are not in the database  from the db
            const toDelete = [];
            const toAdd = [];
            for (let i = 0; i < db_testid.length; i++) {
              if (testidArray.includes(db_testid[i])) {
                logger.info(`${db_testid[i]} found in current list hence skipping......`)
              }
              else {
                toDelete.push(db_testid[i])
              }
            }

            toDelete.forEach((item, index) => {
              const removeStatement = `DELETE FROM TEST_ASCENSION WHERE BILLINGID = ${billingid} AND TESTID = ${item}`;
              connection.query(removeStatement, function (err, result) {
                if (err) {
                  return connection.rollback(function () {
                    logger.error(err);
                  })
                }
              })
            })


            for (let i = 0; i < testidArray.length; i++) {
              if (db_testid.includes(testidArray[i])) {
                console.log(`${testidArray[i]} of testarray found in current list hence skipping......`)
              } else {
                toAdd.push(testidArray[i])
              }
            }

            toAdd.forEach((item, index) => {
              const addStatement = `INSERT INTO TEST_ASCENSION (BILLINGID, TESTID) VALUES (${billingid},${item})`;
              connection.query(addStatement, function (err, result) {
                if (err) {
                  return connection.rollback(function () {
                    logger.error(err);
                  })
                }
              })
            })
          }

          connection.commit(function (err) {
            if (err) {
              return connection.rollback(function () {
                logger.error(err);
              });
            }
            response.send({
              message: 'update successful',
              statusCode: 200,
              status: 'success'
            })
          });
        });
      });
    });

  } catch (err) {
    console.log(err)
  }
}

module.exports = {
  Billing,
  updateBilling,
  checkifActivated,
  getBilledClients
}