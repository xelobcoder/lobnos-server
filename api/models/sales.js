const logger = require('../../logger.js');
const connection = require('../db.js');

const sales = {};



sales.generalSales = async function (request, response, target, branch) {
  const { patientid } = request.query;
  // get all sales sum grouped by target i.e sum by year, month or day
  let query = '';

  if (target == 'yearly') {
    query = `SELECT 
    SUM(PAYABLE) AS salesAmount,
    COUNT(b.BILLINGID) AS totalCases,
    YEAR(pt.DATE) AS 'Year'
    FROM billing AS b
    INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID`;
    if (patientid) {
      query += ` WHERE b.PATIENTID = ${patientid}`
    }
    if (branch != 'all') {
      query += ` AND pt.SAMPLING_CENTER = ${branch}`;
    }
    query += ` GROUP BY YEAR(pt.DATE)`;
  } else if (target == 'monthly') {
    query = `SELECT
    SUM(PAYABLE) AS salesAmount,
    COUNT(b.BILLINGID) AS totalCases,
    MONTHNAME(pt.DATE) AS 'Month'
    FROM billing AS b
    INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
    WHERE YEAR(pt.DATE) = YEAR(CURDATE())
`;
    if (patientid) {
      query += ` AND b.PATIENTID = ${patientid}`
    }

    if (branch != 'all') {
      query += ` AND pt.SAMPLING_CENTER = ${branch}`;
    }

    query += ` GROUP BY MONTH(pt.DATE) `

  } else if (target == 'daily') {
    query = `
    SELECT
    SUM(b.PAYABLE) AS salesAmount,
    COUNT(b.BILLINGID) AS totalCases,
    SUM(b.DISCOUNT) AS discount,
    SUM(PAID_AMOUNT) AS totalAmountReceived,
    pt.DATE AS date,
        DAY(pt.DATE) AS 'Day'
    FROM billing AS b
    INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
    WHERE YEAR(pt.DATE) = YEAR(CURDATE()) AND MONTH(pt.DATE) = MONTH(CURDATE())
`;
    if (patientid) {
      query += ` AND b.PATIENTID = ${patientid}`;
    }

    if (branch != 'all') {
      query += `AND pt.SAMPLING_CENTER = ${branch}`;
    }

    query += ` GROUP BY DAY(pt.DATE)`
  } else {
    // weekly
    query = `
       SELECT
        SUM(PAYABLE) AS salesAmount,
        CASE
            WHEN DAY(pt.DATE) BETWEEN 1 AND 7 THEN 'First Week'
            WHEN DAY(pt.DATE) BETWEEN 8 AND 14 THEN 'Second Week'
            WHEN DAY(pt.DATE) BETWEEN 15 AND 21 THEN 'Third Week'
            WHEN DAY(pt.DATE) BETWEEN 22 AND 31 THEN 'Fourth Week'
        END AS 'Week',
        COUNT(b.BILLINGID) AS totalCases
      FROM billing AS b
      INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
      WHERE YEAR(pt.DATE) = YEAR(CURDATE())
      AND MONTH(pt.DATE) = MONTH(CURDATE())`
    if (patientid) {
      query += ` AND b.PATIENTID = ${patientid}`
    }
    if (branch != 'all') {
      query += `AND pt.SAMPLING_CENTER = ${branch}`;
    }
    query += ` GROUP BY WEEK(pt.DATE)`
  }


  connection.query(query, function (err, result) {
    if (err) {
      logger.error(err)
      console.log(err)
      // response.send({
      //   message: err.message,
      //   statusCode: 500,
      //   status: 'error'
      // })
    } else {
      response.send({
        statusCode: 200,
        status: 'success',
        result
      })
    }
  })

}


// sales.ClientSummary = 



module.exports = sales;