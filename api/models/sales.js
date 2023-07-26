const connection = require('../db.js');

const sales = {};



sales.generalSales = async function (request, response, target) {
  // get all sales sum grouped by target i.e sum by year, month or day
  let query = '';

  if (target == 'yearly') {
    query = `SELECT 
    SUM(PAID_AMOUNT) AS salesAmount,
    COUNT(b.BILLINGID) AS totalCases,
    YEAR(pt.DATE) AS 'Year'
    FROM billing AS b
    INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
    GROUP BY YEAR(pt.DATE)
`;
  } else if (target == 'monthly') {
    query = `SELECT
    SUM(PAID_AMOUNT) AS salesAmount,
    COUNT(b.BILLINGID) AS totalCases,
    MONTHNAME(pt.DATE) AS 'Month'
    FROM billing AS b
    INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
    WHERE YEAR(pt.DATE) = YEAR(CURDATE())
    GROUP BY MONTH(pt.DATE) 
`;

  } else if (target == 'daily') {
    query = `
    SELECT
    SUM(PAID_AMOUNT) AS salesAmount,
    COUNT(b.BILLINGID) AS totalCases,
        DAY(pt.DATE) AS 'Day'
    FROM billing AS b
    INNER JOIN performing_test as pt ON b.BILLINGID = pt.BILLINGID
    WHERE YEAR(pt.DATE) = YEAR(CURDATE()) AND MONTH(pt.DATE) = MONTH(CURDATE())
    GROUP BY DAY(pt.DATE)
`;
  } else {
    // weekly
    query = `
       SELECT
        SUM(PAID_AMOUNT) AS salesAmount,
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
      AND MONTH(pt.DATE) = MONTH(CURDATE())
      GROUP BY 'Week';
`;
  }


  connection.query(query, function (err, result) {
    if (err) {
      response.send({
        message: err.message,
        statusCode: 500,
        status: 'error'
      })
    } else {
      response.send({
        statusCode: 200,
        status: 'success',
        result
      })
    }
  })

}

module.exports = sales;