const {
  getClinicians,
  putCliniciansbasic,
  deleteClinicians, getSingleClinician,
  postClinicianBasicInfo,
  getTopPerformingClinicians,
  getClinicianResult,
  getBillingTestBasedByClinician
} = require('../../api/clinicians');
const { customError } = require('../../helper');
const logger = require('../../logger');
const Registration = require('../models/registration');

const router = require('express').Router();

router.get('/api/v1/clinicians', async (req, res) => {
  const { id } = req.query;
  if (id) {
    getSingleClinician(req, res);
  }
  else {
    getClinicians(req, res);
  }
});

router.put('/api/v1/clinicians', async (req, res) => {
  putCliniciansbasic(req, res);
});

router.delete('/api/v1/clinicians', async (req, res) => {
  deleteClinicians(req, res);
});

router.post('/api/v1/clinicians', async (req, res) => {
  postClinicianBasicInfo(req, res);
});

router.get('/api/v1/clinician/performance/top', function(request,response) {
  getTopPerformingClinicians(request,response)
})

router.post('/api/v1/client/filter/clinician', async function (request, response) { 
  const { data } = request.body;
  if (!data) { customError('please add data', 401, response) }
  else {
    const result = await new Registration().filterPatientUsingClient(data);
  response.send({ status: 'success', statusCode: 200, result })
  }
})


router.get('/api/v1/clinician/resultsets', async function (request, response) { 
  try {
    const { clinicianid, startdate, enddate } = request.query
    if (!clinicianid) {
      customError("please add clinicianid", 401, response)
    } else {
      const result = await getClinicianResult(clinicianid, startdate, enddate);
      response.send({ status: "success", statusCode: 200, result })
    }
  } catch (err) {
    logger.error(err)
    customError(err, 401, response)
  }
})


router.get('/api/v1/clinician/resultsets/billingid', async function (request, response) {
  try { 
    const { billingid, clinicianid } = request.query;
    if (!billingid || !clinicianid) {
      customError("please add billingid and clinicianid", 401, response)
    } else {
      const result = await getBillingTestBasedByClinician(billingid, clinicianid);
     response.send({statusCode: 200, status: 'success', result})
    }
  } catch (err) {
    logger.error(err);
    customError(err?.message || 'something went wrong', 500, response);
  }
})


router.post('/api/v1/orders/temporary', async function (request, response) {
  try {
    const result = await new Registration().temporaryOrder(request.body);
    if(result == true) {
      response.send({statusCode: 200, status: 'success',message: "order added successfully"})
    } else {
      const message = result == false ? 'kindly update orders in the order page' : 'something went wrong while trying to add order';
      customError(message, 500, response)
    }
  } catch (err) {
    customError('Something wrong ocured', 500, response)
   }
})
 

router.get('/api/v1/orders/temporary', async function (request, response) {
  const { clinicianid } = request.query;
  if (!clinicianid) { customError('please add clinicianid', 401, response); return }
  try {
    const result = await new Registration().getTemporaryOrders(clinicianid);
    response.send({statusCode: 200, status: 'success', result})
  } catch (err) {
    customError('Something wrong ocured', 500, response)
  }
})

module.exports = router;