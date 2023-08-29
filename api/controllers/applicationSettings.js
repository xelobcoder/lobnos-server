const router = require('express').Router()
const {getApplicationSettings,updateApplicationSettings} = require('../models/applicationSettings');

router.get('/api/v1/applicationsettings', function (request, response) {
   getApplicationSettings(request,response)
})


router.post('/api/v1/applicationsettings', function(request,response) {
  updateApplicationSettings(request,response)
})




module.exports = router;

