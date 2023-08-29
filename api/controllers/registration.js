const router = require('express').Router();
const Registration = require('../models/registration');


router.get("/api/v1/register", (request, response) => {
 
});

router.post("/api/v1/register", (request, response) => {
  const register = new Registration();
  register.addNewPatient(request, response)
});

router.put('/api/v1/register', (request, response) => {
  putpatient(request, response);
})


router.get('/api/v1/register/registration/settings', async (request, response) => {
  const settings = await (new Registration().isBulkRegistration());
  response.send({
    status: "success",
    message: "settings retrieved successfully",
    statusCode: 200,
    bulkRegistration: settings
  });
})


module.exports = router;