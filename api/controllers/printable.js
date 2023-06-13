const router = require('express').Router();
const ResultPrint = require('../models/ResultPrint');
const { testCategoryMapping } = require('../models/ResultQueryMapping');
const Payment = require('../models/payment')


router.get('/api/v1/result/ready', async function (req, res) {
   new ResultPrint().get_printables(req, res)
})


router.get('/api/v1/result/ready/:id', async (req, res) => {
   const billingid = parseInt(req.params.id.slice(1));
   new ResultPrint().get_extrainfo_test(billingid, req, res)
})


router.get('/api/v1/result/ready/crm/summary', (req, res) => {
   new ResultPrint().get_summary_ready_page(req, res)
})


router.get('/api/v1/billing/payment/info/client',
   (request, response) => {
      new Payment().getClientTransactionInformation(request, response)
   }
);


router.get('/api/v1/paymentmodes', function (request, response) {
   new Payment().paymentMode(request, response)
})

router.get('/api/v1/billing/client/transactionhx', function (request, response) {
   new Payment().specificBillTransactionHx(request, response)
})

router.post('/api/v1/billing/payment/update', function (request, response) {
   new Payment().updatePayment(request, response);
})


router.get('/api/v1/result/preview', function (request, response) {
   const { test } = request.query
   const category = testCategoryMapping[test];
   if (!test) {
      response.send({
         statusCode: '401',
         message: 'test not found'
      })
   } else {
      if (category) {
         switch (category) {
            case 'chemistry':
               new ResultPrint().resultPreviewChemistry(request, response,category);
               break;
            case 'hema':
               new ResultPrint().resultPreviewHematological(request, response,category);
               break;
            default:
               response.send({
                  statusCode: '400',
                  message: 'Category not found'
               })
         }
      } else {
         response.send({
            statusCode: '401',
            message: 'No categoy found for test'
         })
      }
   }
})


module.exports = router;