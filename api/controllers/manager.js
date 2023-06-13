const router = require('express').Router();
const Manager = require('../models/manager');


router.get('/api/v1/manager/approvalist', function(request,response) {
   new Manager().getReadyForApprovals(request,response)
})

module.exports = router;