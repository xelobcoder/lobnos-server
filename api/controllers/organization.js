const router = require('express').Router();
const multer = require('multer')
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
 destination: (req, file, cb) => {
  let extension = file.originalname.split('.');
  let accepted = ['jpeg', 'png', 'jpg'];

  if (accepted.includes(extension[1])) {
   const destinationPath = path.join(__dirname, './organization');
   // Delete previous images in the folder
   const files = fs.readdirSync(destinationPath);
   files.forEach((file) => {
    fs.unlinkSync(path.join(destinationPath, file));
   });

   cb(null, path.join(destinationPath));
  } else {
   cb(new Error('File type jpeg, png, jpg required'));
  }
 },
 filename: (req, file, cb) => {
  const uniqueSuffix = 'companylogo' + path.extname(file.originalname);
  cb(null, uniqueSuffix);
 }
});

const upload = multer({ storage }).single('file')



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


router.post('/api/v1/new/organization/images',upload, function(request,response) {
    if (!request.file) {
    response.status(400).json({ error: 'No file uploaded' });
  } else {
    // File uploaded successfully
    response.status(200).json({ message: 'File uploaded successfully' });
  }
})


router.get('/api/v1/organization/daily', function (request, response) {
  o.dailyOrganizationCommission(request, response);
})

router.get('/api/v1/organization/monthly', function (request, response) {
  o.getOrganizationCommissionByMonth(request, response);
})


module.exports = router;