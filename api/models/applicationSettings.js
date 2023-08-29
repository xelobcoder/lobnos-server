const connection = require("../db");

const getApplicationSettings = async function (request, response) {
  const query = `SELECT * FROM applicationsettings`;

  connection.query(query, function (err, result) {
    if (err) {
      response.send({
        message: err.message,
        statusCode: 500,
        status: "error"
      })
    }
    if (result) {
      response.send({
        result,
        statusCode: 200,
        status: 'success'
      })
    }
  })
}



const updateApplicationSettings = async function (request, response) {
  const { bulkregistration, fontsize, textcolor, DeactivateBilling24hrs, BackgroundColor, PaidBillsBeforeTransaction, completeFlow, approvalbeforeprinting } = request.body;

  const query = `
      INSERT INTO applicationsettings (
      bulkregistration,
      fontsize,
      textcolor,
      BackgroundColor,
      DeactivateBilling24hrs,
      PaidBillsBeforeTransaction,
      completeFlow,
      approvalbeforeprinting) VALUES (?,?,?,?,?,?,?,?)
`

  const TruncateTable = `TRUNCATE TABLE applicationsettings`;

  const values = [bulkregistration, fontsize, textcolor, BackgroundColor, DeactivateBilling24hrs, PaidBillsBeforeTransaction, completeFlow, approvalbeforeprinting];

  connection.query(TruncateTable, function (err, result) {
    if (err) {
      throw err;
    }
    if (result) {
      connection.query(query, values, function (err, result) {
        if (err) {
          console.log(err)
          response.send({
            message: err.message,
            statusCode: 401,
            status: 'error'
          })
        }
        if (result) {
          response.send({
            message: 'Application settings updated successfully',
            statusCode: 200,
            status: 'success'
          })
        }
      })
    }
  })
}



module.exports = {
  getApplicationSettings,
  updateApplicationSettings
}