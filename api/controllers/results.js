const router = require("express").Router()
const { customError, rowAffected, promisifyQuery } = require("../../helper")
const logger = require("../../logger")
const Patient = require("../models/patientAnalytics")
const { Result } = require("../models/result")
const testpanel = require("../testpanel/list")
// this api endpoint takes two query params , the billing id and the testid
//  and checks if result have been entered
// get test result get the result
router.get("/api/v1/test/result/check", async function (req, res) {
  try {
    const { billingid, testname, testid } = req.query
    if (!billingid && !testname) {
      res.status(400).send({ message: "Invalid data", statusCode: 400 })
    } else {
      const resultChecker = new Result(billingid, testname)
      const result = await resultChecker.isResultEntered(testid)
      const records = result.result
      res.send({
        statusCode: 200,
        status: "success",
        message: result?.entered ? "result entered" : "result not entered",
        result: result?.entered,
        records,
      })
    }
  } catch (err) {
    console.log(err)
    customError(err.message, 500, res)
  }
})

router.post("/api/v1/test/result/enter", async function (req, res) {
  try {
    const { billingid, testname } = req.body
    const resultInstance = new Result(billingid, testname)
    switch (testname) {
      case "hepatitis_b":
        await resultInstance.hepatitisBresult(req.body, res)
        break
      case "hepatitis_c":
        await resultInstance.hepatitisBresult(req.body, res)
        break
      case "blood_grouping":
        await resultInstance.BloodGroupingResult(req.body, res)
        break
      case "glycated_heamoglobin":
        await resultInstance.glycatedHaemoglobin(req.body, res)
        break
      case "urinalysis":
        await resultInstance.urinalysisResult(req.body, res)
        break
      case "cardiac_enzymes":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "pregnancy_test":
        await resultInstance.pregnancyTest(req.body, res)
        break
      case "renal_function_test":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "liver_function_test":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "full_blood_count":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "malaria":
        await resultInstance.malaria(req.body, res)
        break
      case "widal":
        await resultInstance.widal(req.body, res)
        break
      case "hepatitis_b_profile":
        await resultInstance.hepatitisBProfile(req.body, res)
        break
      case "hvs":
        await resultInstance.hvs(req.body, res)
        break
      case "semen_analysis":
        await resultInstance.semenAnalysis(req.body, res)
        break
      case "thyroid_functional_test":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "beta_thalassemia":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "betahcg":
        await resultInstance.betahcg(req.body, res)
        break
      case "aids":
        await resultInstance.Aids(req.body, res)
        break
      case "esr":
        await resultInstance.esr(req.body, res)
        break
      case "random_blood_sugar":
        await resultInstance.glucose(req.body, res)
        break
      case "fasting_blood_sugar":
        await resultInstance.glucose(req.body, res)
        break
      case "follicle_stimulating_hormone":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "luteinizing_hormone":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "lipid_profile":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "helicobacter_pylori":
        await resultInstance.helicobacter_pylori(req.body, res)
        break
      case "scan":
        await resultInstance.scanResult(req.body, res)
        break
      case "prostate_specific_antigen_test":
        await resultInstance.liverfunctionTest(req.body, res)
        break
      case "syphilis":
        await resultInstance.syphilis(req.body, res)
        break
      case "clotting_and_bleeding_time":
        await resultInstance.clotandbleed(req.body, res)
        break
      case "stool_analysis":
        await resultInstance.stoolAnalysis(req.body, res)
        break
      default:
        return res.send({ status: "error", message: "test not found", statusCode: 400 })
    }
  } catch (err) {
    res.status(500).send({ message: err.message, statusCode: 500 })
  }
})

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

router.get("/api/v1/result/reference/betahcg", async function (request, response) {
  try {
    const result = await new Result().getBetaHcgReference()
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

  const insertUpdate = async function () {
    const insertAll = await Promise.all(
      fields.map(async (item, index) => {
        if (await shouldCreateRecord(billingid, patientid, tablename, item.field)) {
          const values = [item.field, billingid, patientid, item.value, employeeid]
          const query = `INSERT INTO ${tablename} (field,billingid,patientid,value,employeeid) VALUES(?,?,?,?,?)`
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

module.exports = router
