const router = require('express').Router();
const{ Result} = require('../models/result')
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
    const resultInstance = new Result(billingid, testname)
    switch (testname) {
      case "hepatitisb":
        await resultInstance.hepatitisBresult(req.body, res);
        break;
      case "hepatitisc":
        await resultInstance.hepatitisBresult(req.body, res);
        break;
      case "bloodgrouping":
        await resultInstance.BloodGroupingResult(req.body, res);
        break;
      case "glycated_haemoglobin":
        await resultInstance.glycatedHaemoglobin(req.body, res);
        break;
      case "urinalysis":
        await resultInstance.urinalysisResult(req.body, res);
        break;
      case "cardiac_enzymes":
        await resultInstance.cardiacEnzymes(req.body, res);
        break;
      case "pregnancy_test":
        await resultInstance.pregnancyTest(req.body, res);
        break;
      case "renalfunctiontest":
        await resultInstance.renalFunctionalTest(req.body, res);
        break;
      case "liverfunctiontest":
        await resultInstance.liverfunctionTest(req.body, res);
        break;
      case "malaria":
        await resultInstance.malaria(req.body, res);
        break;
      case "widal":
        await resultInstance.widal(req.body, res);
        break;
      case "hepatitis_b_profile":
        await resultInstance.hepatitisBProfile(req.body, res);
        break;
      case "hvs":
        await resultInstance.hvs(req.body, res);
        break;
      case "semenAnalysis":
        await resultInstance.semenAnalysis(req.body, res);
        break;
      case "thyroidfunctionaltest":
        await resultInstance.thyroid(req.body, res);
        break;
      case "betahcg":
        await resultInstance.betahcg(req.body, res);
        break;
      case 'aids':
        await resultInstance.Aids(req.body, res);
        break;
      case 'esr':
        await resultInstance.esr(req.body, res);
        break;
      case 'randombloodsugar':
        await resultInstance.glucose(req.body, res);
        break;
      case 'fastingbloodsugar':
        await resultInstance.glucose(req.body, res);
        break;
      default:
        return res.send({
          status: "error",
          message: "test not found",
          statusCode: 400,
        });
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