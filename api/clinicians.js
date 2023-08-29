const { response } = require('express');
const connection = require('./db');


// get all clinicians
const getClinicians = (req, res) => {
   let query = 'SELECT * FROM clinician';
   // execute query
   connection.query(query, (err, result) => {
      if (err) {
         throw err
      }
      res.send(result)
   })
}

// update clinicians
const putClinicians = (req, res) => {
   //     we update the query 
   const { name, phone, email, location, address, module, occupation,
      commission, momo, bankName, accountName, branch, account, id } = req.body;

   // check if id exist 
   let check = `SELECT * FROM clinician WHERE ID = ?`;
   // update query

   let query = `UPDATE clinician SET NAME = ?, PHONE = ?, EMAIL = ?, LOCATION = ?,
     ADDRESS = ?, MODULE = ?, COMMISSION = ?, MOMO = ?, BANKNAME = ?, ACCOUNTNAME = ?, 
     BANKBRANCH = ?, ACCOUNTNUMBER = ?,OCCUPATION = ? WHERE ID = ?`;


   const values = [name, phone, email, location, address, module, commission,
      momo, bankName, accountName, branch, account, occupation, id];

   // execute query
   // is id available, if yes continue or send response with message of no id

   if (id) {
      connection.query(check, [id], (err, result) => {
         if (err) {
            throw err
         }
         if (result.length > 0) {
            connection.query(query, values, (err, result) => {
               if (err) {
                  throw err
               }
               if (result) {
                  const { affectedRows } = result;
                  if (affectedRows > 0) {
                     res.send({
                        statusCode: 200,
                        message: 'Clinician updated successfully'
                     })
                  } else {
                     res.send({
                        statusCode: 401,
                        message: 'Clinician not updated'
                     })
                  }
               }
            })
         }
      })
   } else {
      res.send({
         statusCode: 401,
         message: 'clinician id not included'
      })
   }
}


// delete clinician

const deleteClinicians = (req, res) => {
   const { id } = req.body;
   let query = `DELETE FROM clinician WHERE ID = ?`;
   // execute query
   connection.query(query, [id], (err, result) => {
      if (err) {
         throw err
      }
      else {
         const { affectedRows } = result;
         if (affectedRows == 1) {
            res.send({
               statusCode: 200,
               status: 'success',
               message: 'Deleted successfully'
            })
         } else {
            res.send({
               statusCode: 500,
               status: 'error',
               message: 'something occured. Wrong ID provided'
            })
         }
      }

   }
   )
}


const postClinicians = (req, res) => {
   const { id, name, phone, email, location, address, module, occupation, commission, momo, bankName, accountName, branch, account } = req.body;


   //  we insert into the database
   let query = `INSERT INTO clinician 
            (NAME,PHONE,EMAIL,LOCATION,ADDRESS,MODULE,COMMISSION,MOMO,BANKNAME,ACCOUNTNAME,
            BANKBRANCH,ACCOUNTNUMBER,OCCUPATION) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`;

   const values = [name, phone, email, location, address, module, commission,
      momo, bankName, accountName, branch, account, occupation];
   // we chrck if the email already exist
   let check = `SELECT * FROM clinician WHERE EMAIL = ?`;

   // We check if number is valid and not more than 10 and begins with 0

   const isValidNumber = (number) => {
      if (number.length === 10 && number.startsWith('0')) {
         return true
      }
   }


   if (isValidNumber(phone) && email.includes('@')) {
      // execute query
      connection.query(check, email, (err, result) => {
         if (err) {
            throw err
         }
         if (result.length > 0) {
            // if id is provided and userexist we update the info
            //  else we send already exist message 
            if (id) {
               putClinicians(req, res);
            } else {
               res.send({
                  message: 'clinician with such email already exist',
                  statusCode: 200
               })
            }
         }
         else {
            // insert into the database
            connection.query(query, values, (err, result) => {
               if (err) {
                  throw err
               }
               res.send({
                  message: 'Clinician added successfully',
                  statusCode: 200
               })
            }
            )
         }
      })
   } else {
      res.send({
         message: 'Invalid phone number or email',
         statusCode: 400
      })
   }
}




const getSingleClinician = (req, res) => {
   const { id } = req.query;
   // get the id 
   let query = `SELECT * FROM clinician WHERE ID = ?`;
   // execute query
   connection.query(query, [id], (err, result) => {
      if (err) {
         throw err
      }
      res.send(result)
   }
   )
}



const getTopPerformingClinicians = async function (request, response) {
   const { count } = request.query;


   if (!count) {
      response.send({
         message: 'count represent top count required',
         statusCode: 401,
         status: 'warning'
      })
   } else {
      let query_string = `
         SELECT DISTINCT c.ID AS id,
                  c.NAME AS name,
                  c.COMMISSION AS commissionRate,
                  c.COMMISSION / 100 * (
                  SELECT SUM(b.PAYABLE)
                  WHERE c.ID = c.ID
         ) AS commissionEarned,
            SUM(b.payable) AS TotalSales
         FROM clinician AS c
            INNER JOIN BILLING AS b ON b.CLINICIAN = c.ID
         GROUP BY c.ID,
            c.NAME ORDER BY TotalSales DESC
      `;

      query_string += ` LIMIT ${count}`


      connection.query(query_string, function (err, result) {
         if (err) {
            response.send({
               message: err.message,
               statusCode: 500,
               status: 'error'
            })
         } else {
            response.send({
               result,
               statusCode: 200,
               status: 'success'
            })
         }
      })
   }
}

module.exports = {
   getClinicians,
   putClinicians,
   deleteClinicians,
   postClinicians,
   getSingleClinician,
   getTopPerformingClinicians
}