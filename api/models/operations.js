// 1. Get the category of the request
// 2. Get all unprocessed samples based on the category, limit by 50 samples at ago
// 3. We want to monitor for a pactiular billing, when the test was started, when it was completed, and the result
const { customError, promisifyQuery } = require("../../helper")
const logger = require("../../logger")
const connection = require("../db")

class Operations {
  constructor(billingid) {
    this.billingid = billingid
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
    const validID = await this.validBillingid()

    if (!validID) {
      return "Invalid billingid"
    }
    if (validID) {
      const queryString = `SELECT * FROM samplestatus WHERE billingid = ${this.billingid} AND approvalstatus= 1`

      return new Promise((resolve, reject) => {
        // execute query
        connection.query(queryString, (err, result) => {
          err ? reject(err) : result.length === 0 ? resolve(false) : resolve(true)
        })
      })
    }
  }

  billingTest = async (request) => {
    const certified = await this.readyforTest()

    const { departmentid } = request.query

    if (certified) {
      // we want to return  all test for the billingid from the test_ascention table to join testpanel table where testid = testid
      let queryString = `SELECT ta.testid,
                tp.NAME,
                ta.billingid,
                tp.CATEGORY,
                ta.processing,
                ta.processing_date,
                ta.ready,
                ta.ready_date
              FROM test_ascension as ta
                INNER JOIN test_panels as tp ON ta.testid = tp.ID
                INNER JOIN departments AS d ON d.id = tp.CATEGORY
              WHERE ta.billingid = ${this.billingid}`

      if (departmentid != "undefined") {
        if (departmentid != "all") {
          queryString += ` AND tp.CATEGORY = ${departmentid}`
        }
      }

      queryString += ` AND ta.collection = 'true' AND ta.ready='false'  AND d.department <> 'ultrasound' `

      return new Promise((resolve, reject) => {
        connection.query(queryString, (err, result) => {
          err ? reject(err) : result.length === 0 ? resolve([]) : resolve(result)
        })
      })
    } else {
      return "Billingid is not ready for testing"
    }
  }

  getAllReadyTest = async (request) => {
    const { category } = request.query
    //  we want to return all test where the approvalstatus of the sample is true
    // for processing and result entry
    let queryString = `
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
          b.BILLINGID,
          tp.CATEGORY
        FROM new_patients as np
          INNER JOIN billing as b ON np.PATIENTID = b.PATIENTID
          INNER JOIN samplestatus AS ss ON ss.billingid = b.BILLINGID
          INNER JOIN test_ascension AS ta ON ta.billingid = b.BILLINGID
          INNER JOIN test_panels AS tp ON tp.ID = ss.testid
          INNER JOIN departments AS d ON d.ID = tp.CATEGORY
        WHERE ss.approvalstatus = 1 AND DATE(b.billedon) = CURRENT_DATE
    `
    if (category != "all") {
      console.log(category)
      queryString += ` AND tp.CATEGORY = ${category}`
    }

    queryString += ` AND ta.collection = 'true' AND ta.ready='false' AND d.department <> 'ultrasound' ORDER BY b.billingid ASC LIMIT 20`

    return await promisifyQuery(queryString)
  }

  initiateStart = async (testid, billingid) => {
    // update test ascension table with the testid, datetime and the billing id
    const queryString = `UPDATE test_ascension SET processing_date = NOW(),processing = 'true'  WHERE billingid = ${billingid} AND testid = ${testid}`

    return new Promise((resolve, reject) => {
      connection.query(queryString, (err, result) => {
        err ? reject(err) : result.affectedRows === 0 ? resolve({ affectedRows: 0 }) : resolve({ affectedRows: 1 })
      })
    })
  }

  initiateReady = async (testid, billingid) => {
    // update test ascension table with the testid, datetime and the billing id and ready = true and ready_date = NOW()

    const queryString = `UPDATE test_ascension SET ready_date = NOW(),ready = 'true'  WHERE billingid = ${billingid} AND testid = ${testid}`

    return new Promise((resolve, reject) => {
      connection.query(queryString, (err, result) => {
        err ? reject(err) : result.affectedRows === 0 ? resolve({ affectedRows: 0 }) : resolve({ affectedRows: 1 })
      })
    })
  }

  operationsOverview = async function (request, response) {
    const { stage } = request.query

    if (!stage) {
      customError("stage of tests required", 401)
    } else {
     
      let queryString = `
          SELECT COUNT(*) AS count, d.department,d.id AS departmentid from test_ascension AS ta
          INNER JOIN test_panels AS tp ON tp.id = ta.testid
          INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
          INNER JOIN departments AS d ON d.id = tp.category
          WHERE ta.collection = 'true'
        `

      if (stage == "unentered") {
        queryString += ` AND ta.ready = 'false'`
      }

      if (stage == "entered") {
        queryString += ` AND ta.ready = 'true'`
      }

      queryString += ` AND d.department <> 'ultrasound'`

      queryString += ` GROUP BY d.department`

      const result = await promisifyQuery(queryString)

      response.send({ result, status: "success", statusCode: 200 })
    }
  }
  getAllEnterResult = async function (request, response) {
    const { from, to, patientid, billingid } = request.query
    let queryString = `  SELECT 
          CASE 
              WHEN MIDDLENAME IS NULL THEN CONCAT(
                  np.FIRSTNAME,
                  ' ',
                  np.LASTNAME
                )  ELSE CONCAT(  np.FIRSTNAME,
                  ' ',
                  np.MIDDLENAME,
                  ' ',
                  np.LASTNAME) END AS fullname,
                np.PATIENTID AS patientid,
                b.BILLINGID AS billingid,
                tp.CATEGORY AS category
              FROM new_patients as np
                INNER JOIN billing as b ON np.PATIENTID = b.PATIENTID
                INNER JOIN samplestatus AS ss ON ss.billingid = b.BILLINGID
                INNER JOIN test_ascension AS ta ON ta.billingid = b.BILLINGID
                INNER JOIN test_panels AS tp ON tp.ID = ss.testid
                INNER JOIN departments AS d ON d.ID = tp.CATEGORY
            `

    queryString += ` WHERE ss.approvalstatus = 1 AND d.department <> 'ultrasound'`

    if (from && !to) {
      queryString += ` AND DATE(b.billedon) BETWEEN '${from}' AND CURRENT_DATE`
    } else if (from && to) {
      queryString += ` AND DATE(b.billedon) BETWEEN '${from}' AND  '${to}'`
    } else {
      queryString = queryString
    }

    if (patientid) {
      queryString += ` AND np.PATIENTID = ${patientid}`
    }

    if (billingid) {
      queryString += ` AND b.billingid = ${billingid}`
    }

    queryString += ` GROUP BY b.billingid DESC LIMIT 30`

    connection.query(queryString, function (err, result) {
      if (err) {
        console.log(err)
        customError(err.message, 500, response)
      } else {
        response.send({
          statusCode: 200,
          status: "success",
          result,
        })
      }
    })
  }

  getAllTestPreview = async function (request, response) {
    const { billingid } = request.query

    if (billingid) {
      const queryString = `
            SELECT ta.testid,
            tp.NAME,
            ta.billingid,
            tp.CATEGORY,
            ta.processing,
            ta.processing_date,
            ta.ready,
            ta.ready_date
          FROM test_ascension as ta
            INNER JOIN test_panels as tp ON ta.testid = tp.ID
            INNER JOIN departments AS d ON d.id = tp.CATEGORY
          WHERE ta.billingid = ${billingid}
      `

      connection.query(queryString, (err, result) => {
        if (err) {
          customError(err.message, 500)
        } else {
          response.send({
            statusCode: 200,
            result,
            status: "success",
          })
        }
      })
    } else {
      customError("billingid is required", 400)
    }
  }

  async getUltrasoundWaitingList(request, response) {
    const queryString = ` 
    SELECT DISTINCT
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
    pt.BILLINGID,
    pt.DATE,
    tp.NAME,
    tp.ID AS TESTID,
    tp.CATEGORY,d.department
  FROM new_patients as np
    INNER JOIN performing_test as pt ON np.PATIENTID = pt.PATIENTID
    INNER JOIN samplestatus AS ss ON ss.billingid = pt.BILLINGID
    INNER JOIN test_ascension AS ta ON ta.billingid = pt.BILLINGID
    INNER JOIN test_panels AS tp ON tp.ID = ss.testid
    INNER JOIN departments AS d ON d.ID = tp.CATEGORY
  WHERE ta.ready = 'false' AND d.department = 'ultrasound'`
    connection.query(queryString, (err, result) => {
      if (err) {
        customError(err.message, 500)
      } else {
        response.send({
          statusCode: 200,
          result,
          status: "success",
        })
      }
    })
  }

  async processedScanList(request, response) {
    const { from, to, search } = request.query
    let query = `  SELECT DISTINCT
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
    pt.BILLINGID,
    pt.DATE,
    ta.ready,
    tp.NAME,
    tp.ID AS TESTID,
    tp.CATEGORY,d.department
  FROM new_patients as np
    INNER JOIN performing_test as pt ON np.PATIENTID = pt.PATIENTID
    INNER JOIN samplestatus AS ss ON ss.billingid = pt.BILLINGID
    INNER JOIN test_ascension AS ta ON ta.billingid = pt.BILLINGID
    INNER JOIN test_panels AS tp ON tp.ID = ss.testid
    INNER JOIN departments AS d ON d.ID = tp.CATEGORY
  WHERE ta.ready = 'true' AND d.department = 'ultrasound'`

    if (from && to) {
      query += ` AND pt.DATE BETWEEN '${from}' AND '${to}'`
    } else if (from && !to) {
      query += `  AND pt.DATE BETWEEN '${from}' AND CURRENT_DATE`
    } else {
      query = query
    }

    if (search) {
      query += ` AND (np.FIRSTNAME LIKE '%${search}' 
      OR np.LASTNAME LIKE '%${search}' 
      OR np.MOBILE_NUMBER ='%${search}')`
    }
    if (!from && !to) {
      query += ` GROUP BY pt.BILLINGID ORDER BY pt.BILLINGID DESC LIMIT 15`
    }

    connection.query(query, (err, result) => {
      if (err) {
        logger.error(err)
        customError(err.message, 500)
      } else {
        response.send({
          statusCode: 200,
          result,
          status: "success",
        })
      }
    })
  }
}

module.exports = Operations;