const router = require('express').Router();
const connection = require('../db')
const queries = require('../database/queries');
const { getPhelobotomy, updatePhelobotomy,postSection, get_client_query, getAscensionWithDetails } = require('../phelobotomy')


router.route('/api/v1/phelobotomy')
  .get(function (req, res) {
    if (Object.keys(req.query).length == 0) {
      getPhelobotomy(req, res);
    } else {
      if (Object.keys(req.query == 1 && req.query.billingid)) {
        get_client_query(req, res)
      }
    }
  })
  .post(function (req, res) {
    postSection(req,res);
  })
  .put(function (req, res) {
    const { clientid, content, status, alltaken, completedTime } = req.body;
    updatePhelobotomy(clientid, content, status, alltaken, completedTime, req, res);
  })
  .delete((req, res) => {
    res.status(405).send({
      statusCode: 405,
      message: `Method ${req.method} Not Allowed`
    });
  })



router.get('/api/v1/phelobotomy/ascension', function (request, response) {
  const { billingid } = request.query;
  if (billingid) {
    getAscensionWithDetails(billingid, response)
  } else {
    response.send({
      message: 'include billingid in the header as a query',
      statusCode: 401,
      status: 'error'
    })
  }
})



module.exports = router;
