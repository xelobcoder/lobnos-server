const router = require('express').Router();
const { customError } = require('../../helper');
const ResultPrint = require('../models/ResultPrint');
const { testCategoryMapping } = require('../models/ResultQueryMapping');
const EmailService = require('../models/email');
const { getBillingInvoiceData } = require('../models/invoice');
const Payment = require('../models/payment')
const result = new ResultPrint();
const createReceipt = require('../models/billingReceipt');


router.get('/api/v1/result/ready', async function (req, res) {
   new ResultPrint().get_printables(req, res)
})

router.get('/api/v1/ready/crm/summary/advanced', function (request, response) {
   new ResultPrint().advancedTablesSearch(request, response);
})

router.get('/api/v1/result/ready/:id', async (req, res) => {
   const billingid = parseInt(req.params.id.slice(1));
   new ResultPrint().get_extrainfo_test(billingid, req, res)
})


router.get('/api/v1/result/ready/crm/summary', (req, res) => {
   new ResultPrint().get_summary_ready_page(req, res)
})




router.get('/api/v1/billing/payment/info/client',
   async (request, response) => {
      const payment = new Payment();
      if (request.query.billingid) {
         try {
            const result = await payment.getTransactionData(request.query.billingid);
            response.send({ result, statusCode: 200, status: 'success' })
         } catch (err) {
            customError(err?.message, 500, response);
         }
      } else {
         payment.getClientTransactionInformation(request, response)
      }
   }
);


router.get('/api/v1/billing/client/bulk/outstanding', async function (request, response) {
   const { patientid } = request.query;
   if (!patientid) {
      customError(`patientid required`, 404, response);
   } else {
      const result = await new Payment().allClientDebtTransactions(patientid);
      response.send({ result, statusCode: 200, status: 'success' })
   }
})



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


router.get('/api/v1/billing/invoice', function (request, response) {
   const { billingid } = request.query;
   getBillingInvoiceData(billingid,response);
})


router.get('/api/v1/billing/email/receipt', async function (request, response) {
   const { billingid } = request.query;
   if (billingid) {
      await new EmailService().forwardBillingReceipt(billingid);
   } else {
      customError(`billing id required`, 404, response);
   }
})


router.get('/billing/receipt', async function (request, response) {
   const {billingid} = request.query;
   try {
      createReceipt(response,billingid);
   } catch (error) {
      console.log(error)
   }
})

module.exports = router;