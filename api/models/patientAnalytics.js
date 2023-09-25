const { customError } = require("../../helper");
const logger = require("../../logger");
const bcrypt = require('bcrypt')
const connectionpool = require("../dbpool");
const database_queries = require('../database/queries')
const User = require('../LobnosAuth/user');
const Registration = require('../models/registration');

/**
 * Represents a Patient, a subclass of the Registration class.
 * Contains methods for retrieving transactions by date, updating patient credentials, updating notification settings, and checking if a test is valid for analysis.
 *
 * @class
 * @extends Registration
 */
class Patient extends Registration {
  constructor(patientid) {
    super(patientid);
  }

  runqueryPromise = async function (query, values) {
    return new Promise((resolve, reject) => {

      connectionpool.query(query, values, function (err, result) {
        if (err) {
          reject(err)
        }
        else {
          resolve(result)
        }
      })
    })
  }

  /**
   * 
   * @param {patientid} patientid number represent patient id
   * @param {to} to  string date represent date to
   * @param {from} from string  represent date from
   * @returns {Promise} Promise returns a promise 
   */
  getTransactionsByDate = async function (patientid, to, from) {
    const isArgGiven = arguments.length > 0
      && typeof arguments[0] == 'number' ? patientid : this.patientid;
    if (await this.checkPatientIdExist()) {
      let query = `SELECT DATE(DATE)  AS TransactionsDate,BILLINGID AS TransactionId FROM performing_test
      WHERE PATIENTID = ? ORDER BY DATE DESC `;
      let values = [isArgGiven]
      if (from && to) {
        query += `AND DATE BETWEEN '${from}' AND '${to}`
        values = [...values, from, to]
      }
      // return a promise
      return this.runqueryPromise(query, values)
    } else {
      return `patientid ${isArgGiven} not found`
    }
  }

  updateCredentials = async function (request, response) {
    const { opassword, npassword, nppassword, username } = request.body;
    let oldpassworldMatched = null;
    const isValid = await this.checkPatientIdExist(username);
    const matched = nppassword === nppassword;
    const db_old_password = await database_queries.getsingleid(username, 'patients_credentials', 'patientid');

    if (Array.isArray(db_old_password) && db_old_password.length > 0) {
      const { username, password, updated } = db_old_password[0];
      if (updated == 'true') {
        const compare = await bcrypt.compare(opassword, password);
        oldpassworldMatched = compare;
      } else {
        oldpassworldMatched = opassword === password;
      }
    }

    if (!isValid) {
      customError('Invalid membership id or username', 404, response);
      return;
    }
    if (!matched) {
      customError('new password match error', 404, response);
      return;
    }

    if (!oldpassworldMatched) { customError(`invalid old password credentials`, 404, response) };

    if (isValid && matched && oldpassworldMatched) {
      const hashedPassword = await new User(username, npassword).hashPassword()
      const updateQuery = `UPDATE patients_credentials SET password = ?,  updated = 'true' WHERE PATIENTID = ?`;
      try {
        const result = await this.runqueryPromise(updateQuery, [hashedPassword, username]);
        if (result && result.affectedRows == 1) {
          response.send({ status: 'success', statusCode: 200, message: 'patient credentials updated successfully' })
        }
      } catch (err) {
        console.log(err)
      }
    }
  }

  updateNotificationSettings = async function (request, response) {
    const { mode, method, notify, patientid } = request.body;
    // mode represent mode of delivery the result, notify - should client be notified when result is ready and method represent mehtod of 
    // send the Notification message
    if (mode && method && notify && patientid) {
      const updateQuery = `UPDATE patients_settings SET mode = ?, method = ? , notify = ? WHERE patientid = ?`;
      const updated = await this.runqueryPromise(updateQuery, [mode, method, notify, parseInt(patientid)]);
      if (updated && updated.affectedRows == 1) {
        response.send({ status: 'success', statusCode: 200, message: 'patient settings updated successfully' })
      }
    } else {
      customError(`mode of result,method of delivery and notification settings required`, 404, response)
    }
  }

    isValidForAnalysis = async function (testid) {
      // 1. get the category of the test
      // 2. determine the parameter variations, eg hematological test do not have mu;tiple params like malaria, widal etc, 
      // same cant be said about renal functional
      // 3. Initial suppeort will be for chemistry results
      // 4. query the db table and return all params by count determined in the request query

    }
}


// console.log(new Patient())

module.exports = Patient;