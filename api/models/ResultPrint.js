const connection = require("../db");
const { Result } = require('./result');
const ResultClass = new Result();
const errMessage = ResultClass.errMessage
const pushResponse = ResultClass.pushResponse

class ResultPrint {
   constructor(billingid) {
      this.billingid = billingid;
   }


   get_printables = (request, response) => {
      const { querydate, content } = request.query;
      let modelQuery = `
      SELECT 
      ta.billingid AS billingid,
      CASE
         WHEN COUNT(ta.testid) = (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Ready'
         WHEN COUNT(ta.testid) < (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Partial'
         ELSE 'Unknown'
      END AS status,
      ta.ready,
      ta.ready_date,
      b.OUTSTANDING AS outstanding,
      b.PAID_AMOUNT AS paid_amount,
      np.PATIENTID AS patientid,
      COUNT(ta.testid) AS readycount,
      (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,
      CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) AS fullname
    FROM 
      TEST_ASCENSION AS ta 
      INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
      INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
    WHERE 
      ta.ready = 'true'
   `

      const params = [];

      // Add filters if provided
      if (querydate) {
         modelQuery += ' AND DATE(ta.ready_date) = ?';
         params.push(querydate);
      } else {
         modelQuery += ' AND DATE(ta.ready_date) = CURDATE()';
      }

      if (content) {
         modelQuery += ' AND ta.billingid = ?';
         params.push(content);
      }

      modelQuery += ' GROUP BY ta.billingid ORDER BY ta.billingid DESC LIMIT 100';


      connection.query(modelQuery,params, (err, result) => {
         if (err) {
            errMessage.call(this, err, response);
         }
         else[
            response.send(result)
         ]
      })
   }
}



module.exports = ResultPrint;