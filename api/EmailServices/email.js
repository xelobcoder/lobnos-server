const logger = require('../../logger');
const nodemailer = require('nodemailer');
const database_queries = require('../database/queries');
const ejs = require('ejs');
const path = require('path');
const { customError, promisifyQuery, convertKeysToLowerCase } = require('../../helper');
const Registration = require('../models/registration');
const { testInformation, clientInformation } = require('../models/invoice');
const configuration = require('../../helpers/configuration');
const User = require('../LobnosAuth/user');


class EmailService {
  constructor(employeeid) {
    this.employeeid = employeeid;
  }
  validateCredentials(user, password, provider, company) {
    return user && password && provider && company ? true : false;
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
    this.company = 'Kairos Diagnostics Center';
    return { from: this.company, to: targetEmail, subject, html }
  }

  transportEmail = async function (mailOptions) {
    try {
      const settings = await this.getEmailSettings();
      if (settings.length === 0) return 'email settings not provided';
      const { email, apppassword, provider } = settings[0];
      this.user = email;
      this.password = apppassword;
      this.provider = provider;
      this.company = 'Kairos Diagnostics Center';

      if (!this.validateCredentials(this.user, this.password, this.provider, this.company)) return 'invalid credentials';
      
      this.createTransport(this.provider, this.user, this.password).sendMail(mailOptions);
      // true, a success
      return true;
    } catch (err) {
      throw new Error('Email failed');
    }
  }

 /**
       * Retrieves a range of email log records from the database.
       * 
       * @param {number} start - The starting index of the email log records to retrieve.
       * @param {number} [limit=20] - The maximum number of email log records to retrieve. Default is 20.
       * @param {object} [response] - The response object to send the result to. If not provided, the result will be returned directly.
       * @returns {Array} - An array of objects representing the email log records within the specified range.
       * Each object contains the following properties:
       *   - id (number): The unique identifier of the email log record.
       *   - type (string): The type of email log (e.g., "sent", "received").
       *   - target (string): The target email address of the email log.
       *   - success (boolean): Indicates whether the email was sent successfully or not.
       */
  async getEmailLog(start, limit = 10, response) {
      try {
          if (!start) return false;
          const end = parseInt(start) + parseInt(limit);
          const query = `SELECT * FROM emaillog WHERE id BETWEEN ? AND ?  ORDER BY id DESC LIMIT ?`;
          const result = await promisifyQuery(query, [start, end,limit]);
          if (!response) return result;
          response.send({ message: 'success', statusCode: 200, result });
      } catch (err) {
          logger.error(err);
          if (response) customError(err, 404, response);
      }
  }


  async customSearch(record) { 
    try {
      const { email, category } = record;
      const staffQuery = `SELECT * FROM roles WHERE email LIKE ? AND emailAuthenticated = 'true'`;
      const patientQuery = `SELECT * FROM new_patients AS np INNER JOIN patients_settings AS pt ON pt.patientid = np.patientid WHERE np.email LIKE ? AND emailAuthenticated = 'true'`;
      let result;
      switch (category) {
        case 'staff':
          result = await promisifyQuery(staffQuery, `%${email}%`);
          result = result.map((item) => { 
            item = convertKeysToLowerCase(item);
            return  {fullname: item?.username, email: item?.email, employeeid: item?.employeeid}
          });
          break;
        case 'clients':
          result = await promisifyQuery(patientQuery, `%${email}%`);
          break;
        case 'bulk clients':
          result = await promisifyQuery('SELECT email FROM new_patients');
          break;
        case 'bulk staff':
          result = await promisifyQuery('SELECT email FROM roles');
          break;
        default:
          result = [];
          break;
      }
      return result;
    } catch (err) {
      logger.error(err);
      return "error occured";
    }
  }

  async saveComposedEmailDraft(subject, draft,employeeid) {
    try {
      const query = `INSERT INTO composedemails (subject,body,employeeid) VALUES(?,?,?)`;
      const result = await promisifyQuery(query, [subject, draft,employeeid]);
      return result.affectedRows > 0 ? true : false;
    } catch (err) {
      logger.error(err);
      return err?.message;
    }
  }

  async updateEmailComposed(id, subject, draft, employeeid) { 
    try {
      const query = `UPDATE composedemails SET subject = ?, body = ?, employeeid = ? WHERE id = ?`;
      const result = await promisifyQuery(query, [subject, draft, employeeid, id]);
      return result.affectedRows > 0 ? true : false;
    } catch (err) {
      logger.error(err);
      return err?.message;
    }
  }


  async updateEmailTarget(id, target,schedule) {
    if (!target || !id) return "provide target and id";
    if (typeof id !== 'number') return TypeError('id must be type number');
    try {
      const update = `UPDATE composedemails SET target = ?, ispublished = ? WHERE id = ?`;
      return await promisifyQuery(update, [target, 'true', id]);
      } catch (err) {
        throw new Error(err?.message);
    }
  }


  async shedular(id, target) { 
    return null;
  }


  async sendComposedEmail(records) {
    try {
      if (records.length == 0) return false;
       const { id, subject, body, target, employeeid } = records[0];
       const emails = JSON.parse(target);
      if (emails.length == 0) return false;
      const html = `<html><body>${body}</body></html>`;
      emails.forEach((item, index) => {
        const mailOptions = this.mailOptions(item['email'], subject, html);
        this.transportEmail(mailOptions);
      })
   } catch (err) {
     logger.error(err);
   }
  }

  async isAddressAuthenticated(email, target) {
    if (!email || !target) return 'email and target are required';
    if (target === 'staff') {

    }  
  }

  async publishEmail(records) {
    const { id, target, category,schedule} = records;
    // update target and ispublished on the db table
    // try sending email to clients 
    // if all bullk email, check cpu cores and if more than 2, send 
    // else schedule a time when the server is less busy to send
    // mostly at night

    if (!(await this.isEmailServiceActivated())) return "Email service is not activated";

    const isBulk = ["bulk clients", "bulk staff"].includes(category);

    const isFormatValid = Array.isArray(target);
   
    let refinedTarget;

    if (!isBulk && !isFormatValid) return 'target must be an array of email addresses';

    if (!isBulk && isFormatValid) { 
      refinedTarget = target.map(item => { return { email: item?.email} });
      refinedTarget = JSON.stringify(refinedTarget);
    }

    if (isBulk) {
      refinedTarget = category;
    }

    const isupdated = await this.updateEmailTarget(parseInt(id), refinedTarget,schedule);

    if (isupdated.affectedRows == 0) return false;

    if (configuration.possibleWorkers <= 2 && (refinedTarget == "all staffs" || refinedTarget == "all clients"))
    {
      this.shedular(id, target);
    }
    else
    {
      const getemail = await this.getComposedEmailDraft('published', 1, 'full', id);
      const status = await this.sendComposedEmail(getemail);
      return status;
    }
    return;
  }
  async getComposedEmailDraft(target,limit=20,mode,id) { 
    try { 
      let query = `SELECT `;
      let values = [];
      if (mode == 'brief') {
        query += `id,created_on,ispublished,subject,target,employeeid FROM composedemails`;
      } else {
        query += ` * FROM composedemails`
      }
      if (target == 'draft') { 
        query += ` WHERE ispublished = 'false'`
      }
      if (target == 'published') {
        query += ` WHERE ispublished = 'true'`;
      }

      if (id != null && target) {
        query += ` AND id = ?`;
        values.push(parseInt(id));
      }

      if (id != null && !target) {
        query += ` WHERE id = ?`;
        values.push(parseInt(id));
      }

      query += ` order by id desc limit ?`;
      values.push(parseInt(limit));


      return await promisifyQuery(query,values);
    } catch (err) {
      logger.error(err);
      return err?.message;
    }
  }
  async getEmailSummaryByDay(response) { 
    try {
      const query = `SELECT DATE_FORMAT(date, '%Y-%m-%d') AS date, COUNT(id) AS total,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success FROM emaillog GROUP BY DATE_FORMAT(date, '%Y-%m-%d')`;
      const result = await promisifyQuery(query);
      if (response) response.send({ status: 'success', statusCode: 200, result });
      return result;
    } catch (err) {
      logger.error(err);
      if (response) { customError(err, 404, response); return; }
      return "error occured";
    }
  }

  async emailSummary(response) {
    try {
      const query = `SELECT COUNT(id) AS total,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success FROM emaillog`;
      const result = await promisifyQuery(query);
      if (response) response.send({ status: 'success', statusCode: 200, result });
      return result;
    }
    catch (err) {
      logger.error(err);
      if (response) { customError(err, 404, response); return; }
      return "error occured";
    }
  }

  async isEmailAuthenticated(patientid) {
    try {
      // we want to verify using the patientid if patient is authenticated via email
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

  async updateAuthenticationMode(patientid) {
    if (!patientid) return 'patientid not provided';
    try
    {
      const query = `UPDATE patients_settings SET authenticationMode = 'email', emailAuthenticated = 'true' WHERE patientid = ?`;
       const isUpdated =  await promisifyQuery(query, [patientid]);
      return isUpdated.affectedRows == 1 ? true : false;
    } catch (err) {
      throw new Error(err);
    }
  }
  async sendAuthenticateEmail(emailAdd, patientid) {
    if (!emailAdd || !patientid) return `all parameters not provided`;
    try {
      // generate a jwt token for client
      const token = await new User().tokenizeData({ email: emailAdd, patientid: patientid }, '30m');
      // render html using ejs templating egine
      const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/verifyemail.ejs'), { token });
      // forward the email
      this.transportEmail(this.mailOptions(emailAdd, 'EMAIL VERIFICATION', html));
    } catch (err) {
      console.log(err)
      logger.error(err)
    }
  }

  validateTokenData = function (token) {
    const { email, patientid } = token;
    if (!email || !patientid) return false;
    return true;
  }
/**
 * 
 * @param {*} token generated user token valid for a pacticular period
 * @returns 
 */
  async verifyEmailToken(token) {
    try {
      const ourDecodedToken = await new User().verifyToken(token);
      const tokenValid = this.validateTokenData(ourDecodedToken);

      if (!tokenValid) return 'Invalid token';

      const { email, patientid } = ourDecodedToken;

      const isValidId = await new Registration().checkPatientIdExist(patientid);

      if (!isValidId) return 'Invalid patientid';
      const isSent = await this.sendTemporaryCredentials(patientid, email);
      return isSent === true ? patientid : false;
    } catch (err) {
      logger.error(err)
      throw new Error(err);
    }
  }


  async sendTemporaryCredentials(patientid,email) {
    const credentials = await this.getTemporaryCredentials(patientid);
    const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/temporaryLogins.ejs'), { data: credentials });
    const issent = await this.transportEmail(this.mailOptions(email, 'Temporary Patient Portal Access Credentials ', html));
    if (!issent) {
      this.emailLogdb('temporary credentials', patientid, false, 'email not sent'); // failures are logged in the database;
    };
    return issent;
   }

  

  async fireClientAuthentication(patientid, email) {
    //  1. patientid only provided? get personal information and check if email address is available
    // 2. if yes, send verification message 
    // 3. if no , return 
    // --- if email address is provided as second arguments , send verification message right away
    try 
    {
      if (!patientid) return false;
      if (patientid && email) {
        const patternValid = email.length > 5 && email.includes(".") && email.includes("@");
        const isRight = patternValid ? this.sendAuthenticateEmail(email, patientid) : false;
        if (!isRight) return false;
      };
      if (patientid && !email) {
        const cI = await database_queries.getsingleid(patientid, 'new_patients', 'patientid');
        if (cI.length > 0 && cI[0]['email']) {
          const emailAddress = cI[0]['email'];
          this.sendAuthenticateEmail(emailAddress, patientid);
        }
      }  
      this.emailLogdb('Authentication email', patientid, true, 'email sent'); // success are logged in the database;
      return true;
    } catch (err) {
      logger.error(err);
      this.emailLogdb('Authentication email', patientid, false, 'email not sent'); // failures are logged in the database;
    }
  }


  async getTemporaryCredentials(patientid, response) {
    try { 
      if (!patientid || typeof patientid !== 'number') throw new Error('Patientid must be type Number');
      const query = `SELECT * FROM patients_credentials where PATIENTID = ?`;
      const outcome = await promisifyQuery(query, patientid);
      if (outcome && outcome.length == 0 || outcome[0]['updated'] == 'true') return false;
      const { username, password } = outcome[0];
      return response ? response.send({ result: outcome[0] }) : { username, password };
    } catch (err) {
      logger.error(err);
      throw new Error(err);
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
    const appset = await promisifyQuery(`SELECT emailNotification FROM applicationsettings`);
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
       * @param {number} target - The billingid of the email log.
       * @param {boolean} success - Indicates whether the email was sent successfully or not.
       * @param {string} [reason] - The reason why the email was not sent successfully.
       * @returns {Promise<any>} - The result of the query.
       * @throws {Error} - If an error occurs during the execution of the query.
       */
  async emailLogdb(typer, target, success, reason) {
    if (!typer ||!target || !success) return 'all parameters not provided';
      try {
        const query = `INSERT INTO emaillog (type,target,success,reason) VALUES(?,?,?,?)`;
        const result = await promisifyQuery(query, [typer, target, success, reason]);
          return result;
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
      const email = personalInfo[0]['email'];
      if (email == "" || email == undefined || email == null) return 'email not provided';
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

