const connection = require("../db");
const db_query = require('../../api/database/queries');
const { response } = require("express");
const testTable = {
   hepatitisb: 'hepatitisBresult',
   hepatitisc: 'hepatitisC',
   bloodgrouping: 'bloodgroup',
   glycated_haemoglobin: 'glycated_haemoglobin'

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
         const { billingid, bloodgroup, rhesus, patientid, remarks } = records;
         //insert record
         if (await this.ShouldCreateRecord()) {
            const query = `INSERT INTO BLOODGROUP (BILLINGID,BGROUP,RHESUS,PATIENTID,REMARKS) VALUES (?,?,?,?,?)`;
            // excute query
            connection.query(query, [billingid, bloodgroup, rhesus, patientid, remarks], function (err, result) {
               if (err) {
                  error(err, response)
               }
               else {
                  response.send({
                     status: 'success',
                     message: 'record created successfully',
                     statusCode: 200
                  })
               }
            })
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
            connection.query(creation, [billingid, patientid, glycated, comment, technology, method, glucose], function (err, result) {
               if (err) {
                  errMessage(err, response)
               }
               else {
                  response.send({
                     status: 'success',
                     message: 'record created successfully',
                     statusCode: 200
                  })
               }
            })
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
                  errMessage(err,response)
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
}



module.exports = Result;