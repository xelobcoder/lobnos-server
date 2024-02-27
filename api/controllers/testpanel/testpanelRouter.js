const { promisifyQuery, rowAffected, customError, responseError } = require("../../../helper")
const { getCategory, postCategory } = require("../../testpanel/categories")
const testpanel = require("../../testpanel/list")

const router = require("express").Router()

router.get("/api/v1/testpanel/categories", (req, res) => {
  getCategory(req, res)
})

router.post("/api/v1/testpanel/categories", (req, res) => {
  postCategory(req, res)
})

router.get("/api/v1/testpanel/list", (req, res) => {
  testpanel.getPanels(req, res)
})

router.get("/api/v1/testpanel/list/bulk", (req, res) => {
  testpanel.getpanelsbulk(req, res)
})

router.get("/api/v1/gettestpanel/edit", async function (request, response) {
  try {
    const { id } = request.query
    if (!id) return customError("testid is required", 404, response)
    const result = await testpanel.getPanelEditSingle(id)
    response.send(result.length > 0 ? result[0] : {})
  } catch (err) {
    responseError(response)
  }
})
router.put("/api/v1/test/updateprocedureManual", async function (request, response) {
    const { proceduremanual, employeeid, testid, title } = request.body
  if (!proceduremanual || !employeeid || !testid) {
    return customError("emplyeeid , testid and proceduremanual are required", 404, response)
  }
  const isUpdated = await testpanel.updateProcedureManual(proceduremanual, parseInt(testid), parseInt(employeeid), title)
  response.send({ status: isUpdated === true ? "success" : "failed" })
})

router.get("/api/v1/test/getProcedureManual", async function (request, response) {
  try {
    const { testid } = request.query
    if (!testid) {
      return customError("testid is required", 404, response)
    }
    const result = await testpanel.getProcedureManuel(testid)
    response.send(result)
  } catch (err) {
    responseError(err)
  }
})

router.post("/api/v1/testpanel/bulkupdate", (request, response) => {
  testpanel.bulkTestUpdate(request, response)
})

router.get("/api/v1/testpanel/list/update", async function (req, res) {
  const { billingid } = req.query
  if (billingid) {
    try {
      const insertion = `SELECT * FROM test_panels AS tp  INNER JOIN
       test_ascension AS ta ON  ta.testid = tp.ID WHERE ta.billingid = ?`
      const result = await promisifyQuery(insertion, billingid)
      res.send({ message: "success", statusCode: 200, result })
    } catch (err) {
      logger.error(err)
    }
  } else {
    res.send({
      statusCode: 401,
      status: "billing id required",
      message: "include billing in the request header as a query",
    })
  }
})

router.post("/api/v1/testpanel/list", (req, res) => {
  testpanel.postPanel(req, res)
})

router.put("/api/v1/testpanel/list", function (request, response) {
  testpanel.putSingleTestPanel(request, response)
})

router.delete("/api/v1/testpanel/list", (req, res) => {
  testpanel.deletePanel(req, res)
})

module.exports = router
