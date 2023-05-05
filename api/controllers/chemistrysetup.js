const router = require('express').Router();
const Chemistry = require('../models/chemistry');
const { insertdata, getdata, deleteData, getCreatedParams } = require('../test/setup/fbc');

const { doHaveParameter, createParameter, TableNames } = require('../../api/test/setup/createparams')

router.get('/api/v1/test/setup/chemistry', (req, res) => {
  new Chemistry().getRecords(req, res);
});

router.post('/api/v1/test/setup/chemistry', (req, res) => {
  const { category, data } = req.body;

  const chemistry = new Chemistry(category, data);
  if (chemistry.validateData()) {
    chemistry.clearTable()
      .then(result => {
        chemistry.insertData(req, res);
      })
      .catch(err => {
        res.status(500).send({
          message: err.message,
          statusCode: 500
        })
      })
  } else {
    res.status(400).send({
      message: 'Invalid data',
      statusCode: 400,
    })
  }
})


router.post('/api/v1/test/input/chemistry', (req, res) => {
  const { testname, data } = request.body;

})


router.get('/api/v1/test/input/chemistry', (req, res) => {
  const category = req.query.category;
  if (!category) {
    res.status(400).send({
      message: 'Invalid data',
      statusCode: 400,
    })
  } else {
    const collection = {
      renal: 'h'
    }
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
  // get db tableName
  const tableCollection = TableNames[target];

  if (tableCollection == undefined) {
    response.send({
      status: 'error',
      statusCode: 401,
      message: 'please add key target test'
    })
  }
  else {
    const { unit, upper, lower, parameter } = parameterDetails;
    const available = await doHaveParameter(parameter, 'PARAMETER', tableCollection)

    if (available.length == 0) {
      let results = await createParameter(tableCollection, [parameter, upper, lower, unit]);

      if (results.affectedRows === 1) {
        response.send({
          status: 'success',
          statusCode: 200,
          message: 'parameter created'
        })
      }
      else {
        response.send({
          status: 'error',
          statusCode: 401,
          message: 'parameter not created'
        })
      }
    }
    else {
      response.send({
        status: 'error',
        statusCode: 401,
        message: 'parameter already exists'
      })
    }
  }
})

module.exports = router;