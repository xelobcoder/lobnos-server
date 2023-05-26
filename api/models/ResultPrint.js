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
  let modelQuery = `
   SELECT 
      ta.billingid,
      ta.ready,
      ta.ready_date,
      b.OUTSTANDING,
      b.PAID_AMOUNT,
      np.PATIENTID,
      COUNT(ta.testid) AS TESTCOUNT,
      (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid AND ready = 'true') AS READYCOUNT,
      CONCAT(np.FIRSTNAME, " ", np.MIDDLENAME, " ", np.LASTNAME) AS FULLNAME
   FROM 
      TEST_ASCENSION AS ta 
      INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
      INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
   GROUP BY
      ta.billingid
   ORDER BY ta.billingid DESC LIMIT 100
   `


  connection.query(modelQuery, (err, result) => {
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