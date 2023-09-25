const router = require('express').Router()
const database_queries = require('../database/queries');
const applicationsettings = require('../models/applicationSettings');

router.get('/api/v1/applicationsettings', function (request, response) {
  applicationsettings.getApplicationSettings(request, response)
})


router.post('/api/v1/applicationsettings', function (request, response) {
  applicationsettings.updateApplicationSettings(request, response)
})


router.put('/api/v1/applicationsettings/smsupdate', function (request, response) {
  applicationsettings.updateSmsSettings(request, response)
})

router.get('/api/v1/applicationsettings/smsupdate', function (request, response) {
  applicationsettings.getSmsSettings(request, response);
})


router.get('/api/v1/applicationssettings/emailpreference', async function (request, response) {
 response.send(await database_queries.getsingleid(1, `emailpreference`, 'id'));
})


router.post('/api/v1/applicationssettings/emailpreference', function (request, response) {
  applicationsettings.updatePreference(request, response);
})



module.exports = router;


