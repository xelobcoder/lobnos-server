const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
 destination: (req, file, cb) => {
  let extension = file.originalname.split('.');
  let accepted = ['jpeg', 'png', 'jpg'];

  if (accepted.includes(extension[1])) {
   const destinationPath = path.join(__dirname, './company');
   console.log('Destination path:', destinationPath);
   cb(null, path.join(destinationPath));
  } else {
   cb(new Error('File type jpeg, png, jpg required'));
  }
 },
 filename: (req, file, cb) => {
  const uniqueSuffix = 'companylogo' + Date.now() + path.extname(file.originalname);
  cb(null, uniqueSuffix);
 }
});

const upload = multer({ storage }).single('file');

module.exports = { upload };
