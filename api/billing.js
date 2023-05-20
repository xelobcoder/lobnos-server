const { PrismaClient } = require('@prisma/client');
const { response } = require('express');
const { beginTransaction, query } = require('./models/result');
const connection = require('./db')
const prisma = new PrismaClient();

// add test to performing test
/**
 * 
 * @param {string} patientid  unique indentifier of the patient which run through the lifecycle of the patient in this software
 * @param {integer} billingid  unique  billing for the day test
 * @param {array} test  string  testnames seperated by comma or an array of testname
 * @param {string} urgency  urgency of the test
 * @param {object} res response object 
 * @param {string} samplingCenter name of the sampling center
 * @returns 
 */
const addperformingTest = (patientid, billingid, test, urgency, res, samplingCenter) => {
  // check if test is an array or a string , if string,check to see if is not empty
  const isValid = Array.isArray(test) || (typeof test == 'string' && test != '') ? true : false;
  // if test is an array
  if (isValid) {
    // sanitize test array
    const sanitize = function (test) {
      // if an array
      if (Array.isArray(test)) {
        // convert to string
        return test.join(',');
      }
      // if a string
      return test;
    }
    // if patient id and billing id are not empty
    if (patientid != '' && billingid != '') {
      // push data into performing test table
      let values = [
        patientid,
        billingid,
        sanitize(test),
        urgency,
        samplingCenter,
      ];
      let sql = `INSERT INTO performing_test (PATIENTID,BILLINGID,TEST,URGENCY,SAMPLING_CENTER) VALUES (?,?,?,?,?)`;
      connection.query(sql, values, (err, result) => {
        if (err) throw err;
        res.status(200).json({ message: "success", statusCode: 201 });
      });
    } else {
      return `${patientid} or ${billingid} not provided`
    }
  } else {
    return 'invalid data types provided'
  }

}

// add new billing
const addBilling = (req, res) => {
  const { patientid, clinicians, organizations, test, cost, paid, urgency, discount, paymentmode, samplingCenter } = req.body;

  // get outstanding balance
  let outstanding = parseInt(cost) - parseInt(discount) - parseInt(paid);
  // get type
  let type = paymentmode == 'invoice' ? 'POSTPAID' : 'PREPAID';
  // billing data
  let values = [parseInt(patientid), clinicians, organizations, paid, cost, paymentmode, type, outstanding, parseInt(discount)];

  // insert billing data into billing table
  let sql = `INSERT INTO billing (PATIENTID,CLINICIAN,ORGANIZATION,PAID_AMOUNT,PAYABLE,PAYMENT_MODE,TYPE,OUTSTANDING,DISCOUNT) VALUES (?,?,?,?,?,?,?,?,?)`;

  connection.query(sql, values, (err, result) => {
    if (err) throw err;
    if (result) {
      let billingid = result.insertId;
      // add test to performing test
      addperformingTest(patientid, billingid, test, urgency, res, samplingCenter);
    }
  })

}


const checkifActivated = function (request, response) {
  //  get the billing id
  const { billingid } = request.query;
  // check if billing id is not empty
  if (billingid != '') {
    // join the billing and performing test table and new patients table using the aptient id wherw billing id is equal to the billing id
    let mysql = `SELECT * FROM billing as b INNER JOIN performing_test as p ON b.BILLINGID = p.BILLINGID INNER JOIN new_patients as n ON b.PATIENTID = n.PATIENTID WHERE b.BILLINGID = '${billingid}'`;

    connection.query(mysql, function (err, result) {
      if (err) {
        console.log(err);
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
    });
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
  const mysql = `SELECT * FROM billing ORDER BY BILLINGID DESC LIMIT 100`;

  connection.query(mysql, function (err, result) {
    if (err) {
      console.log(err);
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


const updateBilling = async function (request, response) {
  try {
    const { test, totalcost, patientid, billingid, outstanding } = request.body;


    const getTestString = Array.isArray(test) == true ? (test.map((item, index) => { return item.name })).join(',') : test



    const updateCurrentBill = `UPDATE BILLING 
    SET PAYABLE = ${totalcost},
    OUTSTANDING = ${outstanding},
    UPDATED = '${new Date().getTime()}'
    WHERE BILLINGID = ${billingid}`;

    let mysql = `UPDATE performing_test
    SET TEST = '${getTestString}' WHERE BILLINGID = ${billingid}`;





    const updateTestascensionTable = async function (array) {
      try {
        // we will delete previous records if it isnt in this record once the processing havent yet started
        const checkQuery = `SELECT * FROM TEST_ASCENSION WHERE BILLINGID = ? AND TESTID = ?`
        const insertionRecord = `INSERT INTO TEST_ASCENSION (BILLINGID,TESTID) VALUES(?,?)`;
        const clientTestID = test.map((i, t) => { return i.testid });

        clientTestID.forEach((id) => {
          // check if id exist 
          connection.query(checkQuery, [billingid, id], (err, result) => {
            if (err) { throw err };
            if (result.length == 0) {
              connection.query(insertionRecord, [billingid, id], (err, result) => {
                if (err) { throw err }
                if (result) {
                  console.log('done')
                }
              })
            }
          })
        })

        // get all testid from test ascension with this billingid
        // compare with client and remove those that arent in the client collection
        connection.query(`SELECT TESTID FROM TEST_ASCENSION WHERE BILLINGID = ?`, billingid, (err, result) => {
          if (err) {
            throw err;
          }
          let testCollection = result.length > 0 ? result.map((i) => { return i.TESTID }) : []

          //  remove all testid that is not in the clientid
          testCollection.forEach((current, index) => {
            if (clientTestID.includes(current)) {
              return
            } else {
              const removeStatement = `DELETE FROM TEST_ASCENSION WHERE BILLINGID = ? AND TESTID = ?`
              connection.query(removeStatement, [billingid, current], function (err, result) {
                if (err) {
                  throw err;
                }
                console.log('deleted')
              })
            }
          })
        })


      }
      catch (err) {
        console.log(err)
      }
    }

    // there is high possibillity that at the time ,test will be updated , the previous test would in operations and hence we must add this to the test ascension table for it to reflect and the give the lab scientist opportunity to use their discretion to ask for new sample or use already taken sample



    await beginTransaction();
    await query(updateCurrentBill)
    await query(mysql);
    await updateTestascensionTable();

    connection.commit(function (err) {
      if (err) {
        connection.rollback()
        response.send({
          statusCode: 500,
          status: 'error',
          message: 'error in updating information'
        })
      } else {
        response.send({
          status: "success",
          statusCode: 200,
          message: "updates  successful",
        })
      }
    })

  }
  catch (err) {
    console.log(err)
  }
}

module.exports = {
  addBilling,
  addperformingTest,
  updateBilling,
  checkifActivated,
  getBilledClients
}