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
  /**
   * Validates the email credentials.
   * @param {string} user - The email user.
   * @param {string} password - The email password.
   * @param {string} provider - The email provider.
   * @param {string} company - The email company.
   * @returns {boolean} - Returns true if the credentials are valid, false otherwise.
   */
  validateCredentials(user, password, provider, company) {
    return user && password && provider && company ? true : false;
  }

  /**
   * Creates a transport for sending emails.
   * @returns {Transporter} The email transporter.
   */
  createTransport() {
    return nodemailer.createTransport({ service: this.provider, auth: { user: this.user, pass: this.password } })
  }

    /**
     * Inserts email settings into the generalemailsettings table.
     * @param {Object} records - The email settings to be inserted.
     * @param {string} records.provider - The email provider.
     * @param {string} records.appusername - The username for the email provider.
     * @param {string} records.apppassword - The password for the email provider.
     * @param {string} records.verificationSubject - The subject of the verification email.
     * @param {string} records.readySubject - The subject of the ready email.
     * @param {string} records.sampleSubject - The subject of the sample email.
     * @returns {Promise} A promise that resolves when the email settings are inserted successfully.
     * @throws {Error} If an error occurs while inserting the email settings.
     */
   async  insertEmailSettings(records) {
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

  /**
   * Sends an email using the configured email settings.
   * @param {Object} mailOptions - The options for the email.
   * @returns {boolean|string} - Returns true if the email was sent successfully, or a string with an error message.
   * @throws {Error} - Throws an error if the email fails to send.
   */
  async transportEmail  (mailOptions) {
    try {
      const settings = await this.getEmailSettings();
      if (settings.length === 0) return 'email settings not provided';
      const { email, apppassword, provider } = settings[0];
      this.user = email;
      this.password = apppassword;
      this.provider = provider;
      this.company =  'LabName'

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
      const result = await promisifyQuery(query, [start, end, limit]);
      if (!response) return result;
      response.send({ message: 'success', statusCode: 200, result });
    } catch (err) {
      logger.error(err);
      if (response) customError(err, 404, response);
    }
  }


  /**
   * Performs a custom search based on the provided record.
   * @param {Object} record - The record containing email and category information.
   * @returns {Promise<Array<Object>>} - A promise that resolves to an array of search results.
   */
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
            return { fullname: item?.username, email: item?.email, employeeid: item?.employeeid }
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

  async saveComposedEmailDraft(subject, draft, employeeid) {
    try {
      const query = `INSERT INTO composedemails (subject,body,employeeid) VALUES(?,?,?)`;
      const result = await promisifyQuery(query, [subject, draft, employeeid]);
      return result.affectedRows > 0 ? true : false;
    } catch (err) {
      logger.error(err);
      return err?.message;
    }
  }

  /**
   * Updates the composed email with the specified ID.
   * @param {number} id - The ID of the composed email.
   * @param {string} subject - The subject of the email.
   * @param {string} draft - The body of the email.
   * @param {number} employeeid - The ID of the employee associated with the email.
   * @returns {Promise<boolean|string>} - A promise that resolves to true if the email was successfully updated, false otherwise. If an error occurs, the promise will reject with the error message.
   */
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


  /**
   * Updates the email target, ispublished status, and scheduledate for a given email ID.
   * @param {number} id - The ID of the email.
   * @param {string} target - The new target email address.
   * @param {string} schedule - The new scheduled date for the email.
   * @returns {Promise<any>} - A promise that resolves to the result of the update query.
   * @throws {Error} - If an error occurs during the update process.
   */
  async updateEmailTarget(id, target, schedule) {
    if (!target || !id) return "provide target and id";
    if (typeof id !== 'number') return TypeError('id must be type number');
    try {
      const update = `UPDATE composedemails SET target = ?, ispublished = ?, scheduledate = ? WHERE id = ?`;
      return await promisifyQuery(update, [target, 'true', schedule, id]);
    } catch (err) {
      throw new Error(err?.message);
    }
  }


  /**
   * Sends bulk emails based on the provided parameters.
   * @param {string} id - The ID of the email.
   * @param {string} target - The target of the email.
   * @param {string} category - The category of the email.
   * @returns {Promise<boolean|string|undefined>} - A promise that resolves to a boolean indicating the success of sending the emails, a string indicating an error message, or undefined.
   */
  async sendBulkEmails(id, target, category) {
    try {
      if (!id || !category) return 'id and category are required';
      const table = category == 'bulk clients' ? 'new_patients' : 'roles';

      const query = `SELECT email FROM ${table}`;

      const array = await promisifyQuery(query);

      const getEmailInfo = await this.getComposedEmailDraft(null, 1, 'full', id);

      if (getEmailInfo.length == 0) return false;

      const { subject, body } = getEmailInfo[0];

      if (!(Array.isArray(array))) return TypeError('array must be type array');

      if (array.length == 0) return false;



      if ((configuration.possibleWorkers > 2 && array.length <= 10000)
      || (configuration.possibleWorkers <= 2 && array.length <= 200) ) {
        array.forEach(async (item, index) => {
          const data = { subject, body, email: item?.email };
          await this.sendComposedEmail(data);
        })
        return true;
      }
      return;
    } catch (err) {
      logger.error(err);
      return false || err?.message;
    }
  }


  /**
   * Sends a composed email.
   * @param {Object} records - The email records.
   * @param {string} records.subject - The subject of the email.
   * @param {string} records.body - The body of the email.
   * @param {string} records.email - The recipient email address.
   * @returns {Promise<boolean>} - A promise that resolves to true if the email is sent successfully, otherwise false.
   */
  async sendComposedEmail(records) {
    try {
      if (typeof records != 'object') return false;
      const { subject, body,email } = records;
      if (!subject || !email || !body) return false;
      const html = `<html><body>${body}</body></html>`;
      const mailOptions = this.mailOptions(email, subject, html);
      return this.transportEmail(mailOptions);
    } catch (err) {
      logger.error(err);
      return false;
    }
  }

  async isAddressAuthenticated(email, target) {
    if (!email || !target) return 'email and target are required';
    if (target === 'staff') {

    }
  }

  async publishEmail(records) {
    try {
      const { id, target, category, schedule } = records;
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
        refinedTarget = target.map(item => { return { email: item?.email } });
        refinedTarget = JSON.stringify(refinedTarget);
      }

      if (isBulk) {
        refinedTarget = category;
      }

      let publishOn;

      if (schedule.date && schedule.time) {
        publishOn = new Date(`${schedule?.date} ${schedule?.time}`);
      }

      const isupdated = await this.updateEmailTarget(parseInt(id), refinedTarget, publishOn);

      if (isupdated.affectedRows == 0) return false;

      if (refinedTarget == "all staffs" || refinedTarget == "all clients") {
        this.sendBulkEmails(id, target, category);
      }
      else {
        const getemail = await this.getComposedEmailDraft("published", 1, "full", id)
        if (getemail.length == 0) return false
        const { body, subject, target } = getemail[0]
        let parsedTarget

        if (target != "") parsedTarget = JSON.parse(target)
        if (parsedTarget && parsedTarget.length > 0) { 
          parsedTarget.forEach(async (item, index) => {
            const data = { subject, body, email: item?.email };
            await this.sendComposedEmail(data);
          })
        }
        return true;
      }
    } catch (err) {
      logger.error(err);
    }
  }
  async getComposedEmailDraft(target, limit = 20, mode, id) {
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


      return await promisifyQuery(query, values);
    } catch (err) {
      console.log(err)
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

  async isEmailAuthenticated(identifier, target) {
    console.log(identifier,target)
    try {
      // we want to verify using the patientid if patient is authenticated via email
      let result = false;
      
      if (target === 'patient') {
        result = await promisifyQuery(`SELECT * FROM patients_settings WHERE PATIENTID = ?`, [identifier]);
        if (result.length === 0) return false;
        const { authenticated, authenticationMode } = result[0];
        return authenticationMode === 'email' & authenticated == 1 ? true : false
      }

      if (target === "clinician") {
        result = await promisifyQuery(`SELECT * FROM clinicianscredentials WHERE clinicianid = ?`, [identifier]);
        if (result.length === 0) return false;
        const { isAuthenticated, authenticationMode } = result[0];
        return authenticationMode === 'email' & isAuthenticated == 1 ? true : false
      }
      return result;
    }
    catch (err) {
     logger.error(err);
      return new Error(err);
    }
  }

  async updateAuthMode(target,identifier) {
    if (!identifier  || !target) return 'required params not provided';
    try {
      let query;

      if (target === "patient") {
        query = `UPDATE patients_settings SET authenticationMode = 'email', emailAuthenticated = 'true' WHERE patientid = ?`;
      }

      if (target === "clinician") {
        query = `UPDATE clinicianscredentials SET authenticationMode = 'email', isAuthenticated = 1,authenticatedon = NOW() WHERE clinicianid = ? `;
      }
      const isUpdated = await promisifyQuery(query, [identifier]);

      return isUpdated.affectedRows == 1 ? true : false;
    } catch (err) {
      throw new Error(err);
    }
  }

  generateToken = async (data) => {
    if (!data) return false;
    return await new User().tokenizeData(data, '30m');
  }
  
  async sendAuthenticateEmail(token,email, subject = 'EMAIL VERIFICATION') {
    try {
      if (!token || !email) return 'Token  or email not provided';
      // render html using ejs templating egine
      const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/verifyemail.ejs'), { token });
      // forward the email
      return this.transportEmail(this.mailOptions(email, subject, html));
    } catch (err) {
      logger.error(err)
      throw new Error(err);
    }
  }

  /**
   * Validates the token data.
   * @param {object} token - The token object.
   * @param {string} token.email - The email address.
   * @param {string} token.patientid - The patient ID.
   * @returns {boolean} - Returns true if the token data is valid, otherwise false.
   */
  validateTokenData = function (token) {
    const { email, target,identifier } = token;
    if (!email || !target || !identifier) return false;
    return true;
  }
  /**
   * 
   * @param {*} token generated user token valid for a pacticular period
   * @returns 
   */
  async verifyClientAuthToken(token) {
    try {
      const ourDecodedToken = await new User().verifyToken(token);
      const tokenValid = this.validateTokenData(ourDecodedToken);
      if (!tokenValid) return 'Invalid token';

      let isValidId;

      const { email, target, identifier } = ourDecodedToken;

      if (target === "patient") {
        isValidId = await new Registration().checkPatientIdExist(identifier);
      }

      if (target === "clinician") {
        const data = await database_queries.getsingleid(identifier, `clinicianbasicinfo`, `id`);
        isValidId = data.length > 0 && email === data[0]['email'];
      }

      if (!isValidId) return 'Invalid identifier';
      // check if already Authenticated;
      const isAuthenticated = await  this.isEmailAuthenticated(identifier, target);

      if (isAuthenticated) {
        return 'Already Authenticated';
      }
            // update authentication mode
      const isModeUpdated = await this.updateAuthMode(target, identifier);
      // send temporary creentials
      const getCredentials = await this.getTempClinicianCredentials(identifier);
      const { password } = getCredentials[0];
      // send initial credentials.
      this.sendTemporaryCredentials({ identifier: password, email });
      return isModeUpdated;
    } catch (err) {
      logger.error(err);
      throw new Error(err);
    }
  }


  /**
   * Sends temporary credentials to a patient's email.
   * @param {string} patientid - The ID of the patient.
   * @param {string} email - The email address of the patient.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the email was sent successfully.
   */
  async sendTemporaryCredentials(credentials) {
    const { identifier, email } = credentials;
    if (!identifier || !email) return 'Required credentials details not provided';

    const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/temporaryLogins.ejs'), { data: credentials });

    const issent = await (this.transportEmail(this.mailOptions(email, 'Temporary Patient Portal Access Credentials ', html)));

     !issent && this.emailLogdb('temporary credentials', patientid, false, 'email not sent'); 
  
    return issent;
  }

  async getTempClinicianCredentials(id) {
    try 
    {
      const credentials = await promisifyQuery(`SELECT * FROM clinicianscredentials WHERE clinicianid = ?`, [id]);
      return credentials;
    } catch (err) {
      logger.error(err);
    }
  }



  async fireClientAuthentication(email, target,identifier) {
    try {
      if (!email || !target) return false;
      if (target != "clinician" && !identifier) return false;
      const patternValid = email.length > 5 && email.includes(".") && email.includes("@");
      if (!patternValid) return false;
     
      let tokendata = { email, identifier, target };
      
      const token = await this.generateToken(tokendata);

      if (token) await this.sendAuthenticateEmail(token, email);
      
      this.emailLogdb('Authentication email', identifier, true, 'email sent'); // success are logged in the database;
      return true;
    } catch (err) {
      logger.error(err);
      this.emailLogdb('Authentication email', identifier, false, 'email not sent'); // failures
    }
  }


  /**
   * Retrieves temporary credentials for a patient.
   * @param {number} patientid - The ID of the patient.
   * @param {object} response - The response object (optional).
   * @returns {object|boolean} - The temporary credentials or false if not found.
   * @throws {Error} - If there is an error retrieving the credentials.
   */
  async getTempPatientCredentials(patientid, response) {
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
  /**
   * Triggers the sending of a sample rejection email.
   * 
   * @param {number} billingid - The ID of the billing.
   * @param {string} message - The rejection message.
   * @returns {Promise<void>} - A promise that resolves when the email is sent.
   */
  async triggerSampleRejectionEmail(billingid, message) {
    // use the billing id to retrieve the patientid
    try {
      const billdata = await database_queries.getsingleid(parseInt(billingid), 'billing', 'BILLINGID');
      
      if (billdata.length <= 0) return false;
    
      const { patientid } = billdata[0];
     // use the patient id to get the email
     const person = await database_queries.getsingleid(parseInt(patientid), 'new_patients', 'PATIENTID')
     
     if (person.length === 0 || person[0]?.email === null) return false;
      
     const { email } = person[0];

     const pathname = path.join(__dirname, '../views', 'templates' + '/sampleRejection.ejs');

     const data = { message, header: 'SAMPLE REJECTION NOTIFICATION', labname: 'Kairos Diagnostics Center' }
     
     const html = await ejs.renderFile(pathname, { data });
     
     const mailOptions = this.mailOptions(email, 'SAMPLE REJECTION NOTIFICATION', html);
     
     const status = await this.transportEmail(mailOptions);
     return status;
    } catch (err) {
      logger.error(err);
      throw new Error(err);
    }
  }

  /**
   * Checks if the email service is activated.
   * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether the email service is activated.
   */
  async isEmailServiceActivated() {
    const appset = await promisifyQuery(`SELECT emailNotification FROM applicationsettings`);
    if (appset.length > 0) {
      const emailActivation = appset[0]['emailNotification'];
      return emailActivation === 0 ? false : true;
    }
  }

  /**
   * Checks if the selected preference is activated.
   * @param {string} target - The target preference to check.
   * @returns {boolean} - Returns true if the selected preference is activated, false otherwise.
   */
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
        if (callback && typeof callback === 'function') { callback(); return; };
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
    if (!typer || !target || !success) return 'all parameters not provided';
    try {
      const query = `INSERT INTO emaillog (type,target,success,reason) VALUES(?,?,?,?)`;
      const result = await promisifyQuery(query, [typer, target, success, reason]);
      return result;
    } catch (err) {
      throw new Error(err);
    }
  }




  async getEmailSettings() {
    try { return await promisifyQuery(`SELECT * FROM generalemailsettings`); } catch (err) { logger.error(err) }
  }



  /**
   * Sends a billing receipt email to the specified email address.
   * @param {string} billingid - The ID of the billing.
   * @returns {Promise<boolean|string>} - A promise that resolves to true if the email is sent successfully, or 'email not provided' if the email address is not provided, or false if the necessary data is missing.
   * @throws {Error} - If an error occurs while sending the email.
   */
  async forwardBillingReceipt(billingid) {
    try {
      let testdata = await testInformation(billingid);
      let personalInfo = await clientInformation(billingid);
      const email = personalInfo[0]['email'];
      if (email == "" || email == undefined || email == null) return 'email not provided';
      if (testdata.length > 0 && personalInfo.length > 0 && email) {
        const html = await ejs.renderFile(path.join(__dirname, '../views', 'templates' + '/billing.ejs'), { data: { testdata, personalInfo: personalInfo[0] } });
        const mail = this.mailOptions(email, 'Transaction Alert', html)
        this.transportEmail(mail);
        return true;
      }
      return false;
    } catch (err) {
      logger.error({ type: 'email', err });
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

