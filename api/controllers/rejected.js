const express = require('express');
const router = express.Router();
const SampleHandler = require('../sample');

router.get('/api/v1/rejected', function (request, response) {
    new SampleHandler().getRejectedSamplesList(request, response);
})

router.post('/api/v1/rejected', function (request, response) {
    new SampleHandler().rejectedSampleApproval(request, response);
})


router.put('/api/v1/sample/rejection/disputed', function (request, response) {
    new SampleHandler().disputeSampleRejection(request, response);
})







module.exports = router;