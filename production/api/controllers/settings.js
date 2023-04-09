const router = require('express').Router();
const { prisma } = require('../models/supply')
const { addNewDepartment, updateDepartment, getDepartments, deleteDepartment ,getSpecificDepartment} = require('../models/settings');

router.get('/api/v1/departments', async (request, response) => {
 getDepartments(request, response)
});



router.post('/api/v1/departments', async (request, response) => {
 addNewDepartment(request, response)
});


router.delete('/api/v1/departments', async (request, response) => {
 deleteDepartment(request, response)
})


// update 
router.put('/api/v1/departments', async (request, response) => {
 updateDepartment(request, response)
})


// get a speciiic department
router.get('/api/v1/departments/:id', async (request, response) => {
  getSpecificDepartment(request, response)
})


module.exports = router;