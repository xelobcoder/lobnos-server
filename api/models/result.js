const connection = require("../db");
const db_query = require('../../api/database/queries');
const { response } = require("express");

const testTable = {
   hepatitisb: 'hepatitisBresult',
   hepatitisc: 'hepatitisC',
   bloodgrouping: 'bloodgroup',
   glycated_haemoglobin: 'glycated_haemoglobin',
   urinalysis: 'urinalysisresult',
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
   async setResultReady(connection, billingid, testid) {
      // get all test from test_ascension where billing id is equal to billing id
      const query = `UPDATE test_ascension SET READY ='true',
      ready_date = NOW()
      WHERE billingid = ${billingid} AND testid = ${testid}`;

      connection.query(query, (err, result) => {
         if (err) {
            connection.rollback();
         }
      })
   }


   async commitQuery(connection, response) {
      // connection represent the connection object commit function
      connection.commit(
         (err) => {
            if (err) {
               connection.rollback();
               errMessage(err, response)
            } else {
               response.send({
                  status: 'success',
                  message: 'record created successfully',
                  statusCode: 200
               })
            }
         }
      )
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
            connection.query(query, [billingid, result, patientid, scientistid, remarks], function (err, result) {
               console.log(err)
               if (err) {
                  response.send({
                     status: 'error',
                     statusCode: 500,
                     message: err.message
                  })
               }
               // response to client side
               else {
                  response.send({
                     statusCode: 201,
                     message: 'record created successfully',
                     status: 'success'
                  })
               }
            })
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
            // excute query
            connection.beginTransaction(
               connection.query(query, [billingid, bloodgroup, rhesus, patientid, remarks], function (err, result) {
                  if (err) {
                     connection.rollback();
                  }
               }
               ),
               this.setResultReady(connection, billingid, testid),
               this.commitQuery(connection, response)
            )
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
            // execute query
            connection.beginTransaction(
               connection.query(creation, [billingid, patientid, glycated, comment, technology, method, glucose], function (err, result) {
                  if (err) {
                     connection.rollback();
                  }
               }),
               function (err, connection) {
                  if (err) {
                     connection.rollback();
                     errMessage(err, response)
                  }
                  else {
                     connection.commit();
                     response.send({
                        status: 'success',
                        message: 'record created successfully',
                        statusCode: 200
                     })

                  }
               }
            )

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

      if (await this.isTestValid()) {
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


            connection.beginTransaction(
               connection.query(insertionQuery,
                  [
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
                  ],
                  function (err, result) {
                     if (err) {
                        connection.rollback();
                     }
                  }),
               await this.setResultReady(connection, billingid, testid),
               await this.commitQuery(connection, response)
            )


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
}



module.exports = Result;