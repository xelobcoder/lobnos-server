const router = require('express').Router();
const Result = require('../models/result')
const pdf = require('../pdfGeneration/result');
router.get('/api/v1/test/result/check', async function (req, res) {
  try {
    const { billingid, testname } = req.query;
    const resultChecker = new Result(billingid, testname);
    const result = await resultChecker.isResultEntered();
    const records = await resultChecker.getTestResult();

    if (!billingid && !testname) {
      res.status(400).send({
        message: 'Invalid data',
        statusCode: 400,
      })
    }
    else {
      result.length === 0 ?
        res.send({
          message: 'Result not entered',
          statusCode: 200,
          result: false
        }) :
        res.send({
          message: 'Result entered',
          statusCode: 200,
          result: true,
          records
        })
    }
  }
  catch (err) {
    res.status(500).send({
      message: err?.message,
      statusCode: 500
    })
  }
})



router.post('/api/v1/test/result/enter', async function (req, res) {
  try {
    const { billingid, testname } = req.body;
    switch (testname) {
      case 'hepatitisb':
        await new Result(billingid, testname).hepatitisBresult(req.body, res)
        break;
      case 'hepatitisc':
        await new Result(billingid, testname).hepatitisBresult(req.body, res)
        break;
      case 'bloodgrouping':
        await new Result(billingid, testname).BloodGroupingResult(req.body, res)
        break;
      case 'glycated_haemoglobin':
        await new Result(billingid, testname).glycatedHaemoglobin(req.body, res)
        break;
      case 'urinalysis':
        await new Result(billingid, testname).urinalysisResult(req.body, res);
        break;
      default:
        return res.send({
          status: 'error',
          message: 'test not found',
          statusCode: 400
        })
    }
  }
  catch (err) {
    res.status(500).send({
      message: err?.message,
      statusCode: 500
    })
  }
})




module.exports = router;