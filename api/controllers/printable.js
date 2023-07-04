const router = require('express').Router();
const ResultPrint = require('../models/ResultPrint');
const { testCategoryMapping } = require('../models/ResultQueryMapping');
const Payment = require('../models/payment')
const result = new ResultPrint();

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
   const { test } = request.query;
   const category = testCategoryMapping[test];

   if (!test) {
      response.send({
         statusCode: "401",
         message: "test not found"
      });
   }

   if (!category) {
      response.send({
         statusCode: "401",
         message: "No categoy found for test"
      });
   }

   if (category && test) {
      if (category == "chemistry") {
         result.resultPreviewChemistry(request, response, category);
      } else if (category == "hema") {
         result.resultPreviewHematological(request, response, category);
      } else {
         response.send({
            statusCode: "400",
            message: "Category not found",
         });
      }
   }
})


router.get('/api/v1/result/preview/comments', function (request, response) {
   const { billingid, testid } = request.query;
   if (billingid) {
      new ResultPrint().getComments(billingid, testid, response);
   } else {
      response.send({
         status: 'error',
         statusCode: 401,
         message: 'Include Billingid '
      })
   }
})


// this check if test for a client  is approved  for printing 

router.post('/api/v1/test/result/preview/approved/check', function (request, response) {
   const { billingid, testid } = request.body;

   if (billingid && testid) {
      new ResultPrint().checkApproval(request, response);
   } else {
      response.status(401).json({
         status: 'error',
         message: 'include testid and billing in request body'
      })
   }
})



router.post('/api/v1/result/approve', function (request, response) {
   result.makeDecisionOnResult(request, response);
})


module.exports = router;