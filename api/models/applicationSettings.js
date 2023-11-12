const { customError, promisifyQuery } = require("../../helper");
const logger = require("../../logger");
const connection = require("../db");

const applicationSettings = {};

applicationSettings.getApplicationSettings = async function (request, response) {
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



applicationSettings.updateApplicationSettings = async function (request, response) {
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
      logger.err(err)
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


applicationSettings.updateSmsSettings = async function (request, response) {
  connection.query(
    `UPDATE applicationsettings SET smsSettings = ?`, [JSON.stringify(request.body)], (err, result) => {
      if (err) { logger.error(err) } else { response.send({ statusCode: 200, message: 'sms settings updated', status: 'success' }) }
    }
  )
}


applicationSettings.getSmsSettings = async function (request, response) {
  connection.query(`SELECT smsSettings FROM applicationsettings`, function (err, result) {
    if (err) { logger.error(err) }
    else {
      if (result.length > 0) {
        const { smsSettings } = result[0];
        response.send(JSON.parse(smsSettings))
      } else {
        response.send({ registration: '', result: '', sample: '', birthday: '' })
      }
    }
  })
}



applicationSettings.updatePreference = async function (request, response) {
  const { registration, rejection, result, approval, transactions, birthday } = request.body;
  const query = `UPDATE emailpreference SET registration = ?, result = ? , rejection = ?, approval  = ? , transactions = ? ,updated_on = NOW(),
  birthday = ? WHERE id = 1`;

  const values = [registration, result, rejection, approval, transactions, birthday];

  connection.query(query, values, function (err, result) {
    if (err) {
      customError(err, 500, response);
      logger.error(err);
    } else {
      response.send({
        status: "success",
        message: "updated sucessfully",
        statusCode: 200,
      });
    }
  })
}


applicationSettings.addTax = async function (request, response) {
  const { value, name } = request.body;
  if (value && name) {
    try {
      // check if tax name exist 
      const isExist = `SELECT * FROM tax WHERE name = ?`;
      const existCount = await promisifyQuery(isExist, name);

      if (Array.isArray(existCount) && existCount.length > 0) {
        response.send({ message: 'tax with such name availble', status: 'success', statusCode: 406 })
      }
      else {
        const query = `INSERT INTO tax (name,value) VALUES (?,?)`;
        let result = await promisifyQuery(query, [name, value]);
        const { affectedRows } = result;
        response.send({ message: affectedRows > 0 ? 'tax added successfully' : 'Error inserting new tax', status: 'success', statusCode: 200 })
      }
    } catch (err) {
      logger.error(err);
      customError(`error occured`, 500, response);
    }
  } else {
    customError('name and value required', 401, response);
  }
}


applicationSettings.getTax = async function (request, response) {
  let result = await promisifyQuery(`SELECT * FROM tax`);
  response.send({ status: 'success', statusCode: 200, result })
}


applicationSettings.updateTaxStatus = async function (request, response) {
  const { id } = request.query;

}


module.exports = applicationSettings;