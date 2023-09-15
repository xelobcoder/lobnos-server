const {
  getClinicians,
  putCliniciansbasic,
  deleteClinicians, getSingleClinician,
  postClinicianBasicInfo,
  getTopPerformingClinicians
} = require('../../api/clinicians')

const router = require('express').Router();

router.get('/api/v1/clinicians', async (req, res) => {
  const { id } = req.query;
  if (id) {
    getSingleClinician(req, res);
  }
  else {
    getClinicians(req, res);
  }
});

router.put('/api/v1/clinicians', async (req, res) => {
  putCliniciansbasic(req, res);
});

router.delete('/api/v1/clinicians', async (req, res) => {
  deleteClinicians(req, res);
});

router.post('/api/v1/clinicians', async (req, res) => {
  postClinicianBasicInfo(req, res);
});

router.get('/api/v1/clinician/performance/top', function(request,response) {
  getTopPerformingClinicians(request,response)
})



module.exports = router;