const connection = require("../db");
const util = require("util");
const beginTransaction = util
  .promisify(connection.beginTransaction)
  .bind(connection);
const query = util.promisify(connection.query).bind(connection);
const operations = require('../models/operations');
const { customError, promisifyQuery, getFullBloodCountTrend } = require("../../helper");
const logger = require("../../logger");
const { testTable, PDF_QUERIES, setups } = require('../../helpers/testtables');
const { testCategoryMapping } = require("./ResultQueryMapping");
const { category_determiner } = require("../test/setup/fbc");
const Patient = require("./patientAnalytics");
const Registration = require("./registration");



class Result {
  constructor(billingid, testname) {
    this.billingid = billingid;
    this.testname = testname;
  }

  isApprovalSetTrue() {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM applicationsettings`;

      connection.query(query, (err, result) => {
        if (err) { reject(err) }
        else {
          if (result.length > 0) {
            const approval_status = result[0]['approvalbeforeprinting'];
            approval_status == 0 ? resolve(false) : resolve(true)
          } else {
            resolve(null)
          }
        }
      })
    })
  }

  isTestValid() {
    return testTable[this.testname] != undefined ? true : false;
  }

  async isResultEntered(testid) {
    if (this.isTestValid() && this.testname in testCategoryMapping) {
      try {
        let result = null;
        let entered = false;
        const category = testCategoryMapping[this.testname];
        switch (category) {
          case 'fbc':
            const getPatientid = await promisifyQuery(`SELECT patientid FROM billing WHERE billingid = ?`, this.billingid);
            // get result joined with the category of client full blood count e.g male,female,childred
            const patientid = getPatientid.length > 0 ? getPatientid[0]['patientid'] : null;
            result = await getFullBloodCountTrend(patientid);
            entered = result.length > 0 ? true : false;
            if (result.length === 0) {
              const getCategory = await category_determiner('filling', patientid);
              result = await promisifyQuery(`SELECT * FROM ${getCategory}`);
              result = result.length > 0 ? result.map(item => { return { ...item, value: 0 } }) : [];
            }
            break;

          case 'hema':
            let query = `SELECT * FROM ${testTable[this.testname]} WHERE billingid = ?`;
            result = await promisifyQuery(query, this.billingid);
            entered = result.length > 0 ? true : false;
            break;

          case 'chemistry':
            const setup = setups[this.testname];
            const resultTable = testTable[this.testname];
            result = await promisifyQuery(PDF_QUERIES.chemistryQ(resultTable, setup, this.billingid))
            entered = result.length > 0 ? true : false;
            if (result.length === 0) {
              result = await promisifyQuery(`SELECT * FROM ${setup}`);
              result = result.length > 0 ? result.map(item => { return { ...item, value: 0 } }) : [];
            }
            break;

          case 'endocrinology':
            const getPatientInfo = await new Registration().getPatientInfoUsingBillingId(this.billingid);
            const gender = getPatientInfo.length > 0 ? getPatientInfo[0]['gender'] : null;
            result = await promisifyQuery(PDF_QUERIES.endrinologyQ(testTable[this.testname], setups[this.testname], this.billingid, gender));
            entered = result.length > 0 ? true : false;
            if (result.length === 0) {
              result = await promisifyQuery(`SELECT * FROM ${setups[this.testname]} WHERE gender = ?`, gender);
              result = result.length > 0 ? result.map(item => { return { ...item, value: 0 } }) : [];
            }
            break;
          
          case 'glucose':
            const glucoseTable = testTable[this.testname];
            const setupTable = setups[this.testname];
            result = await promisifyQuery(PDF_QUERIES.glucoseQ(this.testname, glucoseTable, setupTable),[this.billingid]);
            entered = result.length > 0 ? true : false;
            if (result.length === 0) {
              result = await promisifyQuery(`SELECT * FROM ${setupTable}`);
              result = result.length > 0 ? result.map(item => { return { ...item, value: 0 } }) : [];
            }
            break;
          default:
            break;
        }
        return {result,entered }
      } catch (err) {
        logger.error(err);
        console.log(err)
        return err;
      }
    } else {
      logger.error('Test not recognized or scripted for!!');
      throw new Error('Test not recognized or scripted for!!')
    }
  }




  async getTestResult(testid) {
    try {
      let query = `SELECT * FROM ${testTable[this.testname]} WHERE billingid = ${this.billingid}`;
      if (this.testname === 'scan' && testid) {
        query += ` AND testid=${testid}`
      }
      return this.isTestValid() ? await promisifyQuery(query) : 'test not recognized';
    } catch (err) {
      logger.error(err);
    }
  }

  pushResponse(result, response) {
    const { affectedRows } = result;
    if (affectedRows > 0) {
      response.send({
        status: "success",
        message: "record updated successfully",
        statusCode: 200,
      });
    } else {
      response.send({
        status: "success",
        message: "No record updated",
        statusCode: 401,
      });
    }
  }
  async useTransactionForResult(queryString, value, testid, response, comments) {
    try {
      let ascensionQuery = `UPDATE test_ascension SET ready = 'true', ready_date = NOW()`

      const isApprovalTrue = await this.isApprovalSetTrue();
      if (isApprovalTrue === false) {
        ascensionQuery += `,ApprovalStatus = 1`
      }
      ascensionQuery += ` WHERE billingid = ${this.billingid} AND testid = ?`
      await beginTransaction();
      await query(queryString, value);
      await query(
        ascensionQuery,
        testid
      );
      // await query(`INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`,[testid,this.billingid,comments])

      if (arguments[4] != undefined) {
        await query(`INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`, [testid, this.billingid, comments]);
      }
      connection.commit(function (err) {
        if (err) {
          connection.rollback();
          logger.error(err);
        } else {
          response.send({ status: "success", statusCode: 200, message: "Result entered successfully" });
        }
      });
    } catch (err) {
      connection.rollback();
      logger.error(err);
    }
  }

  errMessage(err, response) {
    response.send({
      status: "error",
      statusCode: 500,
      message: err.message,
    });
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
    // destructure our object
    const { billingid, result, patientid, scientistid, testid, remarks } = records;
    // this check if a template for such test exist
    const isValid = this.isTestValid();
    // check if data with billing id exist in the db table
    const create = (await this.getTestResult(billingid)).length > 0 ? false : true;

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
          if (err) {

            response.send({
              status: "error",
              statusCode: 500,
              message: err.message,
            });
          } else {
            const ops = new operations().initiateReady(testid, billingid);

            ops.then((initiated) => {
              if (initiated) {
                response.send({
                  statusCode: 201,
                  message: "record inserted successfully",
                  status: "success",
                });
              }
            }).catch((err) => console.log(err))

          }
        })

      } else {
        const query = `UPDATE hepatitisBresult SET results = '${result}', remarks = '${remarks}' WHERE billingid = ${billingid}`;
        connection.query(query, (err, result) => {
          if (err) {
            response.send({
              status: "error",
              statusCode: 500,
              message: err.message,
            });
          } else {
            response.send({
              statusCode: 201,
              message: "record updated successfully",
              status: "success",
            });
          }
        });
      }
    } else {
      this.errMessage({ err: "test not found" });
    }
  }

  async stoolAnalysis(records,response) {
    try {
      if (this.isTestValid()) {
        const { data, testid, billingid, patientid, comments,employeeid } = records;
        const result = JSON.stringify(data);
        if (await this.ShouldCreateRecord()) {
          const query = `INSERT INTO stoolanalysisResult(billingid,patientid,results,comments,employeeid) VALUES (?,?,?,?,?)`;
          
          const values = [billingid, patientid, result, comments, employeeid];
    
          await this.useTransactionForResult(query, values, testid, response);
        } else {
          const updateQuery = `UPDATE stoolanalysisResult SET results = ?, comments = ? WHERE billingid = ?`;
          const values = [result, comments, billingid];
    
          const updateResult = await promisifyQuery(updateQuery, values);
    
          this.pushResponse(updateResult, response);
    
        }
      } else {
        customError('test not found', 404, response);
      }
   } catch(err) {
      logger.error(err);
      console.log(err)
     customError('error occured', 500, response);
   }
  }
  async BloodGroupingResult(records, response) {
    // pass an err message
    const error = this.errMessage;
    if (this.isTestValid()) {
      const { billingid, bloodgroup, rhesus, patientid, remarks, testid } =
        records;
      //insert record
      if (await this.ShouldCreateRecord()) {
        const query = `INSERT INTO BLOODGROUP (BILLINGID,BGROUP,RHESUS,PATIENTID,REMARKS) VALUES (?,?,?,?,?)`;
        let values = [billingid, bloodgroup, rhesus, patientid, remarks];
        // excute query
        await this.useTransactionForResult(
          query,
          values,
          testid,
          response,
          remarks
        );
      }
      // update record
      else {
        const updateQuery = `UPDATE ${testTable[this.testname]}
             SET RHESUS = ?, BGROUP = ?, REMARKS = ? WHERE BILLINGID = ?`;

        connection.query(
          updateQuery,
          [rhesus, bloodgroup, remarks, parseInt(billingid)],
          function (err, result) {
            if (err) {
              error(err, response);
            } else {
              response.send({
                status: "success",
                message: "record updated successfully",
                statusCode: 200,
              });
            }
          }
        );
      }
    } else {
      this.errMessage({ err: "Test Not found" }, response);
    }
  }

  async glycatedHaemoglobin(record, response) {
    const { billingid, patientid, comments, result, glucose, testid } = record;
    if (this.isTestValid) {
      if (await this.ShouldCreateRecord()) {
        // we create a query using the above data in order to populate the database
        const insertQuery = `INSERT INTO  ${testTable[this.testname]} (billingid,comments,glucose,result,patientid)
         VALUES (?,?,?,?,?)`;
        let values = [billingid, comments, glucose, result, patientid];
        // execute query
        await this.useTransactionForResult(insertQuery, values, testid, response);
        // update test ascention table to update ready to true and result entered trure
      } else {
        // update the test record
        const upateRecord = `UPDATE ${testTable[this.testname]} SET result = ?,
           comments = ?,
           glucose = ?
           WHERE billingid  = ?`;
        const isUpdated = await promisifyQuery(upateRecord, [result, comments, glucose, this.billingid]);
        if (isUpdated?.affectedRows > 0) {
          response.send({ statusCode: 200, status: 'success', message: 'record updated successfully' })
        } else {
          customError('updates failed', 500, response);
        }
      }
    } else {
      this.errMessage({ message: "No such test found" });
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
      testid,
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

        await this.useTransactionForResult(
          insertionQuery,
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
            remarks,
          ],
          testid,
          response
        );
      } else {
        // update the result using the billing id
        const updateQuery = ` UPDATE ${testTable[testname]} SET APPEARANCE = ?, KETONES = ?, BILIRUBIN = ?, NITRITE = ?,
         SPECIFIC_GRAVITY = ?, PH = ?, UROBILINOGEN = ?, BLOOD = ?, COLOR = ?, LEUKOCYTES = ?, MICROALBUMIN = ?, 
         GLUCOSE = ?, REMARKS = ? WHERE billingid = ?
            `;

        connection.query(updateQuery, [appearance, ketones, bilirubin, nitrite, specific_gravity, ph, urobilinogen, blood, color, leukocytes, microalbumin,
          glucose, remarks, billingid,],
          (err, result) => {
            if (err) {
              errMessage(err, response);
            } else {
              const { affectedRows } = result;
              // the number of affected rows determine if a/an data insertion event occured or not
              if (affectedRows > 0) {
                response.send({
                  status: "success",
                  message: "record updated successfully",
                  statusCode: 200,
                });
              } else {
                response.send({
                  status: "success",
                  message: "record not updated",
                  statusCode: 200,
                });
              }
            }
          }
        );
      }
    } else {
      this.errMessage({ message: "No such test found" });
    }
  }


  async pregnancyTest(records, response) {
    const {
      method,
      value,
      testname,
      patientid,
      billingid,
      testid,
      employeeid,
      comments,
    } = records;

    const queryString = `INSERT INTO ${testTable[this.testname]} (
         METHOD,
         VALUE,
         PATIENTID,
         BILLINGID,
         COMMENTS,
         employeeid,
         TESTID
      ) VALUE(?,?,?,?,?,?,?)`;

    if (await this.ShouldCreateRecord()) {
      await this.useTransactionForResult(
        queryString,
        [method, value, patientid, billingid, comments,employeeid, testid],
        testid,
        response
      );
    } else {
      let messageLog = this.errMessage;
      const queryString = `UPDATE ${testTable[testname]} 
         SET METHOD = ?,
         VALUE = ?,
         COMMENTS = ?,employeeid = ?
         WHERE BILLINGID = ${this.billingid} AND TESTID = ?`;
      const Values = [method, value, comments,employeeid, testid];

      connection.query(queryString, Values, (err, result) => {
        if (err) {
          console.log(err);
          messageLog(err, response);
        }

        if (result) {
          if (result.affectedRows > 0) {
            response.send({
              status: "success",
              message: "record updated successfully",
              statusCode: 200,
            });
          } else {
            response.send({
              status: "success",
              message: "No record updated",
              statusCode: 401,
            });
          }
        }
      });
    }
  }

  async malaria(records, response) {
    const {
      testname,
      testid,
      patientid,
      billingid,
      species,
      number,
      comments,
    } = records;
    // if test is a valid test
    if (this.isTestValid) {
      if (await this.ShouldCreateRecord()) {
        const malariaQuery = `INSERT INTO ${testTable[testname]} 
               (PARASITENUMBER,SPECIES,COMMENTS,BILLINGID,PATIENTID) VALUES (?,?,?,?,?)
               `;
        // using transaction to execute multiple query
        await this.useTransactionForResult(
          malariaQuery,
          [number, species, comments, billingid, patientid],
          testid,
          response
        );
      } else {
        // update the result
        const updateQuery = `UPDATE ${testTable[testname]}
             SET PARASITENUMBER = ?,
             SPECIES = ?,
             COMMENTS = ?,
             UPDATED_ON = NOW()
             WHERE BILLINGID = ?
            `;
        connection.query(
          updateQuery,
          [number, species, comments, billingid],
          (err, result) => {
            if (err) {
              this.errMessage(err, response);
            }
            if (result) {
              this.pushResponse(result, response);
            }
          }
        );
      }
    }
  }

  async liverfunctionTest(requestBody, response) {
    const { testname, billingid, testid, patientid, records, comments } = requestBody;
    if (this.isTestValid()) {
      try {
        if (await this.ShouldCreateRecord()) {
          const insertionQuery = `INSERT INTO ${testTable[testname]} (parameter,unit,value,billingid,patientid) VALUES ?`;
          const mappedValues = records.map((item, index) => {
            return [item.parameter, item.unit, parseInt(item.value), billingid, patientid];
          });
          await this.useTransactionForResult(insertionQuery, [mappedValues], testid, response, comments);
        } else {
          const pushCommentsQuery = `UPDATE result_comments SET COMMENTS = ? WHERE BILLINGID = ? AND TESTID = ?`;
          const updateQuery = `UPDATE ${testTable[testname]} SET value = ?, unit = ? WHERE billingid = ? AND parameter = ?`;
          records.forEach(async (item, index) => {
            const { value, unit, parameter } = item;
            await promisifyQuery(updateQuery, [value, unit, billingid, parameter]);
            if (index == records.length - 1) {
              const result = await promisifyQuery(pushCommentsQuery, [comments, billingid, testid]);
              this.pushResponse(result, response)
            }
          });
        }
      } catch (err) {
        logger.error(err);
      }
    } else {
      customError('test not found', 404, response);
    }
  }

  async widal(records, response) {
    const {
      TYPHIO,
      TYPHIH,
      PARATYPHIBH,
      PARATYPHIAH,
      testname,
      billingid,
      testid,
      COMMENTS,
      patientid,
    } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `
         INSERT INTO ${testTable[testname]} (TYPHIO,TYPHIH,PARATYPHIAH,PARATYPHIBH,BILLINGID,PATIENTID,COMMENTS) VALUES (?,?,?,?,?,?,?)
            `;
        const values = [
          TYPHIO,
          TYPHIH,
          PARATYPHIAH,
          PARATYPHIBH,
          this.billingid,
          patientid,
          COMMENTS,
        ];

        await this.useTransactionForResult(
          insertionQuery,
          values,
          testid,
          response
        );
      } else {
        const updateQuery = `UPDATE ${testTable[testname]} 
SET TYPHIO = ? ,TYPHIH = ? ,PARATYPHIAH = ? ,PARATYPHIBH = ?,COMMENTS = ? , UPDATED_ON = NOW() WHERE BILLINGID = ?`;

        const values = [
          TYPHIO,
          TYPHIH,
          PARATYPHIAH,
          PARATYPHIBH,
          COMMENTS,
          this.billingid,
        ];

        connection.query(updateQuery, values, (err, result) => {
          if (err) {
            console.log(err);
          }
          if (result) {
            this.pushResponse(result, response);
          }
        });
      }
    }
  }

  async hepatitisBProfile(records, response) {
    const {
      HBsAg,
      HBsAb,
      HBeAg,
      HBeAb,
      HBcAb,
      testname,
      testid,
      patientid,
      comments,
      billingid,
      employeeid
    } = records;

    if (this.isTestValid) {
      let pushResponse = this.pushResponse;
      // showuld we create a new entering
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `INSERT INTO ${testTable[testname]}
         (HBsAg, HBsAb, HBeAg, HBeAb, HBcAb,COMMENTS,BILLINGID,PATIENTID,employeeid)
         VALUES (?,?,?,?,?,?,?,?,?)`;

        const values = [
          HBsAg,
          HBsAb,
          HBeAg,
          HBeAb,
          HBcAb,
          comments,
          billingid,
          patientid,
          employeeid
        ];

        await this.useTransactionForResult(
          insertionQuery,
          values,
          testid,
          response
        );
      } else {
        const updateQuery = `UPDATE ${testTable[testname]}
         SET HBsAg  = ?,
         HBsAb = ?,
         HBeAg = ?,
         HBeAb = ?,
         HBcAb = ?,
         COMMENTS = ?,
         employeeid = ?,
         UPDATED_ON = NOW()
         WHERE BILLINGID = ?
         `;

        connection.query(
          updateQuery,
          [HBsAg, HBsAb, HBeAg, HBeAb, HBcAb, comments,employeeid, billingid],
          function (err, result) {
            pushResponse(result, response);
          }
        );
      }
    }
  }

  async hvs(records, response) {
    console.log(records);
  }

  async betahcg(records, response) {
    let errMessage = this.errMessage;
    let pushResponse = this.pushResponse;
    const { testname, billingid, testid, value, unit, comments, patientid } =
      records;
    // not necessary to always use istestValid method if only necessry checks are made at the
    // controller level to ensure test in testtable doesnt return undefined and hnadled in case test is not found. if not handled, recommeded to use the method
    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `INSERT INTO ${testTable[testname]}
     (VALUE,UNIT,COMMENTS,BILLINGID,PATIENTID) VALUES (?,?,?,?,?)
    `;
        const insertionValues = [value, unit, comments, billingid, patientid];
        await this.useTransactionForResult(
          insertionQuery,
          insertionValues,
          testid,
          response
        );
      } else {
        const updateQuery = `UPDATE ${testTable[testname]}
         SET VALUE = ?,
         UNIT = ?,
         COMMENTS = ?
         WHERE BILLINGID = ?
        `;

        const nv = [value, unit, comments, billingid];

        connection.query(updateQuery, nv, function (err, result) {
          if (err) {
            console.log(err);
            errMessage(err, response);
          }

          if (result) {
            pushResponse(result, response);
          }
        });
      }
    }
  }

  async Aids(records, response) {
    const { reaction, testname, billingid, patientid, testid, comments } =
      records;

    if (await this.ShouldCreateRecord()) {
      const insertion = `INSERT INTO ${testTable[testname]}
        (reaction,billingid,patientid,comments) VALUES (?,?,?,?)`;

      const values = [reaction, billingid, patientid, comments];

      await this.useTransactionForResult(insertion, values, testid, response);
    } else {
      // update the result
      const updateQuery = `UPDATE ${testTable[testname]}
              SET reaction = ?,
              comments = ?,
              updated_on = NOW()
              WHERE billingid = ?
      `;

      connection.query(
        updateQuery,
        [reaction, comments, billingid],
        (err, result) => {
          if (err) {
            this.errMessage(err, response);
          }
          if (result) {
            this.pushResponse(result, response);
          }
        }
      );
    }
  }

  async esr(records, response) {
    const { value, comments, testname, testid, billingid, patientid } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const insertion = `INSERT INTO ${testTable[testname]}
        (VALUE,COMMENTS,BILLINGID,PATIENTID) VALUES (?,?,?,?)`;

        const params = [value, comments, billingid, patientid];
        await this.useTransactionForResult(insertion, params, testid, response);
      } else {
        const updateQuery = `UPDATE ${testTable[testname]}
          SET VALUE  = ?,
          updated_on = NOW(),
          COMMENTS = ? 
          WHERE BILLINGID = ? AND PATIENTID  =?
        `;
        const params = [value, comments, billingid, patientid];

        connection.query(updateQuery, params, (err, result) => {
          if (err) {
            this.errMessage(err, response);
          }

          if (result) {
            this.pushResponse(result, response);
          }
        });
      }
    }
  }

  async glucose(records, response) {
    const { testname, testid, patientid, unit, billingid, result, comments } =
      records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `INSERT INTO ${testTable[testname]}
        (BILLINGID,PATIENTID,RESULT,UNIT,COMMENTS)
        VALUES (?,?,?,?,?)
        `;

        const values = [billingid, patientid, result, unit, comments];

        await this.useTransactionForResult(
          insertionQuery,
          values,
          testid,
          response
        );
      } else {
        const updateRecords = `UPDATE ${testTable[this.testname]}
        SET RESULT = ?,
        UNIT = ?,
        updated_on = NOW(),
        COMMENTS = ? 
        WHERE BILLINGID = ? AND PATIENTID = ?`;

        const values = [result, unit, comments, billingid, patientid];

        connection.query(updateRecords, values, (err, result) => {
          if (err) {
            this.errMessage(err, response);
          }
          if (response) {
            this.pushResponse(result, response);
          }
        });
      }
    }
  }

  async semenAnalysis(records, response) {
    // destructure this 
    const {
      collectionDate, collectionTime, liquefactionTime, abstinence, colour, quantity, consistency,
      ph, fructose, spermCount, motility, motilityGrade, morphology, pusCells, epithelialCells, rbcs, impression,
      billingid, testid, testname, patientid
    } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        //  create the record
        const insertionQuery = `INSERT INTO ${testTable[testname]}
        (collectionDate,collectionTime,liquefactionTime,abstinence,colour,quantity,consistency,ph,fructose,spermcount,
        motility,motilityGrade,morphology,pusCells,epithelialCells,rbcs,impression,billingid,patientid)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        `;

        const values = [collectionDate, collectionTime, liquefactionTime, abstinence, colour, quantity, consistency, ph,
          fructose, spermCount, motility, motilityGrade, morphology, pusCells, epithelialCells, rbcs, impression, billingid, patientid];

        await this.useTransactionForResult(
          insertionQuery,
          values,
          testid,
          response
        );
      } else {
        // update the record
        const updateQuery = `UPDATE ${testTable[testname]}
        SET collectionTime = ?,
        collectionDate = ?,
        liquefactionTime = ?,
        abstinence = ?,
        colour = ?,
        quantity = ?,
        consistency = ?,
        ph = ?,
        fructose = ?,
        spermcount = ?,
        motility = ?,
        motilityGrade = ?,
        morphology = ?,
        pusCells = ?,
        epithelialCells = ?,
        rbcs = ?,
        impression = ?,
        updated_on = NOW()
        WHERE billingid = ? AND patientid = ?
        `;

        const values = [collectionTime, collectionDate, liquefactionTime, abstinence, colour, quantity, consistency, ph,
          fructose, spermCount, motility, motilityGrade, morphology, pusCells, epithelialCells, rbcs, impression, billingid, patientid];

        connection.query(updateQuery, values, (err, result) => {
          if (err) {
            this.errMessage(err, response);
          }
          if (result) {
            this.pushResponse(result, response);
          }
        }
        );
      }
    }

  }


  async helicobacter_pylori(records, response) {
    const { specimen, billingid, patientid, testid, testname, result, comments } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const query = `INSERT INTO ${testTable[testname]} (specimen,result,billingid,comments,patientid)
        VALUES(?,?,?,?,?)`;
        await this.useTransactionForResult(query, [specimen, result, billingid, comments, patientid], parseInt(testid), response);
      } else {
        const updatedQuery = `UPDATE ${testTable[testname]} SET 
        specimen = ?,result = ?, comments = ? WHERE BILLINGID = ?`;
        connection.query(updatedQuery, [specimen, result, comments, billingid], (err, result) => {
          if (err) {
            this.errMessage(err, response)
          } else {
            this.pushResponse(result, response)
          }
        })
      }
    }
  }


  async scanResult(records, response) {
    const { testid, fullname, testname, billingid, patientid, scan, content, sonographer } = records;
    connection.query(`SELECT * FROM scanReport WHERE billingid = ? AND testid = ?`, [billingid, testid],
      (err, result) => {
        if (err) { logger.error(err) } else {
          if (result.length === 0) {
            const query = `INSERT INTO ${testTable[testname]}(patientid,billingid,scan,content,sonographer,testid) VALUES (?,?,?,?,?,?)`;
            const values = [patientid, billingid, scan, content, sonographer, parseInt(testid)];
            this.useTransactionForResult(query, values, parseInt(testid), response);
          } else {
            const updatedQuery = `UPDATE scanReport  SET content = ? WHERE billingid = ? AND patientid = ?`;
            connection.query(updatedQuery, [content, billingid, patientid], (err, result) => {
              if (err) {
                this.errMessage(err, response);
              } else {
                this.pushResponse(result, response);
              }
            }
            );
          }
        }
      });
  }


  async syphilis(records, response) {
    const { sampletype, testname, testid, reaction, patientid, billingid, result, comments } = records;
    try {
      if (this.isTestValid()) {
        if (await this.ShouldCreateRecord()) {
          const queryString = `INSERT INTO ${testTable[testname]} (sampletype,result,reaction,billingid,comments,patientid) VALUES (?,?,?,?,?,?)`;
          const values = [sampletype, result, reaction, billingid, comments, patientid];
          await this.useTransactionForResult(queryString, values, testid, response);
        }
        else {
          // we upated the result if it exist
          const updateQuery = `UPDATE ${testTable[testname]} SET result = ?, reaction = ?, comments = ? WHERE billingid = ?`;
          const values = [result, reaction, comments, billingid];
          const queryresult = await promisifyQuery(updateQuery, values);
          if (queryresult.affectedRows > 0) { response.send({ status: 'success', message: 'record updated successfully', statusCode: 200 }) } else {
            response.send({ status: 'success', message: 'record not updated', statusCode: 401 })
          }
        }
      } else { customError('test not found', 404, response) }
    } catch (err) {
      console.log(err)
      logger.error(err);
    }
  }

  async clotandbleed(records,response) {
    try {
      const { bleedingtime, clottingtime, billingid, patientid, comments, testid } = records;
      if (this.isTestValid()) {
        if (await this.ShouldCreateRecord()) {
          const QUERY = `INSERT INTO clotbleedingtime (billingid,patientid,comments,bleedingTime,clottingTime) VALUES(?,?,?,?,?)`;
          const values = [billingid, patientid, comments, bleedingtime, clottingtime];
          await this.useTransactionForResult(QUERY, values, testid, response);
        } else {
          const updateQuery = `UPDATE clotbleedingtime SET bleedingTime = ?, clottingTime = ?, comments = ? WHERE billingid = ? AND patientid = ?`;
          const values = [bleedingtime, clottingtime, comments, billingid, patientid];
          const result = await promisifyQuery(updateQuery, values);
          this.pushResponse(result, response);
        }
      } else {
        customError('test not found', 500, response);
      }
     } catch (err) {
      logger.error(err);
    }
  }

  async getBetaHcgReference () {
    try {
       return await promisifyQuery( `SELECT * FROM setup_beta_hcg`)
     }catch (err) {
       logger.error(err)
     }
  }

}

module.exports = { Result, beginTransaction, query, testTable };
