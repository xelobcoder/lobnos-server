const router = require('express').Router();
const ResultPrint = require('../models/ResultPrint');


router.get('/api/v1/result/ready', async function(req,res) {
   new ResultPrint().get_printables(req,res)
})


module.exports = router;