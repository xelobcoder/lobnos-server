const router = require('express').Router();
const Chemistry = require('../models/chemistry');
const { insertdata, getdata, deleteData, getCreatedParams } = require('../test/setup/fbc');
const TestSetup = require('../models/testSetup.model');
const { TableNames, createBetaRanges } = require('../../api/test/setup/createparams');;
const { promisifyQuery, customError } = require('../../helper');

router.get('/api/v1/test/setup/entry', async (req, res) => {
  const { testname } = req.query;
  try {
    if (testname) { 
      const test = new TestSetup(testname);
      if (test.isValidTestname()) {
        const records = await test.getSetupRecords();
        const literature = await test.getSetupLiterature(testname);
        res.send({ status: 'success', statusCode: 200, message: 'records fetched', records,resolve:true ,literature})
      } else { customError('invalid testname', 401, res)}
    } else {
      customError('please add testname', 401, res)
    }
  }
  catch (error) {
    customError(error?.message || 'something went wrong', 500, res);
  }
});

router.post('/api/v1/test/setup/entry',async  (req, res) => {
  const { testname, data, literature } = req.body;
  try {
    if (testname && data) {
      const test = new TestSetup(testname);
      test.updateTestParameter(data,literature,res);
    } else {
      customError('please add testname and data', 401, res)
    } 
  } catch (err) {
    logger.error(err);
    customError(err?.message || 'something went wrong', 500, res);
 }
})




router.get('/api/v1/test/setup/fbc', (req, res) => {
  getdata(req, res);
})



router.post('/api/v1/test/setup/fbc', (request, response) => {
  insertdata(request, response)
})


router.delete('/api/v1/test/setup/fbc', async function (request, response) {
  deleteData(request, response)
})


router.get('/api/v1/test/setup/fbc/createparams', async (request, response) => {
  getCreatedParams(request, response)
})



router.post('/api/v1/test/setup/createparams', async (request, response) => {
  const { target, parameterDetails } = request.body;
  const setupClass = new TestSetup(target);
  await setupClass.createTestParameter(parameterDetails,response);
})

router.delete('/api/v1/test/setup/entry/delete', async function (request, response) {
  try {
    const { setupid, parameter, testname } = request.body;
    if (setupid && parameter && testname) {
      const setupClass = new TestSetup(testname);
      const isDeleted = await setupClass.deleteSetupParams(setupid, parameter);
      isDeleted ?
        response.send({ status: 'success', statusCode: 200, message: 'record deleted successfully' }) 
        :
        customError('parameter delete failed', 401, response)
    } else {
      customError('please add setupid and parameter', 401, response)
     }
  } catch (err) {
    customError(err?.message || 'something went wrong', 500, response);
 }
})


router.post('/api/v1/setup/create/betahcg', async function (request, response) {
  try {
    const { target, records } = request.body
    const tableCollection = TableNames[target];
    if (tableCollection == undefined) {
      response.send({ status: 'error', statusCode: 401, message: 'please add key target test' })
    } else {
      //  truncate table 
      const isTruncated = await promisifyQuery(`TRUNCATE TABLE setup_beta_hcg`);
      if (isTruncated) { createBetaRanges(records, response) }
    }
  } catch (error) {
  customError(error?.message || 'something went wrong',500, response)
  }
})


router.get('/api/v1/setup/get/betahcg', async (request, response) => {
   new Chemistry().getBetaHcg(response);
})




module.exports = router;