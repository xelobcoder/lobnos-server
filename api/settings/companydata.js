const connection = require("../db.js");

let SQL_QUERY_ALL = "SELECT * FROM companyprofile";
let SQL_QUERY_INSERT = `INSERT INTO companyprofile (NAME,EMAIL,MOTTO,PHONENUMBER,ADDRESS) VALUES (?,?,?,?,?)`;

let TRUNCATE_QUERY = `TRUNCATE TABLE COMPANYPROFILE`;



const AddCompanyInfo = function (request, response) {
   const { target, name, motto, email, phonenumber, address } = request.body;
   const PARAMETERS = [name, email, motto, phonenumber, address];

   connection.query(TRUNCATE_QUERY, (err, result) => {
      if (err) { throw err };
      if (result) {
         connection.query(SQL_QUERY_INSERT, PARAMETERS, function (err, result) {
            if (err) { throw err };
            if (result) {
              if (result.affectedRows == 1) {
               response.status(201).json({status:'success'})
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





module.exports = {
   getCompanyInfo,
   AddCompanyInfo
}


// const imagesretainer = function (res) {
//    let turn = path.join(
//       "C:/Users/leonides/Documents/GitHub/image-r-v/lobnos",
//       "./public/asserts/companylogo.jpg"
//    );
//    fs.createReadStream(turn).pipe(res);
// };


