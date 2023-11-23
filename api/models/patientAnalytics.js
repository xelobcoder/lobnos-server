const { customError, promisifyQuery, convertKeysToLowerCase } = require("../../helper");
const logger = require("../../logger");
const bcrypt = require('bcrypt')
const connectionpool = require("../dbpool");
const database_queries = require('../database/queries')
const User = require('../LobnosAuth/user');
const Registration = require('../models/registration');
const PDFGENERATION = require("./pdfGeneration");
const { PatientQueries } = require("../../helpers/testtables");
const { response } = require("express");

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
        logger.error(err)
        customError(err.message, 500, response)
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

  async transformDataset(list, data) {
    return list.map((item, index) => {
      const filtered = data.filter((e, i) => { if (e.billingid == parseInt(item)) { return convertKeysToLowerCase(e) } });
      return { billingid: item, data: filtered, date: filtered.length > 0 ? filtered[0]['created_on'] : null }
    }).sort((a, b) => { return new Date(a.date) - new Date(b.date) });
  }


  async getParameters(data) {
    let parameters = [];
    data.map((item, index) => {
      if (!parameters.includes(item?.parameter)) { parameters.push(item?.parameter) }
    })
    return parameters;
  }

  async getPatientFullBloodCountTrend(listArray) {
    const getClientGenderPacket = await promisifyQuery(`SELECT gender,age,agetype FROM new_patients WHERE patientid = ?`, this.patientid);

    const gender = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['gender'] : null;
    const age = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['age'] : null;
    const agetype = getClientGenderPacket.length > 0 ? getClientGenderPacket[0]['agetype'] : null;

    let trendDataSet = await promisifyQuery(PatientQueries.getFbcTrend(gender, age, agetype), [this.patientid]);

    trendDataSet.map((item, index) => { return convertKeysToLowerCase(item) });

    trendDataSet = trendDataSet.length > 0 ? trendDataSet.map((item, index) => {
      return convertKeysToLowerCase(item)
    }) : [];

    const transformed = await this.transformDataset(listArray, trendDataSet);

    const parameters = await this.getParameters(trendDataSet);

    return { trend: transformed, category: 'fbc', supported: true, parameters }
  }

  getPatientTestTrend = async function (patientid, testid, testname, instances) {
    const qualifiers = new PDFGENERATION(null, testid, testname);
    const resultTable = qualifiers.isValidTest();
    const setupTable = qualifiers.isSetupAvailabble()
    if (resultTable) {
      const category = qualifiers.isCategoryAvailable();
      // billing id's of the client in format returned by sql query
      const billingidx = await promisifyQuery(PatientQueries.getBillings(resultTable), [patientid, parseInt(instances)]);
      // convert to Array of billingid's and then to string
      const billingList = billingidx.length > 0 ? billingidx.map((item, index) => { return item?.billingid }).join(',') : null;
      const listArray = billingList.split(',');
      if (category === 'chemistry') {
        if (billingList) {
          const trendDataSet = await promisifyQuery(PatientQueries.chemistryTrend(resultTable, billingList, setupTable));

          const parameters = await this.getParameters(trendDataSet);

          // we want to transform the retrieve data to a more ussable format so it can be display on the client side according to the date||billingid
          // and then sorted by date from the earliest to the latest
          const transformed = await this.transformDataset(listArray, trendDataSet);

          return { trend: transformed, category, parameters, supported: true }
        } else {
          return { trend: [], parameters: [], category, supported: true }
        }
      }
      if (category === 'fbc') {
       return this.getPatientFullBloodCountTrend(listArray);
      }
    } else {
      throw new Error('Test not recognized or scripted for!!')
    }
  }
}



module.exports = Patient;