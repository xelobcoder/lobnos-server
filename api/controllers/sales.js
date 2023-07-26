const sales = require('../models/sales');
const router = require('express').Router();


router.get('/api/v1/sales/summary/general', function (request, response) {
  const { target } = request.query;
  if (!target || ['yearly', 'monthly', 'daily', 'weekly'].includes(target) === false) {
    response.send({
      statusCode: 400,
      status: 'error',
      message: 'Please provide a target'
    })
  } else {
    sales.generalSales(request, response, target);
  }
})



module.exports = router;