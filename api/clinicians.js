const { response } = require('express');
const connection = require('./db');
const logger = require('../logger');
const { convertKeysToLowerCase, promisifyQuery } = require('../helper');
const { parse } = require('dotenv');


// get all clinicians
const getClinicians = async (req, res) => {
   try {
      let result = await promisifyQuery('SELECT * FROM clinicianbasicinfo');
      result = result.length > 0 ?
         result.map(item => convertKeysToLowerCase(item)) : result;
      res.send({ statusCode: 200, status: 'success', result });
   } catch (err) {
      logger.error(err);
   }
}

// update clinicians
const putCliniciansbasic = (req, res) => {
   //     we update the query 
   const { name, phone, email, location, address, module, occupation,
      commission, momo, bankName, accountName, branch, account, id } = req.body;

   // check if id exist 
   let check = `SELECT * FROM clinicianbasicinfo WHERE ID = ?`;
   // update query

   let query = `UPDATE clinicianbasicinfo SET NAME = ?, PHONE = ?, EMAIL = ?, LOCATION = ?,
     ADDRESS = ?,OCCUPATION = ? WHERE ID = ?`;


   const values = [name, phone, email, location, address, occupation, id];

   // execute query
   // is id available, if yes continue or send response with message of no id

   if (id) {
      connection.query(check, [id], (err, result) => {
         if (err) {
            logger.error(err)
         }
         if (result.length > 0) {
            connection.query(query, values, (err, result) => {
               if (err) {
                  logger.error(err)
               }
               if (result) {
                  const { affectedRows } = result;
                  if (affectedRows > 0) {
                     res.send({
                        statusCode: 200,
                        message: 'Clinician updated successfully',
                        status: 'success'
                     })
                  } else {
                     res.send({
                        statusCode: 401,
                        message: 'Clinician not updated',
                     })
                     connection.end()
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
         logger.error(err)
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


const postClinicianBasicInfo = (req, res) => {
   const { id, name, phone, email, location, address, occupation } = req.body;

   // module, occupation, commission, momo, bankName, accountName, branch, account

   //  we insert into the database
   let query = `INSERT INTO clinicianbasicinfo 
            (NAME,PHONE,EMAIL,LOCATION,ADDRESS,
            OCCUPATION) 
            VALUES (?,?,?,?,?,?)`;

   const values = [name, phone, email, location, address, occupation];
   // we chrck if the email already exist
   let check = `SELECT * FROM clinicianbasicinfo WHERE EMAIL = ?`;

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
            logger.error(err)
         }
         if (result.length > 0) {
            // if id is provided and userexist we update the info
            //  else we send already exist message 
            if (id) {
               putCliniciansbasic(req, res);
            } else {
               res.send({
                  message: 'clinician with such email already exist',
                  statusCode: 200,
                  status: 'success'
               })
            }
         }
         else {
            // insert into the database
            connection.query(query, values, (err, result) => {
               if (err) {
                  logger.error(err)
               }
               res.send({
                  message: 'Clinician added successfully',
                  statusCode: 200,
                  status: 'success'
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
   let query = `SELECT * FROM clinicianbasicinfo WHERE ID = ?`;
   // execute query
   connection.query(query, [id], (err, result) => {
      if (err) {
         logger.error(err)
      }
      res.send({
         statusCode: 200,
         result,
         status: 'success'
      })
   }
   )
}



/**
 * Retrieves the top performing clinicians based on their total sales.
 * 
 * @param {object} request - The request object containing the query parameters.
 * @param {object} response - The response object used to send the result back to the client.
 * @returns {void}
 */
const getTopPerformingClinicians = async function (request, response) {
   const { count } = request.query;

   // Check if count parameter is provided
   if (!count) {
      response.send({
         message: 'count represent top count required',
         statusCode: 401,
         status: 'warning'
      });
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

      query_string += ` LIMIT ${count}`;

      // Execute the SQL query
      connection.query(query_string, function (err, result) {
         if (err) {
            // Send error response if query execution fails
            response.send({
               message: err.message,
               statusCode: 500,
               status: 'error'
            });
         } else {
            // Send success response with the result
            response.send({
               result,
               statusCode: 200,
               status: 'success'
            });
         }
      });
   }
};

var CLINICIAN_QUERY_SUM = `SELECT 
b.billingid,
np.patientid,
tp.name,
tt.testid,
tt.approvalStatus AS approval,
tt.collection,
tt.ready,
tt.processing,
np.firstname,
np.lastname,
np.middlename,
b.clinician,
b.billedon
FROM test_ascension AS tt INNER JOIN billing AS b ON tt.billingid = b.billingid
INNER JOIN new_patients AS np ON np.patientid = b.patientid INNER JOIN test_panels AS tp ON tp.ID = tt.testid
WHERE b.clinician = ?`

const getClinicianResult = async function (clinicianid, startdate, enddate) {
   try {
      let query = CLINICIAN_QUERY_SUM;

      let values = [parseInt(clinicianid)];

      if (startdate && enddate) {
         query+= ` AND DATE(b.billedon) BETWEEN ? AND ?`;
         values.push(startdate);
         values.push(enddate);
      } else {
         query+= ` AND DATE(b.billedon) = DATE(CURRENT_DATE) ORDER BY b.billedon DESC`;
      }

      let result = await promisifyQuery(query, values);

      // get unique billingid

      let unique = [...new Set(result.map(item => item.billingid))];

      let transformed = [];

      for (let i = 0; i < unique.length; i++) { 
         let current_filtered = result.filter(item => item.billingid === unique[i]);
         let obj = {};
         obj.billingid = unique[i];
         obj.fullname = current_filtered[0]?.firstname + " " + current_filtered[0]?.middlename + " " + current_filtered[0]?.lastname;
         obj.billingdate = current_filtered[0]?.billedon;
         let ready_count = current_filtered.filter(item => item.ready === 'true').length;
         obj.ready_count = ready_count;
         obj.totaltest = current_filtered.length;

         transformed.push(obj);
      }

      return transformed;
   }
   catch (error) {
      logger.error(error);
   }
}


const getBillingTestBasedByClinician = async function (billingid, clinicianid) {
   const query = CLINICIAN_QUERY_SUM + ` AND b.billingid = ?`;
   const result = await promisifyQuery(query, [clinicianid, billingid]);
   return result;
}


module.exports = {
   getClinicians,
   putCliniciansbasic,
   deleteClinicians,
   postClinicianBasicInfo,
   getSingleClinician,
   getTopPerformingClinicians,
   getClinicianResult,
   getBillingTestBasedByClinician
}