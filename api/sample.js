const { promisifyQuery, customError, convertKeysToLowerCase } = require('../helper');
const logger = require('../logger');
const connection = require('./db');
const EmailService = require('./EmailServices/email');
const { database_queries } = require("./testResult");
// YET TO BE CODED
// AFTER CHANGE OF STATUS CLIENT WOULD BE NOTIFIED VIA EMAIL
// OF SAMPLE STATUS CHANGE AND NECESSARY ACTION TO BE AND RECOMMEDATION TAKEN

class SampleHandler {
  constructor(request, response) {
    this.request = request;
    this.response = response;
  }

  async getCollectedSamples() {
    const SQL_QUERY = `
          SELECT DISTINCT
          b.PATIENTID,
          b.BILLINGID,
          b.billedon AS DATE,
        CASE WHEN np.MIDDLENAME IS NULL OR np.MIDDLENAME = ''
              THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
              ELSE CONCAT(np.FIRSTNAME, ' ', np.LASTNAME, ' ', np.MIDDLENAME)
        END AS FULLNAME
        FROM billing AS b INNER JOIN  new_patients as np ON np.PATIENTID = b.PATIENTID
          INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
      INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
          WHERE ss.approvalstatus = 0 AND ss.rejectionmessage IS NULL AND ta.collection = 'true'
          GROUP BY b.BILLINGID ORDER BY b.BILLINGID DESC LIMIT 20`;
    try {
      let result = await promisifyQuery(SQL_QUERY);
      if (result.length > 0) {
        result = result.map((item, index) => { return convertKeysToLowerCase(item) })
      }
      this.response.send({ statusCode: 200, status: 'success', message: 'success', result });
    }
    catch (err) {
      logger.error(err);
      customError('error fetching data', 500, this.response);
    }
  }
  getDates(date) {
    let SQL_QUERY = `
    SELECT DISTINCT p.SAMPLE_STATUS,
      p.PATIENTID,
      p.BILLINGID,
      CASE WHEN np.MIDDLENAME IS NULL OR np.MIDDLENAME = ''
                      THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
                      ELSE CONCAT(np.FIRSTNAME, ' ', np.LASTNAME, ' ', np.MIDDLENAME)
                END AS FULLNAME,
      p.DATE,
      p.MESSAGE,
      p.ID
     FROM PERFORMING_TEST as p
      join billing as b ON p.PATIENTID = b.PATIENTID
      join new_patients as np ON p.PATIENTID = np.PATIENTID
     WHERE p.DATE= ${date} ORDER BY p.BILLINGID DESC LIMIT 100    
    `;
    connection.query(SQL_QUERY, (err, result) => {
      if (err) {
        logger.error(err);
      }
      this.response.send(result);
    });
  }
  getSelectedStutusAndDate(date, status) {
    if (date && status) {
      let SQL_QUERY = `
            SELECT DISTINCT p.SAMPLE_STATUS,
                p.PATIENTID,
                p.BILLINGID,
                p.MESSAGE,
                CASE WHEN np.MIDDLENAME IS NULL OR np.MIDDLENAME = ''
                      THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
                      ELSE CONCAT(np.FIRSTNAME, ' ', np.LASTNAME, ' ', np.MIDDLENAME)
                END AS FULLNAME,
                p.DATE,
                p.ID
          FROM PERFORMING_TEST AS p
          JOIN billing AS b ON p.PATIENTID = b.PATIENTID
          JOIN new_patients AS np ON p.PATIENTID = np.PATIENTID
          WHERE p.DATE = '${date}' AND p.SAMPLE_STATUS = '${status}'
          ORDER BY p.BILLINGID DESC
          LIMIT 50
    `;
      connection.query(SQL_QUERY, (err, result) => {
        if (err) {
          logger.error(err);
        }
        this.response.send(result);
      });
    }
  }
  getRecords() {
    let SQL_QUERY = `
      SELECT 
        CASE
          WHEN np.MIDDLENAME IS NULL THEN CONCAT(np.FIRSTNAME, ' ', np.LASTNAME)
          ELSE CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME)
        END AS 'FULLNAME',
        ss.billingid AS 'BILLINGID',
        pt.DATE AS 'DATE',
        ( SELECT COUNT(billingid) FROM samplestatus WHERE approvalstatus = 0 
      AND billingid = pt.billingid) AS 'PENDINGCOUNT'
      FROM samplestatus as ss
      INNER JOIN performing_test as pt ON pt.BILLINGID = ss.billingid
      INNER JOIN new_patients as np ON np.PATIENTID = pt.PATIENTID
      GROUP BY ss.billingid
    ORDER BY pt.DATE DESC LIMIT 30
  `;
    connection.query(SQL_QUERY, (err, result) => {
      if (err) {
        logger.error(err);
      }
      else {
        // check for pending  count in item of the result and only send those ABOVE 0
        let filteredResult = result.filter(item => item.PENDINGCOUNT > 0);
        this.response.send(filteredResult);
      }
    });
  }
  updateRecords(request, response) {
    const { testcollection } = request.body;

    if (Array.isArray(testcollection) && testcollection.length > 0) {

      const SQL_QUERY = `UPDATE samplestatus SET approvalstatus = ?,rejectionmessage = ?,samplevalidatedon = ?, validatedby =?
       WHERE billingid = ? AND testid = ? AND ascensionid = ?`;
      // start transaction 
      connection.beginTransaction(async (err) => {
        if (err) { logger.error(err); }

        testcollection.forEach(async (item, index) => {
          const { billingid, testid, id, rejectionmessage, approvalstatus, validatedon, validatedby } = item;

          const message = approvalstatus == 1 ? null : rejectionmessage;

          const values = [approvalstatus, message, validatedon, validatedby, billingid, testid, id];

          try {
            await promisifyQuery(SQL_QUERY, values);
            // commit transaction
            connection.commit();
            if (testcollection.length - 1 === index) {
              response.send({ statusCode: 200, status: 'success', message: 'record updated successfully ' });
            }
            if (approvalstatus == 0) { await new EmailService().triggerSampleRejectionEmail(billingid, message) }
          }
          catch (err) {
            logger.error(err);
            console.log(err)
            connection.rollback();
            customError('error updating data', 500, response);
          }
        });
      })
    } else {
      customError('invalid request', 400, response);
    }


    // let approvalStatus = action == 'reject' ? 0 : 1;

    // let SQL_QUERY = `
    // UPDATE samplestatus SET
    //  approvalstatus = ${approvalStatus}
    //  `

    // if (action == 'reject') {
    //   SQL_QUERY += `, message = '${message}'`
    // }

    // SQL_QUERY += ` WHERE billingid = ${billingid} AND testid = ${testid}`

    // connection.query(SQL_QUERY, async (err, result) => {
    //   if (err) {
    //     logger.error(err);
    //   }
    //   else {
    //     if (approvalStatus == 0) { await new EmailService().triggerSampleRejectionEmail(billingid, message) }
    //     response.send({
    //       statusCode: 200,
    //       status: 'success',
    //       message: 'record updated successfully '
    //     })
    //   }
    // })
  }

  async getSampleRejectionStatus(testid, billingid) {
    return new Promise((resolve, reject) => {
      connection.query(
        `SELECT * FROM samplestatus WHERE billingid = ?  AND approvalstatus = 0 AND testid = ?`,
        [billingid, testid],
        function (err, result) {
          if (err) {
            logger.error(err);
            reject(err);
          } else {
            if (result.length == 1) {
              const { message, date, billingid } = result[0];
              resolve({ message, date, billingid });
            } else {
              resolve(null);
            }
          }
        }
      );
    });
  }
}



module.exports = SampleHandler;
