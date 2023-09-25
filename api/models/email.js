const connection = require('../db');
const logger = require('../../logger');
const nodemailer = require('nodemailer');
const database_queries = require('../database/queries')



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
    return new Promise((resolve, reject) => {
      const {
        provider,
        appusername,
        apppassword,
        verificationSubject,
        readySubject,
        sampleSubject,
        billingSubject,
      } = records;

      const query = `INSERT INTO generalemailsettings (provider,appusername,apppassword,verificationSubject,readySubject,sampleSubject, billingSubject
    ) VALUES(?,?,?,?,?,?,?)`;

      const values = [
        provider,
        appusername,
        apppassword,
        verificationSubject,
        readySubject,
        sampleSubject,
        billingSubject,
      ];

      connection.query(query, values, function (err, result) {
        if (err) {
          reject(err);
          logger.error(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  mailOptions(targetEmail, subject, html) {
    return {
      from: this.company,
      to: targetEmail,
      subject,
      html
    }
  }

  transportEmail = function (mailOptions) {
    this.createTransport().sendMail(mailOptions, (error, info) => {
      if (error) {
        logger.log('error', error)
      } else {
        console.log(`Email sent: ${info.response}`)
      }
    });
  }



  async triggerSampleRejectionEmail(testid, billingid, message) {
    // use thr billing id to retrieve the patientid
    try {
      const personBillingifo = await database_queries.getsingleid(parseInt(billingid), 'billing', 'BILLINGID');
      if (personBillingifo.length > 0) {
        const { PATIENTID } = personBillingifo[0];
        // use the patient id to get the email
        const person = await database_queries.getsingleid(parseInt(PATIENTID), 'new_patients', 'PATIENTID')
        if (person.length > 0) {
          const { EMAIL } = person[0];
          if (EMAIL == null) return;
          const html =`
              <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Document</title>
                  <style>
                  .hearing {
                    color: white !important;
                    background-color: rgba(255, 0, 0, 0.667);
                    border-radius: 5px;
                    padding: 20px;
                  }
                  </style>
                </head>
                <body>
                  <p class="hearing">${message}</p>' <p class="hearing">${message}</p>
                </body>
              </html>
          `;
          const mailOptions = this.mailOptions(EMAIL, 'SAMPLE REJECTION NOTIFICATION', html);
          this.transportEmail(mailOptions);
        }
      }
    } catch (err) {
      logger.error(err)
    }

    // this.transportEmail(this.mailOptions())
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

  logEmailsent() {
   
  }

}







module.exports = EmailService;



// const fetch = require('node-fetch');

// async function run() {
//   const query = new URLSearchParams({
//     clientid: 'string',
//     clientsecret: 'string',
//     from: 'string',
//     to: 'string',
//     content: 'string'
//   }).toString();

//   const resp = await fetch(
//     `https://devp-sms03726-api.hubtel.com/v1/messages/send?${query}`,
//     { method: 'GET' }
//   );

//   const data = await resp.text();
//   console.log(data);
// }

// run();

