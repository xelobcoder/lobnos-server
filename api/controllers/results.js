const router = require("express").Router()
const { customError, rowAffected, promisifyQuery } = require("../../helper")
const logger = require("../../logger")
const Operations = require("../models/operations")
const Patient = require("../models/patientAnalytics")
const { Result } = require("../models/result")
const testpanel = require("../testpanel/list")

router.get(`/api/v1/result/patientrend/single`, async function (request, response) {
  const { billingid, patientid, testid, test, instances } = request.query
  try {
    const result = await new Patient(patientid).getPatientTestTrend(parseInt(patientid), testid, test, instances)
    response.send({ statusCode: 200, status: "success", result })
  } catch (err) {
    logger.error(err)
    customError("error occured", 500, response)
  }
})

router.post("/api/v1/result/entry/customtest", async function (request, response) {
  const { billingid, patientid, testid, fields, test, employeeid, comments } = request.body

  if (!billingid || !patientid || !testid || !fields || !test) {
    return customError("billingid, patientid, testid,test and fields are required", 404, response)
  }

  if (fields.length == 0) {
    return customError("Field length must not be 0", 404, response)
  }

  if (typeof billingid != "number" || typeof patientid != "number") {
    return customError(`patientid and billingid must be type number`, 404, response)
  }

  const tablename = "result" + testpanel.generateTableName(test)

  const shouldCreateRecord = async function (billingid, patientid, testtable, field) {
    const records = await promisifyQuery(`SELECT * FROM ${testtable} WHERE billingid = ? AND field = ? AND patientid = ?`, [
      billingid,
      field,
      patientid,
    ])
    return records.length === 0
  }

  let ascensionQuery = `UPDATE test_ascension SET ready = 'true', ready_date = NOW()`
  const isApprovalTrue = await new Result().isApprovalSetTrue()
  if (isApprovalTrue === false) {
    ascensionQuery += `,ApprovalStatus = 1`
  }
  
  ascensionQuery += ` WHERE billingid = ? AND testid = ?`

  const insertUpdate = async function () {
    const insertAll = await Promise.all(
      fields.map(async (item, index) => {
        if (await shouldCreateRecord(billingid, patientid, tablename, item.field)) {
          const values = [item.field, billingid, patientid, item.value, employeeid]
          const query = `INSERT INTO ${tablename} (field,billingid,patientid,value,employeeid) VALUES(?,?,?,?,?)`
          await new Operations().initiateStart(testid, billingid);
          await promisifyQuery(ascensionQuery, [billingid, testid])
          return rowAffected(await promisifyQuery(query, values))
        } else {
          const updateRecords = `UPDATE ${tablename} SET value = ?,updatedon =Now(),employeeid = ? WHERE patientid = ? AND billingid = ? AND field = ?`
          const result = await promisifyQuery(updateRecords, [item.value, employeeid, patientid, billingid, item.field])
          return rowAffected(result)
        }
      })
    )
    const isAllInserted = insertAll.some((a, i) => a == false)

    const pushCommentsQuery = `UPDATE result_comments SET COMMENTS = ? WHERE BILLINGID = ? AND TESTID = ?`

    const commentSection = async function () {
      const isRecordAvailable = await promisifyQuery(`SELECT * FROM result_comments WHERE testid = ? AND billingid = ?`, [
        testid,
        billingid,
      ])

      if (isRecordAvailable.length > 0) {
        return rowAffected(await promisifyQuery(pushCommentsQuery, [comments, billingid, testid]))
      } else {
        return rowAffected(
          await promisifyQuery(`INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`, [testid, billingid, comments])
        )
      }
    }

    const isCommented = await commentSection()

    if (isAllInserted === false && isCommented) {
      response.send({ status: "success", statusCode: 200, message: "records updated successfully" })
    } else {
      response.send({ status: "failed", statusCode: 404, message: "error occured saving results" })
    }
  }

  await insertUpdate()
})


router.get('/api/v1/trends/getTrends', async function (request, response) {
    
})

module.exports = router
