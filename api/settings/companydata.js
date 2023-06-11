const connection = require("../db.js");
const path = require('path');
const fs = require('fs');

let SQL_QUERY_ALL = "SELECT * FROM companyprofile";
let SQL_QUERY_INSERT = `INSERT INTO companyprofile (NAME, EMAIL, MOTTO, PHONENUMBER, ADDRESS, WEBSITE, STREET, ALTERNATIVENUMBER) VALUES (?,?,?,?,?,?,?,?)`;


let TRUNCATE_QUERY = `TRUNCATE TABLE COMPANYPROFILE`;



const AddCompanyInfo = function (request, response) {
   const { target, name, motto, email, phonenumber, address,website,alternativeNumber,street } = request.body;

   const PARAMETERS = [name, email, motto, phonenumber, address, website, street, alternativeNumber];

   connection.query(TRUNCATE_QUERY, (err, result) => {
      if (err) { throw err };
      if (result) {
         connection.query(SQL_QUERY_INSERT, PARAMETERS, function (err, result) {
            if (err) { throw err };
            if (result) {
               if (result.affectedRows == 1) {
                  response.status(201).json({ status: 'success' })
               }
            }
         })
      }
   })
}



const getCompanyInfo = function (request, response) {
   connection.query(SQL_QUERY_ALL, function (err, result) {
      if (err) { throw err }
      if (result) {
         if (result.length > 0) {
            const obj = {};
            for (const [key, value] of Object.entries(result[0])) {
               obj[key.toLowerCase()] = value
            }
            response.send(obj)
         } else {
            response.send([])
         }
      }
   })
}



const getCompanyImage = async function (request, response) {
   try {
     const folderPath = path.join(__dirname, 'company'); // Replace 'company' with the actual folder name
 
     // Read the files in the folder
     const files = fs.readdirSync(folderPath);
 
     // Find the first image file
     const imageFile = files.find(file => {
       const fileExtension = path.extname(file).toLowerCase();
       return ['.jpg', '.jpeg', '.png', '.gif'].includes(fileExtension);
     });
 
     if (imageFile) {
       const imagePath = path.join(folderPath, imageFile);
 
       // Read the image file using fs.readFileSync
       const image = fs.readFileSync(imagePath);
 
       // Set the response headers
       response.setHeader('Content-Type', 'image/jpeg'); // Replace 'image/jpeg' with the appropriate image MIME type
       response.setHeader('Content-Length', image.length);
 
       // Send the image file as the response
       response.send(image);
     } else {
       response.status(404).send('Image not found');
     }
   } catch (error) {
     console.error('Error reading company image:', error);
     response.status(500).send('Internal Server Error');
   }
 };


module.exports = {
   getCompanyInfo,
   AddCompanyInfo,
   getCompanyImage
}


// const imagesretainer = function (res) {
//    let turn = path.join(
//       "C:/Users/leonides/Documents/GitHub/image-r-v/lobnos",
//       "./public/asserts/companylogo.jpg"
//    );
//    fs.createReadStream(turn).pipe(res);
// };


