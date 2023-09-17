const { customError } = require("../../helper");
const logger = require("../../logger");
const connectionpool = require("../dbpool");

class Patient {
  constructor(patientid) {
    this.patientid = patientid;
  }

  checkIdValidity = async function (patientid) {
    const query = `SELECT * FROM new_patients WHERE PATIENTID  = ?`;

    return new Promise((resolve, reject) => {

      connectionpool.query(query, patientid, function (err, result) {
        if (err) {
          reject(err)
        }
        else {
          result.length > 0 ? resolve(true) : resolve(false);
        }
      })
    })
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
    if (await this.checkIdValidity(isArgGiven) === true) {
      let query = `SELECT DATE(DATE)  AS TransactionsDate,BILLINGID AS TransactionId FROM performing_test
      WHERE PATIENTID = ? `;
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

  isValidForAnalysis = async function (testid)  {
     
  }
}



module.exports = Patient;