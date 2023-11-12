const sales = require('../models/sales');
const router = require('express').Router();


router.get('/api/v1/sales/summary/general', function (request, response) {
  const { target, branch } = request.query;
  if (!target || ['yearly', 'monthly', 'daily', 'weekly'].includes(target) === false ||!branch) {
    response.send({
      statusCode: 400,
      status: 'error',
      message: 'Please provide a target and include branch in request query'
    })
  } else {
    sales.generalSales(request, response, target,branch);
  }
})





module.exports = router;