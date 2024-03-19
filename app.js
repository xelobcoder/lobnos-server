const express = require("express")
const app = express()
const emailRouterController = require("./api/controllers/email.controller")
const port = 5000
const { Billing, getClientBillingInformation, getBilledClients, updateBilling } = require("./api/billing")
const branchesHandler = require("./api/branches")
const resultChecker = require("./api/controllers/results")
const Manager = require("./api/controllers/manager")
const operationsRouter = require("./api/controllers/operations")
const registrationRouter = require("./api/controllers/registration")
const rejectedRouter = require("./api/controllers/rejected")
const stocksRouter = require("./api/controllers/Inventory/stocks")
const activation = require("./api/activation")
const clinicianRouter = require("./api/controllers/clinicians")
const { get } = require("./api/center")
const SampleHandler = require("./api/sample")
const ChemistryRoutes = require("./api/controllers/chemistrysetup")
const phelobotomyRouter = require("./api/controllers/phelobotomy")
const supplyRouter = require("./api/controllers/supply")
const settingsRouter = require("./api/controllers/settings")
const User = require("./api/LobnosAuth/user")
const LoginsRouter = require("./api/controllers/logins")
const resultprintRouter = require("./api/controllers/printable")
const organizationRouter = require("./api/controllers/organization")
const applicationsettingsRouter = require("./api/controllers/applicationSettings")
const generalSalesRouter = require("./api/controllers/sales")
const patientAnalytics = require("./api/controllers/patients.controller")
const WarehouseRouter = require("./api/controllers/Inventory/warehouse")
const wastagesRouter = require("./api/controllers/Inventory/wastages")
const inventoryDepartmentRouter = require("./api/controllers/Inventory/departments")
const testPanelRouter = require("./api/controllers/testpanel/testpanelRouter")
const cors = require("cors")
const configuration = require("./helpers/configuration")

app.listen(port, () => {
  console.log(`listening at port ${port}`)
})

const { customError, responseError } = require("./helper")
const Inventoryanalytics = require("./api/models/Inventory/inventoryAnalytics")
const EmailService = require("./api/EmailServices/EmailCore")
app.use(cors({ origin: "*", credentials: false }))
app.use(express.static("public"))

// manage with cors
// manage with body-parser
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ensuring an acess token is present
app.use(async(req, res, next) => {
  if (req.url == '/api/v1/register') {
    next();
  } else {
    // console.log(new User().applicationAccessToken())
   await new User().validateRequestToken(req, res, next, process.env.ACCESS_TOKEN_SECRET)
  }
})

// api endpoints
app.use((req, res, next) => {
  configuration.logRequest(req, res, next)
})
app.use(testPanelRouter)
app.use(Manager)
app.use(organizationRouter)
app.use(emailRouterController)
app.use(LoginsRouter)
app.use(ChemistryRoutes)
app.use(phelobotomyRouter)
app.use(rejectedRouter)
app.use(supplyRouter)
app.use(settingsRouter)
app.use(operationsRouter)
app.use(resultprintRouter)
app.use(resultChecker)
app.use(clinicianRouter)
app.use(generalSalesRouter)
app.use(branchesHandler)
app.use(registrationRouter)
app.use(applicationsettingsRouter)
app.use(stocksRouter)
app.use(patientAnalytics)
app.use(WarehouseRouter)
app.use(wastagesRouter)
app.use(inventoryDepartmentRouter)

app.get("/", (req, res) => {
  res.status(200).json({ message: "success" })
})

app.get("/api/v1/authenticate/employee/token", async function (request, response) {
  new User().validateEmployeeToken(request, response)
})

app.post("/api/v1/billing", async (req, res) => {
  try {
    const {
      patientid,
      clinician,
      organization,
      test,
      payable,
      testcost,
      paid,
      taxIncluded,
      taxValue,
      status,
      discount,
      paymentmode,
      samplingCenter,
      outstanding,
      cost,
      employeeid,
    } = req.body

    const billing = new Billing(
      patientid,
      clinician,
      organization,
      test,
      payable,
      testcost,
      paid,
      taxIncluded,
      taxValue,
      status,
      discount,
      paymentmode,
      samplingCenter,
      outstanding,
      cost
    )

    const result = await billing.insertionProcess(req, res, employeeid)

    if (result === true) {
      res.status(200).json({ message: "billing successfully", billingid: result, statusCode: 200, status: "success" })
    } else {
      customError(result, 404, res)
    }
  } catch (err) {
    responseError(res)
  }
})

app.get("/api/v1/billedclients", (req, res) => {
  getBilledClients(req, res)
})

app.get("/api/v1/billing", function (request, response) {
  getClientBillingInformation(request, response)
})

app.put("/api/v1/billing", function (request, response) {
  updateBilling(request, response)
})

// sample api endpoint

app.get("/api/v1/sample", function (request, response) {
  const { count, page } = request.query
  let sampleHandle = new SampleHandler(request, response)
  sampleHandle.getCollectedSamples(count, page)
})

app.put("/api/v1/sample", function (request, response) {
  const sampleHandle = new SampleHandler(request, response)
  sampleHandle.updateRecords(request, response)
})

app.get("/api/v1/activation", (req, res) => {
  const Keys = Object.keys(req.query)
  if (Keys.includes("action") && Keys.includes("patientid")) {
    activation.activateDeactivate(req, res)
  } else {
    activation.getPartialData(req, res)
  }
})

app.get("/api/v1/activation/bulk", (req, res) => {
  activation.activateDeactivate(req, res)
})

app.get("/api/v1/center", (req, res) => {
  get(req, res)
})

const targetHour = 18

const upDateInventoryAnalyticSummary = async () => {
  try {
    const currentHour = new Date().getHours()
    if (currentHour === targetHour) {
      await new Inventoryanalytics().updateInvenAnalSummary()
    }
  } catch (err) {
    console.log(err)
  }
}

// upDateInventoryAnalyticSummary()

app.get("/email/templates", async function (request, response) {
  var path = require('node:path')
  response.render(path.join(__dirname,'./api/views/templates/sampleRejection.ejs'),{data:{labname:'Vitalscan laboratory',header:'sample rejection notice'}})
})

