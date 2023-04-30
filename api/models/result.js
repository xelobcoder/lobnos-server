const connection = require("../db");
const util = require('util')
const beginTransaction = util.promisify(connection.beginTransaction).bind(connection);
const query = util.promisify(connection.query).bind(connection);
const db_query = require('../../api/database/queries');
const { response } = require("express");

const testTable = {
   hepatitisb: 'hepatitisBresult',
   hepatitisc: 'hepatitisC',
   bloodgrouping: 'bloodgroup',
   glycated_haemoglobin: 'glycated_haemoglobin',
   urinalysis: 'urinalysisresult',
   cardiac_enzymes: 'result_cardiac_enzymes'
}


class Result {
   constructor(billingid, testname) {
      this.billingid = billingid;
      this.testname = testname;
   }


   async isTestValid() {
      return testTable[this.testname] != undefined ? true : false;
   }

   async isResultEntered() {
      if (this.isTestValid) {
         return new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${testTable[this.testname]} WHERE billingid = ${this.billingid}`;
            connection.query(query, (err, result) => {
               if (err) {
                  reject(err);
               }
               resolve(result);
            })
         })
      }
      else {
         return 'test not recognized'
      }
   }


   async getTestResult() {
      if (this.isTestValid) {
         return new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${testTable[this.testname]} WHERE billingid = ${this.billingid}`;
            connection.query(query, (err, result) => {
               if (err) {
                  reject(err);
               }
               resolve(result);
            })
         })
      }
      else {
         return 'test not recognized'
      }
   }
   async useTransactionForResult(queryString, value, testid,response) {
      try {
         await beginTransaction();
         await query(queryString, value);
         await query(`UPDATE TEST_ASCENSION SET READY = 'true',READY_DATE = NOW() WHERE BILLINGID = ${this.billingid} AND TESTID = ?`, testid)
         connection.commit(function (err) {
            if (err) {
               connection.rollback();
               throw err;
            }
            else {
               response.send({
                  status: 'success',
                  statusCode: 200,
                  message: 'Result entered successfully'
               })
            }
         });
         return true;
      }
      catch (err) {
         console.log(err);
         connection.rollback();
         throw err;
      }
   }


   errMessage(err, response) {
      response.send({
         status: 'error',
         statusCode: 500,
         message: err.message
      })
   }
   // this function determines if a new record should be created or updated by two factors.
   // 1. test tabal avialbel 
   // 2. record for scuh billing id is absent 

   async ShouldCreateRecord() {
      let nullRecords = (await this.getTestResult()).length == 0;
      return nullRecords;
   }
   // hepatitis B and C have the same database table templates hence right if we use thr samapel
   async hepatitisBresult(records, response) {
      // this check if a template for such test exist
      const isValid = await this.isTestValid();
      // check if data with billing id exist in the db table
      const create = (await this.getTestResult()).length > 0 ? false : true;
      // destructure our object 
      const { billingid, result, patientid, scientistid, remarks } = records;
      // populate based on the method 
      if (isValid) {
         if (create) {
            const query = `INSERT INTO ${testTable[this.testname]} (
            BILLINGID,
            RESULTS,
            PATIENTID,
            SCIENTISTID,
            REMARKS
         ) VALUES (?,?,?,?,?)`;
            // connection to db to pass result

         }
         else {
            const query = `UPDATE hepatitisBresult SET results = '${result}', remarks = '${remarks}' WHERE billingid = ${billingid}`;
            connection.query(query, (err, result) => {
               if (err) {
                  response.send({
                     status: 'error',
                     statusCode: 500,
                     message: err.message
                  })
               }
               else {
                  response.send({
                     statusCode: 201,
                     message: 'record updated successfully',
                     status: 'success'
                  })
               }
            })
         }
      }
      else {
         this.errMessage({ err: 'test not found' })
      }
   }
   async BloodGroupingResult(records, response) {
      // pass an err message 
      const error = this.errMessage;
      if (await this.isTestValid()) {
         const { billingid, bloodgroup, rhesus, patientid, remarks, testid } = records;
         //insert record
         if (await this.ShouldCreateRecord()) {
            const query = `INSERT INTO BLOODGROUP (BILLINGID,BGROUP,RHESUS,PATIENTID,REMARKS) VALUES (?,?,?,?,?)`;
            let values = [billingid, bloodgroup, rhesus, patientid, remarks]
            // excute query
            await this.useTransactionForResult(query, values, testid,response)
         }
         // update record 
         else {
            const updateQuery = `UPDATE ${testTable[this.testname]}
             SET RHESUS = ?, BGROUP = ?, REMARKS = ? WHERE BILLINGID = ?`

            connection.query(updateQuery, [rhesus, bloodgroup, remarks, parseInt(billingid)], function (err, result) {
               if (err) {
                  error(err, response)
               }
               else {
                  response.send({
                     status: 'success',
                     message: 'record updated successfully',
                     statusCode: 200
                  })
               }
            })
         }
      }
      else {
         this.errMessage({ err: 'Test Not found' }, response)
      }
   }

   async glycatedHaemoglobin(record, response) {
      let errMessage = this.errMessage;
      const { billingid, patientid, glycated, glucose, method, comment, technology } = record;
      if (this.isTestValid) {
         if (await this.ShouldCreateRecord()) {
            // we create a query using the above data in order to populate the database
            const creation = `INSERT INTO  ${testTable[this.testname]} (
            BILLINGID,PATIENTID,RESULT,REMARKS,TECHNOLOGY,METHOD,GLUCOSE
         ) VALUES (?,?,?,?,?,?,?)`;

            let values = [billingid, patientid, glycated, comment, technology, method, glucose]
            // execute query
            await this.useTransactionForResult(creation, values, testid)

            // update test ascention table to update ready to true and result entered trure
         } else {
            // update the test record
            const upateRecord = `UPDATE ${testTable[this.testname]} SET RESULT = ?,
           REMARKS = ?,
           TECHNOLOGY = ?,
           METHOD= ?,
           GLUCOSE = ? 
           WHERE BILLINGID = ?`;

            connection.query(upateRecord, [glycated, comment, technology, method, glucose, this.billingid], (err, result) => {
               if (err) {
                  console.log(err)
                  errMessage(err, response)
               } else {
                  response.send({
                     status: 'success',
                     message: 'record updated successfully',
                     statusCode: 200
                  })
               }
            })
         }
      } else {
         this.errMessage({ message: 'No such test found' })
      }
   }

   async urinalysisResult(records, response) {
      let errMessage = this.errMessage;
      const {
         appearance,
         ph,
         urobilinogen,
         blood,
         color,
         leukocytes,
         microalbumin,
         ketones,
         bilirubin,
         nitrite,
         specific_gravity,
         glucose,
         billingid,
         patientid,
         testname,
         remarks,
         testid
      } = records;

      if (this.isTestValid()) {
         if (await this.ShouldCreateRecord()) {
            const insertionQuery = `INSERT INTO ${testTable[this.testname]} (
            APPEARANCE,
            KETONES,
            BILIRUBIN,
            NITRITE,
            SPECIFIC_GRAVITY,
            PH,
            UROBILINOGEN,
            BLOOD,
            COLOR,
            LEUKOCYTES,
            MICROALBUMIN,
            GLUCOSE,
            BILLINGID,
            PATIENTID,REMARKS
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

            await this.useTransactionForResult(insertionQuery, [
               appearance,
               ketones,
               bilirubin,
               nitrite,
               specific_gravity,
               ph,
               urobilinogen,
               blood,
               color,
               leukocytes,
               microalbumin,
               glucose,
               billingid,
               patientid,
               remarks
            ], testid,response)

         } else {
            // update the result using the billing id
            const updateQuery = `
               UPDATE ${testTable[testname]} SET
               APPEARANCE = ?,
               KETONES = ?,
               BILIRUBIN = ?,
               NITRITE = ?,
               SPECIFIC_GRAVITY = ?,
               PH = ?,
               UROBILINOGEN = ?,
               BLOOD = ?,
               COLOR = ?,
               LEUKOCYTES = ?,
               MICROALBUMIN = ?,
               GLUCOSE = ?,
               REMARKS = ?
               WHERE billingid = ?
            `;

            connection.query(updateQuery, [
               appearance,
               ketones,
               bilirubin,
               nitrite,
               specific_gravity,
               ph,
               urobilinogen,
               blood,
               color,
               leukocytes,
               microalbumin,
               glucose,
               remarks,
               billingid
            ], (err, result) => {
               if (err) {
                  errMessage(err, response)
               } else {
                  const { affectedRows } = result;
                  // the number of affected rows determine if a/an data insertion event occured or not
                  if (affectedRows > 0) {
                     response.send({
                        status: 'success',
                        message: 'record updated successfully',
                        statusCode: 200
                     })
                  }
                  else {
                     response.send({
                        status: 'success',
                        message: 'record not updated',
                        statusCode: 200
                     })
                  }
               }
            }
            )
         }
      } else {
         this.errMessage({ message: 'No such test found' })
      }
   }


   async cardiacEnzymes(records, response) {
      const { COMMENT, LDH, MYOGLOBIN, CK_MB, AST, TROPONIN, testid, patientid, billingid } = records;

      const queryValues = ['LDH', 'MYOGLOBIN', 'CK_MB', 'AST','TROPONIN'].map((item, index) => {
         return [
            item,
            billingid,
            records[item],
            patientid,
            COMMENT
         ]
      })

      const insertionQuery = `INSERT INTO ${testTable[this.testname]} (
         PARAMETERNAME,
         BILLINGID,
         VALUE,
         PATIENTID,
         COMMENTS
      ) VALUES ?`;

      if (await this.ShouldCreateRecord()) {
         await this.useTransactionForResult(insertionQuery, [queryValues], testid,response)
      } else {
         console.log('update')
      }
   }
}



module.exports = Result;