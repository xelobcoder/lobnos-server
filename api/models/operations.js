// 1. Get the category of the request
// 2. Get all unprocessed samples based on the category, limit by 50 samples at ago
// 3. We want to monitor for a pactiular billing, when the test was started, when it was completed, and the result
const connection = require('../db')

class Operations {
  constructor(billingid) {
    this.billingid = billingid;
    this.validBillingid = async function () {
      return new Promise((resolve, reject) => {
        connection.query(`SELECT * FROM billing WHERE billingid = ${this.billingid}`, (err, result) => {
          err ? reject(err) : result.length === 0 ? resolve(false) : resolve(true)
        })
      })
    }
  }


  async readyforTest() {
    // we want return test where the result is PHELOBOTOMY_STATUS is done and SAMPLE_STATUS = accepted
    const validID = await this.validBillingid();

    if (!validID) {
      return ('Invalid billingid')
    }
    if (validID) {

      const queryString = `SELECT * FROM samplestatus WHERE billingid = ${this.billingid} AND approvalstatus= 1`;

      return new Promise((resolve, reject) => {
        // execute query
        connection.query(queryString,
          (err, result) => {
            err ? reject(err) : result.length === 0 ? resolve(false) : resolve(true)
          })
      })
    }
  }

  billingTest = async () => {
    const certified = await this.readyforTest();
    if (certified) {
      // we want to return  all test for the billingid from the test_ascention table to join testpanel table where testid = testid

      const queryString = `SELECT ta.testid,tp.NAME,ta.billingid,ta.processing,ta.processing_date,ta.ready,ta.ready_date FROM test_ascension as ta INNER JOIN test_panels as tp ON ta.testid = tp.ID WHERE ta.billingid = ${this.billingid} AND ta.collection = 'true'`;

      return new Promise((resolve, reject) => {
        connection.query(queryString, (err, result) => {
          err ? reject(err) : result.length === 0 ? resolve([]) : resolve(result)
        })
      })
    }
    else {
      return ('Billingid is not ready for testing')
    }
  }

  getAllReadyTest = async () => {
    //  we want to return all test where the approvalstatus of the sample is true 
    // for processing and result entry
    const queryString = `
        SELECT 
          CASE 
              WHEN MIDDLENAME IS NULL THEN CONCAT(
                  np.FIRSTNAME,
                  ' ',
                  np.LASTNAME
                )  ELSE CONCAT(  np.FIRSTNAME,
                  ' ',
                  np.MIDDLENAME,
                  ' ',
                  np.LASTNAME) END AS FULLNAME,
                np.PATIENTID,
                pt.BILLINGID
              FROM new_patients as np
                INNER JOIN performing_test as pt ON np.PATIENTID = pt.PATIENTID
                INNER JOIN samplestatus AS ss ON ss.billingid = pt.BILLINGID
              WHERE ss.approvalstatus = 1
          GROUP BY pt.BILLINGID
          ORDER BY pt.ID ASC
      LIMIT 100
    `;


    return new Promise((resolve, reject) => {
      connection.query(queryString, (err, result) => {
        err ? reject(err) : result.length === 0 ? resolve(false) : resolve(result)
      })
    })
  }

  initiateStart = async (testid, billingid) => {
    // update test ascension table with the testid, datetime and the billing id
    const queryString = `UPDATE test_ascension SET processing_date = NOW(),processing = 'true'  WHERE billingid = ${billingid} AND testid = ${testid}`;

    return new Promise((resolve, reject) => {
      connection.query(queryString, (err, result) => {
        err
          ? reject(err)
          : result.affectedRows === 0
            ? resolve({ affectedRows: 0 })
            : resolve({ affectedRows: 1 });
      });
    });
  }

  initiateReady = async (testid, billingid) => {
    // update test ascension table with the testid, datetime and the billing id and ready = true and ready_date = NOW()

    const queryString = `UPDATE test_ascension SET ready_date = NOW(),ready = 'true'  WHERE billingid = ${billingid} AND testid = ${testid}`;

    return new Promise((resolve, reject) => {
      connection.query(queryString, (err, result) => {
        err
          ? reject(err)
          : result.affectedRows === 0
            ? resolve({ affectedRows: 0 })
            : resolve({ affectedRows: 1 });
      });
    });
  }

}

module.exports = Operations;