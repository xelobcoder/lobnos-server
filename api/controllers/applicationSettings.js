const router = require('express').Router()
const { customError } = require('../../helper');
const database_queries = require('../database/queries');
const applicationsettings = require('../models/applicationSettings');
const EmailService = require('../EmailServices/email');
const path = require("path");
const { testInformation, clientInformation } = require('../models/invoice');

router.get('/api/v1/applicationsettings', function (request, response) {
  applicationsettings.getApplicationSettings(request, response)
})


router.post('/api/v1/applicationsettings', function (request, response) {
  applicationsettings.updateApplicationSettings(request, response)
})


router.put('/api/v1/applicationsettings/smsupdate', function (request, response) {
  applicationsettings.updateSmsSettings(request, response)
})

router.get('/api/v1/applicationsettings/smsupdate', function (request, response) {
  applicationsettings.getSmsSettings(request, response);
})


router.get('/api/v1/applicationssettings/emailpreference', async function (request, response) {
  try {
    let data = await database_queries.getsingleid(1, `emailpreference`, 'id');
    if (data.length > 0) { 
      delete data[0]['id'];
      delete data[0]['updated_on'];
      delete data[0]['created_on'];
      response.send({message:'success', status:'success', statusCode:200, result:data[0]})
    }
   } catch (err) {customError( "something went wrong", 500, response)}
})

router.get('/api/v1/applicationssettings/email/emailsettings', async function (request, response) {
  try {
    const result = await applicationsettings.getGeneralEmaiSettings();
   response.send({message:'success', status:'success', statusCode:200, result})
 } catch (err) {customError( "something went wrong", 500, response)}
})


router.put('/api/v1/applicationssettings/email/emailsettings', async function (request, response) {
  try {
    const result = await applicationsettings.generalEmailSettings(request.body);
    response.send({ message: result?.affectedRows == 1 ? "updated successfully" : "No updates effected", status: 'success', statusCode: 200 });
  } catch (err) {
    customError( "something went wrong", 500, response)
  }
})


router.post('/api/v1/applicationssettings/emailpreference', function (request, response) {
  applicationsettings.updatePreference(request, response);
})

router.post('/api/v1/application/tax', function (request, response) {
  applicationsettings.addTax(request, response);
})

router.get('/api/v1/application/tax', async function (request, response) {
  applicationsettings.getTax(request, response);
})

router.put("/api/v1/application/tax", function (request, response) {
  applicationsettings.updateTax(request, response)
})

router.put("/api/v1/application/tax/activation", async function (request, response) {
  applicationsettings.changeTaxStatus(request, response)
})

router.delete("/api/v1/application/tax", async function (request, response) {
  applicationsettings.deleteTax(request, response)
})


router.get("/api/v1/applicationsetting/resultsettings", async function (request, response) {
  applicationsettings.getResultsettings(request, response)
})

router.put("/api/v1/applicationsetting/resultsettings", async function (request, response) {
  applicationsettings.updateResultSettings(request, response)
})

module.exports = router;


router.get("/api/test/email", async function (request, response) {
  // const variables = await applicationsettings.getGeneralEmaiSettings();
  // const { provider, apppassword, email } = variables[0];
  // const x = new EmailService(email, apppassword, provider, 'Kairos Diagnostic');

  // x.forwardBillingReceipt(219)

  const x = await testInformation(219);
  const y = await clientInformation(219);
  response.render(path.join(__dirname,"../views","templates","billing.ejs"),{data: {testdata:x , personalInfo:y[0]}})  
  // response.send({x,y});
})
