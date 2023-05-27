const router = require('express').Router();
const ResultPrint = require('../models/ResultPrint');


router.get('/api/v1/result/ready', async function(req,res) {
   new ResultPrint().get_printables(req,res)
})


router.get('/api/v1/result/ready/:id' , async(req,res) => {
   const billingid = parseInt(req.params.id.slice(1));
   new ResultPrint().get_extrainfo_test(billingid,req,res)
})


router.get('/api/v1/result/ready/crm/summary',  (req,res) => {
   new ResultPrint().get_summary_ready_page(req,res)
})


module.exports = router;