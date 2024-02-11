const Operations = require('../models/operations');

const router = require('express').Router();

router.get('/api/v1/operations/collection', async (req, res) => {
  const collections = new Operations();
  const result = await collections.getAllReadyTest(req);
  res.send({ statusCode: 200, message: "success", result })
});


router.get('/api/v1/operations/test', async (req, res) => {
  // get the billingid from the request
  const { billingid } = req.query;

  if (!billingid) {
    return res.status(400).send({
      statusCode: 400,
      message: 'Invalid billingid'
    })
  }
  else {
    const result = await new Operations(billingid).billingTest(req);

    if (result === 'Billingid is not ready for testing') {
      return res.status(400).send({
        statusCode: 400,
        message: result
      })
    } else {
      res.send({
        statusCode: 200,
        message: 'success',
        result
      })
    }
  }
});

router.put('/api/v1/operations/test', async (req, res) => {
  // get the billingid from the request and the testid
  const { billingid, testid } = req.query;

  if (!billingid || !testid) {
    return res.status(400).send({
      statusCode: 400,
      message: 'billing id or testid is missing'
    })
  }
  else {
    const updatesProcessing = new Operations(billingid);
    const result = await updatesProcessing.initiateStart(testid, billingid);

    if (result.affectedRows === 1) {
      res.send({
        statusCode: 200,
        message: 'success',
        result
      })
    }
    else {
      res.send({
        statusCode: 400,
        message: 'failed to update',
        result
      })
    }

  }
})


router.get('/api/v1/operations/overview', async function (request, response) {
  await new Operations().operationsOverview(request, response)
})



router.get('/api/v1/operations/collection/result', async function (request, response) {
  await new Operations().getAllEnterResult(request, response)
})


router.get('/api/v1/operations/test/result', async function (request, response) {
  await new Operations().getAllTestPreview(request, response)
})


router.get('/api/v1/operations/imaging/ultrasound', async function (request, response) {
  await new Operations().getUltrasoundWaitingList(request, response)
})


router.get('/api/v1/operations/imaging/ultrasound/processed', async function (request, response) {
  await new Operations().processedScanList(request, response)
})


module.exports = router;