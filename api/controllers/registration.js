const router = require('express').Router();
const { customError, convertKeysToLowerCase } = require('../../helper');
const database_queries = require('../database/queries');
const Registration = require('../models/registration');


router.get("/api/v1/register", (request, response) => {

});

router.post("/api/v1/register", (request, response) => {
  const register = new Registration();
  register.addNewPatient(request, response)
});

router.put('/api/v1/register/personalinformation', async (request, response) => {
  const { patientid } = request.query;
  if (!patientid) {
    customError(`patientid not included in the request`, 400, response)
  } else {
    await new Registration(patientid).UpdatePersonalInformation(request, response);
  }
})

router.put('/api/v1/register/addressinginformation', async (request, response) => {
  const { patientid } = request.query;
  if (!patientid || patientid == 'undefined') {
    customError(`patientid not included in the request`, 400, response)
  } else {
    const records = request.body;
    const info = await new Registration(patientid).addressingInformation(patientid, records);
    if (info == 1) {
      response.send({
        message: 'record updated successfully',
        statusCode: 200,
        status: 'success'
      })
    } else {
      response.send({
        message: 'No record updated',
        statusCode: 200,
        status: 'success'
      })
    }
  }
})

router.get('/api/v1/register/personalinformation', async (request, response) => {
  const { patientid } = request.query;
  if (!patientid || patientid == 'undefined') {
    customError(`patientid not included in the request`, 400, response)
  } else {
    const data = await database_queries.getsingleid(parseInt(patientid), 'new_patients', 'PATIENTID');
    if (data.length > 0) {
      const dataOne = convertKeysToLowerCase(data[0])
      dataOne.maritalstatus = dataOne.marital_status;
      dataOne.mobile = parseInt(dataOne.mobile_number);
      dataOne.patientOrganization = dataOne.organization;
      const date = new Date(dataOne.dob);
      delete dataOne.marital_status;
      delete dataOne.mobile_number;
      delete dataOne.organization;
      dataOne.years = date.getFullYear();
      dataOne.months = date.getMonth() + 1;
      dataOne.days = date.getDate();
      response.send({ statusCode: 200, status: 'success', result: dataOne })
    } else {
      response.send({ statusCode: 200, status: 'success', result: [] })
    }
  }
})

router.get('/api/v1/register/addressingformation', async (request, response) => {
  const { patientid } = request.query;
  if (!patientid) {
    customError(`patientid not included in the request`, 400, response)
  } else {
    const data = await database_queries.getsingleid(patientid, 'patientsaddress', 'patientid');
    if (data.length > 0) {
      response.send({ statusCode: 200, status: 'success', result: data[0] })
    } else {
      response.send({ statusCode: 200, status: 'success', result: [] })
    }
  }
})
router.get('/api/v1/register/registration/settings', async (request, response) => {
  const settings = await (new Registration().isBulkRegistration());
  response.send({
    status: "success",
    message: "settings retrieved successfully",
    statusCode: 200,
    bulkRegistration: settings
  });
})


module.exports = router;