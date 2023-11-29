const connection = require('../db');
const logger = require('../../logger');
const nodemailer = require('nodemailer');
const database_queries = require('../database/queries');
const Patients = require('./patientAnalytics');
const ejs = require('ejs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { customError, promisifyQuery } = require('../../helper');
const Registration = require('./registration');
const { testInformation, clientInformation } = require('./invoice');



const runPromise = new Patients().runqueryPromise;



class EmailService {
  constructor(appusername, apppassword, provider, company) {
    this.user = appusername || process.env.EMAILAPPNAME;
    this.password = apppassword || process.env.EMAILPASSWORD;
    this.provider = provider || process.env.EMAILPROVIDER;
    this.company = company || process.env.EMAILCOMPANY;
  }

  createTransport() {
    return nodemailer.createTransport({
      service: this.provider,
      auth: {
        user: this.user,
        pass: this.password
      }
    })
  }

  async insertEmailSettings(records) {
    try {
      const { provider, appusername, apppassword, verificationSubject, readySubject, sampleSubject, billingSubject } = records;
      const query = `INSERT INTO generalemailsettings (provider,appusername,apppassword,verificationSubject,readySubject,sampleSubject, billingSubject
    ) VALUES(?,?,?,?,?,?,?)`;
      const values = [provider, appusername, apppassword, verificationSubject, readySubject, sampleSubject, billingSubject];
      return await promisifyQuery(query, values);
    } catch (err) {
      logger.error(err);
    }
  }

  mailOptions(targetEmail, subject, html) {
    return { from: this.company, to: targetEmail, subject, html }
  }

  transportEmail = function (mailOptions) {
    if (this.user && this.password && this.provider && this.company) {
      this.createTransport().sendMail(mailOptions, (error, info) => {
        if (error) {
          logger.log("error", error);
        } else {
          console.log(`Email sent: ${info.response}`);
        }
      });
    } else {
      return false;
    }
  }

  async isEmailAuthenticated(patientid) {
    // we want to verify using the patientid if patient is authenticated via email and the email is authenticated
    let result = await runPromise(`SELECT * FROM patients_settings WHERE PATIENTID = ?`, [patientid]);
    if (result.length === 0) return false;
    else {
      const { authenticated, authenticationMode } = result[0];
      if (authenticationMode === 'EMAIL' && authenticated == 1) return true;
      else return false;
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

  async verifyEmailToken(token, response) {
    try {
      const ourDecodedToken = await jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const { patientid, email } = ourDecodedToken;

      if (patientid && email && await new Registration().checkPatientIdExist(patientid)) {
        if (response) {
          response.send({ message: 'Email authenticated.Your temporary logins will be sent to you via email', statusCode: 200, status: 'success' });
        }
        const logins = await this.fireClientTemporaryLogins(patientid);
        const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/temporaryLogins.ejs'), { data: logins });
        this.transportEmail(this.mailOptions(email, 'TEMPORARY PATIENT LOGINS', html));
      } else {
        if (response) {
          customError(`invalid token provided`, 404, response);
        } else {
          return false;
        }
      }
    } catch (err) {
      if (response) {
        customError(err, 404, response);
      }
      logger.error(err)
    }
  }


  async fireClientAuthentication(patientid, email) {
    //  1. patient only provided? get personal information and check if email address is available
    // 2. if yes, send verification message 
    // 3. if no , return 
    // --- if email address is provided as second arguments , send verification message right away
    if (patientid && !email) {
      const cI = await database_queries.getsingleid(patientid, 'new_patients', 'PATIENTID');
      if (cI.length > 0 && cI[0]['EMAIL']) {
        const emailAdd = cI[0]['EMAIL'];
        this.sendAuthenticateEmail(emailAdd, patientid);
      }
    } else if (patientid && email) {
      this.sendAuthenticateEmail(email, patientid);
    } else {
      return false;
    }
  }


  async fireClientTemporaryLogins(patientid, response) {
    if (patientid && typeof patientid === 'number') {
      const query = `SELECT * FROM patients_credentials where PATIENTID = ?`;
      const outcome = await runPromise(query, patientid);
      if (outcome && outcome.length > 0) {
        const { username, password } = outcome[0];
        const updated = outcome[0]['updated']
        if (updated === 'true') return false;
        if (response) {
          response.send({ result: outcome[0] });
        }
        if (updated === 'false') {
          return { username, password };
        }
      }
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
          const { EMAIL } = person[0];
          if (EMAIL == null) return;
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
      const emailActivation = appset[0]['emailNotification']
      if (emailActivation === 0) {
        // email service is not activated , hence return false
        return false;
      } else return true;
    }
  }

  async selectedPreferenceActivated(target) {
    const clientPreference = await this.getEmailPreference();
    if (clientPreference.length > 0 && clientPreference[0][target]) {
      if (target === 'No') return false
      else return true;
    }
  }

  async clientMailing(patientid, email, callback) {
    if (await this.isEmailServiceActivated() && await this.selectedPreferenceActivated('registration')) {
      const ptmethod = await runPromise(`SELECT * FROM patients_settings WHERE patientid = ?`, [patientid]);
      if (ptmethod.length > 0 && ptmethod[0]['method'] === 'email') {
        // default is sending message after new client is registered;
        // however if a call back is prrovided, it is treated as first class and fired
        if (callback && typeof callback === 'function') callback();
        else {
          this.fireClientAuthentication(patientid, email);
        }
      }
    }
  }




  getEmailSettings() {
    return new Promise((resolve, reject) => {
      connection.query(`SELECT * FROM generalemailsettings`, function (err, result) {
        if (err) {
          reject(err);
          logger.error(err)
        }
        resolve(result);
      })
    })
  }



  async forwardBillingReceipt(billingid) {
    // get all the test data 
    let clientTest = await testInformation(billingid);
    let personalData = await clientInformation(billingid);
    if (clientTest.length > 0 && personalData.length > 0) {
      const { EMAIL } = personalData[0];
      if (EMAIL) {
        const finalData = { testdata: clientTest, personalInfo: personalData }
        const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/billing.ejs'), { data: finalData });
        let mail = this.mailOptions(EMAIL, 'TEST BILLING RECEIPT', html)
        this.transportEmail(mail);
      } else return;
    }
  }

  async getEmailPreference() {
    return await runPromise(`SELECT * FROM emailpreference`);
  }
  logEmailsent() {

  }



}



module.exports = EmailService;

