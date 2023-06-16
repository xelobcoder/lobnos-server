const { response } = require("express");
const connection = require("./db");
const { rejectedSample } = require("./models/rejected");


let filteredTest_in_date = function (test, res) {
  // check if array
  const isArray = Array.isArray(test) ? true : false;
  // check is empty or not

  const isEmpty = test.length == 0 ? true : false;

  if (isArray && !isEmpty) {
    let today = new Date();

    let filtereddate = test.filter(function (item) {
      // filter today from test array
      let date = new Date(item.DATE);
      return date.getDate() == today.getDate() && date.getMonth() == today.getMonth() && date.getFullYear() == today.getFullYear();
    })

    res.send(filtereddate);
  }
  else {
    res.send(test);
  }
}

const getPhelobotomy = async (req, res) => {
  let myquery = `
  SELECT 
      CONCAT(p.FIRSTNAME," ",p.MIDDLENAME," ",p.LASTNAME) AS FULLNAME,
      p.PATIENTID,
      CONCAT(p.AGE," ", p.AGETYPE) AS AGE,
      p.GENDER,
      p.MOBILE_NUMBER AS MOBILENUMBER,
      b.BILLINGID AS BILLINGID,
      DATE(t.DATE) AS DATE,
      t.URGENCY as URGENCY
  FROM new_patients AS p
    INNER JOIN billing AS b ON p.PATIENTID = b.PATIENTID
    INNER JOIN performing_test as t ON b.BILLINGID = t.BILLINGID
    INNER JOIN test_ascension as ts ON b.BILLINGID = ts.BILLINGID
    INNER JOIN test_panels as v ON v.ID = ts.TESTID
  WHERE ts.collection = 'false'
  GROUP BY b.BILLINGID
  ORDER BY b.BILLINGID DESC LIMIT 100
  `;

  connection.query(myquery, (err, result) => {
    if (err) throw err;
    res.send(result)
  })
}

const get_client_query = function (req, res) {
  let { billingid } = req.query;

  if (!billingid) {
    res.send({
      statusCode: 200,
      status: 'success',
      message: 'billingid required'
    })
  }

  if (billingid) {
    // parseint to ensure a valid integer is queried againts db
    billingid = parseInt(billingid);

    const query = `SELECT * FROM NEW_PATIENTS AS np
    INNER JOIN BILLING AS b ON np.PATIENTID = b.PATIENTID
    INNER JOIN PERFORMING_TEST AS p ON b.BILLINGID = p.BILLINGID
    WHERE p.BILLINGID = ?`

    connection.query(query, billingid, function (err, result) {
      if (err) {
        res.send({
          message: 'error', statusCode: 500, message: err.sqlMessage
        })
      }
      else {
        res.send({
          message: 'success',
          statusCode: 200,
          result
        })
      }
    })
  }
}


const updatePhelobotomy = async (id, content, status, alltaken, completedTime, req, res) => {
  let myquery = `UPDATE 
  performing_test 
  SET PHELOBOTOMY_STATUS = '${status}',
  PHELOBOTOMY_MESSAGE = '${content}',
  ALL_SAMPLE_TAKEN = '${alltaken}',
  TIME_PHELOBOTOMY_COMPLETED = TIMESTAMP('${completedTime}')
  WHERE ID = ${id}`;
  connection.query(myquery, (err, result) => {
    if (err) throw err;
    res.send(result);
  }
  )
}


const postSection = function (request, response) {
  const { testInfo, message, alltaken, billingid } = request.body;

  //1. update test test_ascension 
  // 2. upate performing test
  const checkifExist = function (billingid, testid, collected) {
    connection.query(`SELECT * FROM TEST_ASCENSION WHERE BILLINGID = ? AND TESTID = ?`, [billingid, testid], function (err, result) {
      if (err) {
        throw err;
      }
      else {
        updateResult(billingid, testid, collected)
      }
    })
  }



  const updateResult = function (billingid, testid, collected) {
    if (collected === true) {
      const updateStatement = `UPDATE TEST_ASCENSION SET COLLECTION = 'true',
      COLLECTION_DATE = CURDATE() WHERE BILLINGID = ? AND TESTID =? `

      connection.query(updateStatement, [billingid, testid], function (err, result) {
        if (err) {
          throw err;
        }
        else {
          console.log(result)
        }
      })
    }

  }


  if (Array.isArray(testInfo)) {
    for (let i = 0; i <= testInfo.length; i++) {
      const { billingid, testid, collected } = testInfo[i];
      checkifExist(billingid, testid, collected)
    }
  } else {
    response.send({
      message: `${testInfo}, an array expected`,
      status: 'error', statusCode: 401
    })
  }

}

const getAscensionWithDetails = async function (billingid, response) {
  const statement = `SELECT * FROM test_ascension AS t 
  INNER JOIN test_panels AS p
  ON t.testid = p.ID
  WHERE billingid = ${billingid} AND t.collection = 'false'`;

  connection.query(statement, function (err, result) {
    if (err) {
      throw err;
    }

    response.send({
      result,
      status: 'success',
      statusCode: 200
    })
  })
}


module.exports = {
  getPhelobotomy,
  updatePhelobotomy,
  get_client_query,
  postSection,
  getAscensionWithDetails
}