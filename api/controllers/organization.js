const router = require('express').Router();

const o = require('../models/organization');

router.get('/api/v1/organization', function (request, response) {
  o.getOrganizations(request, response);
})


router.get('/api/v1/organizations/details', function (request, response) {
  o.getOrganizationWithDetails(request, response);
})

router.post('/api/v1/new/organizations', function (request, response) {
  o.createAOrganization(request,response);
})



module.exports = router;