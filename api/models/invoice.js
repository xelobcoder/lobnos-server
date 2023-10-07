const connection = require('../db');
const { customError } = require('../../helper');

const testInformation = async function (billingid) {
  return new Promise((resolve, reject) => {
    const query = `SELECT PRICE,NAME FROM test_panels WHERE ID IN (SELECT TESTID FROM test_ascension WHERE BILLINGID = ${billingid})`;
    connection.query(query, (err, result) => {
      if (err) { reject(err); } else { resolve(result) }
    })
  })
}


const clientInformation = async function (billingid) {
  return new Promise((resolve, reject) => {
    const query = `SELECT 
              CONCAT(np.FIRSTNAME," ",np.MIDDLENAME," ",np.LASTNAME) AS FULLNAME,
              AGE,
              AGETYPE,
              BILLINGID,
              DATE,
              PAID_AMOUNT,
              DISCOUNT,
              PAYABLE,
              MOBILE_NUMBER,
              OUTSTANDING,
              GENDER,
              EMAIL,
              DOB
              FROM BILLING AS bb 
          INNER JOIN new_patients AS np ON np.PATIENTID = bb.PATIENTID
          WHERE bb.BILLINGID = ${billingid};
     `;
    connection.query(query, (err, result) => {
      if (err) { reject(err); } else { resolve(result) }
    })
  })
}


async function getBillingInvoiceData(request, response) {
  // we want to get the personal information of the client 
  // and test subscribed to , amount paid and outdtanding bill if any

  const { billingid } = request.query;

  if (billingid) {
    let Invoice = {}

    try {
      Invoice.testInformation = await testInformation(billingid);
      Invoice.clientInformation = await clientInformation(billingid)
      response.send({
        result: {
          testInformation: Invoice.testInformation.length > 0 ? Invoice.testInformation : [],
          clientInformation: Invoice.clientInformation.length > 0 ? Invoice.clientInformation[0] : {}
        },
        message: 'success',
        statusCode: 200
      })
    } catch (err) {
      customError(err?.message || err, 500, response)
    }
  } else {
    customError('billingid required in query', 401, response)
  }
}


module.exports = { getBillingInvoiceData, testInformation,clientInformation }