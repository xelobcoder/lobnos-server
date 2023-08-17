const database_queries = require('./database/queries');
const router = require('express').Router();

router.post('/api/v1/branches', function (request, response) {
  const {branch} = request.body;
  database_queries.addBranch(branch,request, response)
});



router.get('/api/v1/branches', function (request, response) {
  database_queries.getBranch(request, response)
});


router.put('/api/v1/branches', function (request, response) {
  const {branchid,branch} = request.body;
  database_queries.editBranch(branchid,branch,request, response)
});


router.delete('/api/v1/branches', function (request, response) {
  const {branchid} = request.body;
  database_queries.deleteBranch(branchid,request, response)
});







module.exports = router;