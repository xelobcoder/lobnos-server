const logger = require('../../logger');
const nodemailer = require('nodemailer');
const database_queries = require('../database/queries');
const Patients = require('../models/patientAnalytics');
const ejs = require('ejs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { customError, promisifyQuery } = require('../../helper');
const Registration = require('../models/registration');
const { testInformation, clientInformation } = require('../models/invoice');






class EmailService {
  constructor(appusername, apppassword, provider, company) {
    this.user = appusername || process.env.EMAILAPPNAME;
    this.password = apppassword || process.env.EMAILPASSWORD;
    this.provider = provider || process.env.EMAILPROVIDER;
    this.company = company || process.env.EMAILCOMPANY;
  }

  validateCredentials() {
    return this.user && this.password && this.provider && this.company ? true : false;
  }

  createTransport() {
    return nodemailer.createTransport({ service: this.provider, auth: { user: this.user, pass: this.password}})
  }

  async insertEmailSettings(records) {
    try {
      const { provider, appusername, apppassword, verificationSubject, readySubject, sampleSubject } = records;
      const query = `INSERT INTO generalemailsettings (provider,appusername,apppassword,verificationSubject,readySubject,sampleSubject
    ) VALUES(?,?,?,?,?,?)`;
      const values = [provider, appusername, apppassword, verificationSubject, readySubject, sampleSubject];
      return await promisifyQuery(query, values);
    } catch (err) {
      logger.error(err);
      throw new Error(err?.message);
    }
  }

  mailOptions(targetEmail, subject, html) {
    return { from: this.company, to: targetEmail, subject, html }
  }

  transportEmail = function (mailOptions) {
    try {
      if (!this.validateCredentials()) return false;
      this.createTransport().sendMail(mailOptions);
      return true;
    } catch (err) {
      throw new Error('Email failed');
    }
  }

  async isEmailAuthenticated(patientid) {
    try {
      // we want to verify using the patientid if patient is authenticated via email and the email is authenticated
      let result = await runPromise(`SELECT * FROM patients_settings WHERE PATIENTID = ?`, [patientid]);
      if (result.length === 0) return false;
        const { authenticated, authenticationMode } = result[0];
        return authenticationMode === 'email' & authenticated == 1 ? true: false
    }
    catch (err) { 
       logger.error(err);
       return new Error(err);
    }
  }

  async sendAuthenticateEmail(emailAdd, patientid) {
    if (emailAdd && patientid) {
      try {
        // generate a jwt token for client
        const token = jwt.sign({ email: emailAdd, patientid }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '30m' });
        // render html using ejs templating egine
        const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/verifyemail.ejs'), { token });
        // forward the email
        this.transportEmail(this.mailOptions(emailAdd, 'EMAIL VERIFICATION', html));
      } catch (err) {
        logger.error(err)
      }
    } else return `all parameters not provided`;
  }
/**
 * 
 * @param {*} token generated user token valid for a pacticular period
 * @param {*} response response object 
 * @returns 
 */
  async verifyEmailToken(token, response) {
    try {
      const ourDecodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const { patientid, email } = ourDecodedToken;
      const isValidId = await new Registration().checkPatientIdExist(patientid);

      if (patientid && email && isValidId) {
        if (response) {
          response.send({ message: 'Email authenticated.Your temporary logins will be sent to you via email', statusCode: 200, status: 'success' });
        }
        const logins = await this.sendTemporaryEmailCredentials(patientid);
        const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/temporaryLogins.ejs'), { data: logins });
        this.transportEmail(this.mailOptions(email, 'TEMPORARY PATIENT LOGINS', html));
      } else {
        if (response) {customError(`invalid token provided`, 404, response);return;};
        return false;
      }
    } catch (err) {
      if (response) {
        customError(err, 404, response);
      }
      logger.error(err)
    }
  }


  async fireClientAuthentication(patientid, email) {
    //  1. patientid only provided? get personal information and check if email address is available
    // 2. if yes, send verification message 
    // 3. if no , return 
    // --- if email address is provided as second arguments , send verification message right away
    if (!patientid) return false;
    if (patientid && email) {
      const patternValid = email.length > 5 && email.includes(".") && email.includes("@");
       return  patternValid ? this.sendAuthenticateEmail(email, patientid) : false;
    };
    if (patientid && !email) {
      const cI = await database_queries.getsingleid(patientid, 'new_patients', 'PATIENTID');
      if (cI.length > 0 && cI[0]['email']) {
        const emailAddress = cI[0]['email'];
        this.sendAuthenticateEmail(emailAddress, patientid);
      }
    }  
  }


  async sendTemporaryEmailCredentials(patientid, response) {
    try { 
      if (!patientid || typeof patientid !== 'number') throw new Error('Patientid must be type Number');
      const query = `SELECT * FROM patients_credentials where PATIENTID = ?`;
      const outcome = await runPromise(query, patientid);
      if (outcome && outcome.length == 0 || outcome[0]['updated'] == 'true') return false;
      const { username, password } = outcome[0];
      return response ? response.send({ result: outcome[0] }) : { username, password };
    } catch (err) {
      logger.error(err);
    }
  }


  // TODO: Add the test in which the sample has been rejected
  async triggerSampleRejectionEmail(billingid, message) {
    // use thr billing id to retrieve the patientid
    try {
      const billdata = await database_queries.getsingleid(parseInt(billingid), 'billing', 'BILLINGID');
      if (billdata.length > 0) {
        const { PATIENTID } = billdata[0];
        // use the patient id to get the email
        const person = await database_queries.getsingleid(parseInt(PATIENTID), 'new_patients', 'PATIENTID')
        if (person.length > 0) {
          const { email } = person[0];
          if (email == null) return;
          const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates'+ '/sampleRejection.ejs'), {data: { message ,
          header:'SAMPLE REJECTION NOTIFICATION',labname:'Kairos Diagnostics Center'}});
          const mailOptions = this.mailOptions(EMAIL, 'SAMPLE REJECTION NOTIFICATION', html);
          this.transportEmail(mailOptions);
          return;
        } else return false;
      }
    } catch (err) {
      logger.error(err)
    }
  }

  async isEmailServiceActivated() {
    const appset = await runPromise(`SELECT emailNotification FROM applicationsettings`);
    if (appset.length > 0) {
      const emailActivation = appset[0]['emailNotification'];
      return  emailActivation === 0 ? false : true;
    }
  }

  async selectedPreferenceActivated(target) {
    const clientPreference = await this.getEmailPreference();
    if (clientPreference.length > 0 && clientPreference[0][target]) {
        return target === 'No' ? false : true;
    }
    return;
  }

  async clientMailing(patientid, email, callback) {
    if (await this.isEmailServiceActivated() && await this.selectedPreferenceActivated('registration')) {
      const ptmethod = await runPromise(`SELECT * FROM patients_settings WHERE patientid = ?`, [patientid]);
      if (ptmethod.length > 0 && ptmethod[0]['method'] === 'email') {
        // default is sending message after new client is registered;
        // however if a call back is prrovided, it is treated as first class and fired
        if (callback && typeof callback === 'function') {callback(); return;};
        this.fireClientAuthentication(patientid, email);
      }
    }
    return;
  }
    /**
       * Inserts email log data into the emaillog table in the database.
       * 
       * @param {string} type - The type of email log.
       * @param {string} target - The billingid of the email log.
       * @param {boolean} success - Indicates whether the email was sent successfully or not.
       * @returns {Promise<any>} - The result of the query.
       * @throws {Error} - If an error occurs during the execution of the query.
       */
  async emailLogdb(type, target, success) {
      try {
        if (type && target && success) {
          const query = `INSERT INTO emaillog (type,target,success) VALUES(?,?,?)`;
          const result = await promisifyQuery(query, [type, target, success]);
          return result;
        } else {
          return 'invalid parameters';
        }
      } catch (err) {
        throw new Error(err);
     }
  }




  async getEmailSettings() {
    try { return await promisifyQuery(`SELECT * FROM generalemailsettings`);} catch(err) {logger.error(err)}
  }



  async forwardBillingReceipt(billingid) {
    try {
      let testdata = await testInformation(billingid);
      let personalInfo = await clientInformation(billingid);
      const email = personalInfo[0]?.email;
      if (testdata.length > 0 && personalInfo.length > 0 && email) {
          const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/billing.ejs'), { data: {testdata,personalInfo: personalInfo[0]} });
          const mail = this.mailOptions(email, 'Transaction Alert', html)
          this.transportEmail(mail);
        return true;
      }
    return false;
    } catch (err) {
      logger.error({type:'email',err});
      throw new Error(err);
    }
  }

  async getEmailPreference() {
    return await runPromise(`SELECT * FROM emailpreference`);
  }
  logEmailsent() {

  }



}



module.exports = EmailService;

