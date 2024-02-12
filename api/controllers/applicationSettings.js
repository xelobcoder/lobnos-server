const router = require('express').Router()
const { customError, rowAffected } = require("../../helper")
const ApplicationSettings = require("../models/application/settings")
const Tax = require("../models/application/tax")
const ResultSettings = require("../models/application/results");
const appsettings = new ApplicationSettings()
const tax = new Tax()
const result = new ResultSettings();

router.get("/api/v1/applicationsettings", function (request, response) {
  appsettings.getApplicationSettings(request, response)
})

router.post("/api/v1/applicationsettings", function (request, response) {
  appsettings.updateApplicationSettings(request, response)
})

router.put("/api/v1/applicationsettings/smsupdate", function (request, response) {
  appsettings.updateSmsSettings(request, response)
})

router.get("/api/v1/applicationsettings/smsupdate", function (request, response) {
  appsettings.getSmsSettings(request, response)
})

router.get("/api/v1/applicationssettings/emailpreference", async function (request, response) {
  try {
    const result = await appsettings.getEmailPreference()
    response.send({ message: "success", status: "success", statusCode: 200, result })
  } catch (err) {
    customError("something went wrong", 500, response)
  }
})

router.get("/api/v1/applicationssettings/email/emailsettings", async function (request, response) {
  try {
    const result = await appsettings.getGeneralEmailSettings()
    response.send({ message: "success", status: "success", statusCode: 200, result })
  } catch (err) {
    customError("something went wrong", 500, response)
  }
})

router.put("/api/v1/applicationssettings/email/emailsettings", async function (request, response) {
  try {
    const result = await appsettings.updateGeneralEmailSettings(request.body)
    response.send({
      message: rowAffected(result) ? "updated successfully" : "No updates effected",
      status: "success",
      statusCode: 200,
    })
  } catch (err) {
    customError("something went wrong", 500, response)
  }
})

router.post("/api/v1/applicationssettings/emailpreference", function (request, response) {
  appsettings.updateEmailPreference(request, response)
})

router.post("/api/v1/application/tax", function (request, response) {
  tax.addTax(request, response)
})

router.get('/api/v1/application/tax', async function (request, response) {
  tax.getTax(request, response);
})

router.put("/api/v1/application/tax", function (request, response) {
  tax.updateTax(request, response);
})

router.put("/api/v1/application/tax/activation", async function (request, response) {
  tax.changeTaxStatus(request, response);
})

router.delete("/api/v1/application/tax", async function (request, response) {
  tax.deleteTax(request, response);
})


router.get("/api/v1/applicationsetting/resultsettings", async function (request, response) {
  result.getResultSettings(request, response);
})

router.put("/api/v1/applicationsetting/resultsettings", async function (request, response) {
  result.updateResultSettings(request, response);
})

module.exports = router;


// router.get("/api/test/email", async function (request, response) {
//   // const variables = await applicationsettings.getGeneralEmaiSettings();
//   // const { provider, apppassword, email } = variables[0];
//   // const x = new EmailService(email, apppassword, provider, 'Kairos Diagnostic');

//   // x.forwardBillingReceipt(219)

//   const x = await testInformation(219);
//   const y = await clientInformation(219);
//   response.render(path.join(__dirname,"../views","templates","billing.ejs"),{data: {testdata:x , personalInfo:y[0]}})  
//   // response.send({x,y});
// })
