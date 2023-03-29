const { PrismaClient } = require('@prisma/client');
const { response } = require('express');
const connection = require('./db')
const prisma = new PrismaClient();

// add test to performing test
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
      let values = [patientid, billingid, sanitize(test), urgency, samplingCenter];
      let sql = `INSERT INTO performing_test (PATIENTID,BILLINGID,TEST,URGENCY,SAMPLING_CENTER) VALUES (?,?,?,?,?)`;
      connection.query(sql, values, (err, result) => {
        if (err) throw err;
        res.status(200).json({ message: 'success' });
      })
    }
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

module.exports = {
  addBilling,
  addperformingTest,
  checkifActivated,
  getBilledClients
}