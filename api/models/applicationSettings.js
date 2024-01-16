const { customError, promisifyQuery } = require("../../helper");
const logger = require("../../logger");
const EmailService = require("../EmailServices/email");

const applicationSettings = {};

applicationSettings.getApplicationSettings = async function (request, response) {
  const query = `SELECT * FROM applicationsettings`;
  try {
    let result = await promisifyQuery(query);
    if (!response) {return promisifyQuery(query)} else {response.send({message:'success', status:'success', statusCode:200, result})}
  } catch (err) {logger.error(err)}
}



applicationSettings.updateApplicationSettings = async function (request, response) {
  const { bulkregistration,emailNotification, fontsize, textcolor, DeactivateBilling24hrs, BackgroundColor, PaidBillsBeforeTransaction, completeFlow, approvalbeforeprinting } = request.body;
  const query = `INSERT INTO applicationsettings (bulkregistration,fontsize,textcolor,BackgroundColor,DeactivateBilling24hrs,PaidBillsBeforeTransaction,completeFlow,approvalbeforeprinting,emailNotification) VALUES (?,?,?,?,?,?,?,?,?)`;
  const TruncateTable = `TRUNCATE TABLE applicationsettings`;
  const values = [bulkregistration, fontsize, textcolor, BackgroundColor, DeactivateBilling24hrs, PaidBillsBeforeTransaction, completeFlow, approvalbeforeprinting,emailNotification];
  try {
    const result = await promisifyQuery(TruncateTable);
    if (result) {
      const isUpdated = await promisifyQuery(query, values);
      isUpdated && response.send({ message: 'Applications settings updated successfully', statusCode: 200, status: 'success' })
    }
  } catch (err) {
    logger.error(err);
    customError(err?.message, 500, response);
  }
}


applicationSettings.updateSmsSettings = async function (request, response) {
  try {
    const updateSms = await promisifyQuery(`UPDATE applicationsettings SET smsSettings = ?`, [JSON.stringify(request.body)]);
    if (updateSms) {
      response.send({ message: 'sms settings updated successfully', status: 'success', statusCode: 200 })
    }
  } catch (err) { customError(err?.message, 500, response) }
}


applicationSettings.getSmsSettings = async function (request, response) {
  try {
    const result = await promisifyQuery(`SELECT smsSettings FROM applicationsettings`);
    if (result.length > 0) {
      const { smsSettings } = result[0];
      response.send(JSON.parse(smsSettings))
    } else {
      response.send({ registration: '', result: '', sample: '', birthday: '' })
    }
  } catch {
    logger.error(err);
  }
}



applicationSettings.updatePreference = async function (request, response) {
  const { registration, rejection, result, approval, transactions, birthday, billing } = request.body;
  // truncate the table
  const truncate = await promisifyQuery(`TRUNCATE TABLE emailpreference`);

  if (!truncate) { customError('error occured', 500, response); return }
  
  const query = `INSERT INTO emailpreference (registration,result,rejection,approval,transactions,birthday,billing) VALUES (?,?,?,?,?,?,?)`;
  const values = [registration, result, rejection, approval, transactions, birthday,billing];
  try {
    const result = await promisifyQuery(query, values);
    if (result) {
      response.send({ message: result.affectedRows ==  1 ? 'updated successfully' : 'update failed', status: 'success', statusCode: 200 });
    }
  } catch (err) {
    logger.error(err);
    customError(err?.message, 500, response);
  }
}


applicationSettings.generalEmailSettings = async function (records) {
  console.log(records)
  if (typeof records != 'object') return false;
  // first truncate the table
  const truncate = `TRUNCATE TABLE generalemailsettings`;
  let isTruncated = await promisifyQuery(truncate);
  if (isTruncated) { 
    return new EmailService().insertEmailSettings(records);
  }
}
 
applicationSettings.getGeneralEmaiSettings = async function () {
  try {
    const query = `SELECT * FROM generalemailsettings`;
    return await promisifyQuery(query);
  } catch (err) {
    logger.error(err);
    return false;
  }
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
  try {
    let result = await promisifyQuery(`SELECT * FROM tax`);
    response.send({ status: 'success', statusCode: 200, result })
  } catch (err) {
    logger.error(err);
    customError(err?.message, 500, response); 
  }
}


applicationSettings.updateTaxStatus = async function (request, response) {
  const { id } = request.query;
  
}


module.exports = applicationSettings;