const { customError } = require("../../helper");
const logger = require("../../logger");
const connectionpool = require("../dbpool");
const Registration = require('../models/registration');

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

  isValidForAnalysis = async function (testid) {

  }
}




module.exports = Patient;