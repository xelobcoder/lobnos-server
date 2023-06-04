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
const addperformingTest = (patientid, billingid, urgency, samplingCenter, paymentmode, paid, test, res) => {
  // // check if test is an array or a string , if string,check to see if is not empty
  // const isValid = Array.isArray(test) || (typeof test == 'string' && test != '') ? true : false;
  // if test is an array
  // if patient id and billing id are not empty
  if (patientid != '' && billingid != '') {
    // push data into performing test table
    let values = [
      patientid,
      billingid,
      urgency,
      samplingCenter,
    ];
    let sql = `INSERT INTO performing_test (PATIENTID,BILLINGID,URGENCY,SAMPLING_CENTER) VALUES (?,?,?,?)`;
    connection.query(sql, values, (err, result) => {
      if (err) {
        throw err;
      }
      else {
        billingHx(billingid, paymentmode, paid, test, res)
      }
    });
  } else {
    return `${patientid} or ${billingid} not provided`
  }
}


const AddtoTestAscenstion = function (test, billingid, res) {
  const insertion = function (billingid, testid) {
    connection.query(`INSERT INTO TEST_ASCENSION (BILLINGID,TESTID) VALUES (?,?)`, [billingid, testid], function (err, result) {
      if (err) { throw err }
      console.log(result)
    })
  }
  if (Array.isArray(test)) {
    let count = 0;
    test.forEach((item, index) => { insertion(billingid, item); count++ })
    setTimeout(function () {
      if (count == test.length) {
        res.status(200).json({
          message: 'insertion successfully',
          statusCode: 200,
          status: 'success'
        })
      }
    }, 500)
  }
}


const billingHx = function (billingid, paymentmode, paid, test, res) {
  // insert to billing hx 
  const hxStatement = `INSERT INTO BILLINGHX (BILLINGID,PAYMENTMODE,AMOUNT) VALUES (?,?,?)`;

  connection.query(hxStatement, [billingid, paymentmode, paid], function (err, result) {
    if (err) {
      throw err;
    }
    AddtoTestAscenstion(test, billingid, res)
  })
}

// add new billing
const addBilling = async (req, res) => {
  const { patientid, clinicians, organizations, test, cost, paid, urgency, discount, paymentmode, samplingCenter } = req.body;

  // get outstanding balance
  let outstanding = cost - discount - paid;
  // get type
  let type = paymentmode == 'invoice' ? 'POSTPAID' : 'PREPAID';
  // billing data
  let values = [parseInt(patientid), clinicians, organizations, paid, cost, type, outstanding, parseInt(discount)];



  // insert billing data into billing stable
  let sql = `INSERT INTO billing (PATIENTID,CLINICIAN,ORGANIZATION,PAID_AMOUNT,PAYABLE,TYPE,OUTSTANDING,DISCOUNT) VALUES (?,?,?,?,?,?,?,?)`;

  connection.query(sql, values, (err, result) => {
    if (err) throw err;
    if (result) {
      let billingid = result.insertId;
      // add test to performing test
      addperformingTest(patientid, billingid, urgency, samplingCenter, paymentmode, paid, test, res)
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
  const mysql = `
   SELECT b.BILLINGID AS BILLINGID,
        b.PAID_AMOUNT AS PAID,
        b.PAYABLE,
        b.PATIENTID,
        b.TYPE,
        b.OUTSTANDING,
        b.DISCOUNT,
        DATE(p.DATE) AS DATE,
        c.NAME AS CLINICIAN,
        pm.PaymentMode AS PAYMENT_MODE,
        o.NAME AS ORGANIZATION
    FROM billing AS b
        INNER JOIN performing_test AS p ON b.PATIENTID = p.PATIENTID
        INNER JOIN organization AS o ON o.ID = B.ORGANIZATION
        INNER JOIN clinician AS c ON c.ID = b.CLINICIAN
        INNER JOIN billinghx AS bhx ON bhx.Billingid = b.BILLINGID
        INNER JOIN paymentmodes AS pm ON pm.KeyID = bhx.PaymentMode
    GROUP BY b.BILLINGID
    ORDER BY B.BILLINGID DESC
    LIMIT 100
  `;

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

    console.log(request.body)

    const updateCurrentBill = `UPDATE BILLING 
        SET PAYABLE = ${totalcost},
        OUTSTANDING = ${outstanding}
    WHERE BILLINGID = ${billingid}`;

    connection.beginTransaction(function (err) {
      if (err) { throw err; }

      connection.query(updateCurrentBill, function (error, results, fields) {
        if (error) {
          return connection.rollback(function () {
            throw error;
          });
        }

        connection.query(`SELECT * FROM TEST_ASCENSION WHERE BILLINGID = ?`, [billingid], function (err, result) {
          if (err) {
            return connection.rollback(function () {
              throw err;
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
                console.log(`${db_testid[i]} found in current list hence skipping......`)
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
                    throw err;
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
                    throw err;
                  })
                }
                console.log(result)
              })
            })
          }



          connection.commit(function (err) {
            if (err) {
              return connection.rollback(function () {
                throw err;
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
  addBilling,
  addperformingTest,
  updateBilling,
  checkifActivated,
  getBilledClients
}