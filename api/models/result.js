const connection = require("../db");
const util = require("util");
const beginTransaction = util
  .promisify(connection.beginTransaction)
  .bind(connection);
const query = util.promisify(connection.query).bind(connection);
const operations = require('../models/operations');
const { customError } = require("../../helper");


const testTable = {
  hepatitisb: "hepatitisBresult",
  hepatitisc: "hepatitisCresult",
  blood_grouping: "bloodgroup",
  glycated_haemoglobin: "glycated_haemoglobin",
  urinalysis: "urinalysisresult",
  cardiac_enzymes: "result_cardiac_enzymes",
  pregnancy_test: "result_pregnancy_test",
  thyroid_functional_test: "result_thyroid_functional_test",
  malaria: "malaria",
  hepatitis_b_profile: "hepatitisb_profile",
  widal: "result_widal",
  betahcg: "result_beta_hcg",
  aids: "result_aids",
  liver_function_test: "result_function_liver",
  renal_function_test: 'result_function_renal',
  esr: "result_esr",
  random_blood_sugar: "result_random_blood_sugar",
  fasting_blood_sugar: "result_fasting_blood_sugar",
  full_blood_count: 'result_function_full_blood_count',
  haemoglobin_electrophoresis: 'result_haemoglobin_electrophoresis',
  semen_analysis: 'semenAnalysis',
  luteinizing_hormone: 'lhresult',
  follicle_stimulating_hormone: 'fshresult',
  lipid_profile: 'result_lipid_profile',
  helicobacter_pylori: 'result_helicobacter_pylori'
};

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

  async isResultEntered() {
    if (this.isTestValid()) {
      return new Promise((resolve, reject) => {
        const query = `SELECT * FROM ${testTable[this.testname]
          } WHERE billingid = ${this.billingid}`;
        connection.query(query, (err, result) => {
          if (err) {
            reject(err);
          }
          resolve(result);
        });
      });
    } else {
      return "test not recognized";
    }
  }

  async getTestResult() {
    if (this.isTestValid) {
      return new Promise((resolve, reject) => {
        const query = `SELECT * FROM ${testTable[this.testname]
          } WHERE billingid = ${this.billingid}`;
        connection.query(query, (err, result) => {
          if (err) {
            reject(err);
          }
          resolve(result);
        });
      });
    } else {
      return "test not recognized";
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
  async useTransactionForResult(
    queryString,
    value,
    testid,
    response,
    comments
  ) {
    try {
      let ascensionQuery = `UPDATE TEST_ASCENSION SET READY = 'true',READY_DATE = NOW()`

      const isApprovalTrue = await this.isApprovalSetTrue();
      if (isApprovalTrue == false) {
        ascensionQuery += `,ApprovalStatus = 1`
      }
      ascensionQuery += ` WHERE BILLINGID = ${this.billingid} AND TESTID = ?`
      await beginTransaction();
      await query(queryString, value);
      await query(
        ascensionQuery,
        testid
      );
      // await query(`INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`,[testid,this.billingid,comments])

      if (arguments[4] != undefined) {
        await query(
          `INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`,
          [testid, this.billingid, comments]
        );
      }
      connection.commit(function (err) {
        if (err) {
          connection.rollback();
          throw err;
        } else {
          response.send({
            status: "success",
            statusCode: 200,
            message: "Result entered successfully",
          });
        }
      });
    } catch (err) {
      console.log(err);
      connection.rollback();
      throw err;
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
    let errMessage = this.errMessage;
    const {
      billingid,
      patientid,
      glycated,
      glucose,
      method,
      comment,
      technology,
    } = record;
    if (this.isTestValid) {
      if (await this.ShouldCreateRecord()) {
        // we create a query using the above data in order to populate the database
        const creation = `INSERT INTO  ${testTable[this.testname]} (
            BILLINGID,PATIENTID,RESULT,REMARKS,TECHNOLOGY,METHOD,GLUCOSE
         ) VALUES (?,?,?,?,?,?,?)`;

        let values = [
          billingid,
          patientid,
          glycated,
          comment,
          technology,
          method,
          glucose,
        ];
        // execute query
        await this.useTransactionForResult(creation, values, testid);

        // update test ascention table to update ready to true and result entered trure
      } else {
        // update the test record
        const upateRecord = `UPDATE ${testTable[this.testname]} SET RESULT = ?,
           REMARKS = ?,
           TECHNOLOGY = ?,
           METHOD= ?,
           GLUCOSE = ? 
           WHERE BILLINGID = ?`;

        connection.query(
          upateRecord,
          [glycated, comment, technology, method, glucose, this.billingid],
          (err, result) => {
            if (err) {
              console.log(err);
              errMessage(err, response);
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

        connection.query(
          updateQuery,
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
            remarks,
            billingid,
          ],
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

  async cardiacEnzymes(records, response) {
    const { comment, resultdata, testid, patientid, billingid } = records;

    const queryValues = resultdata.map((item, index) => {
      return [item.parameter, billingid, item.value, patientid];
    });

    const insertionQuery = `INSERT INTO ${testTable[this.testname]} (
         PARAMETER,
         BILLINGID,
         VALUE,
         PATIENTID
      ) VALUES ?`;

    if (await this.ShouldCreateRecord()) {
      await this.useTransactionForResult(
        insertionQuery,
        [queryValues],
        testid,
        response,
        comment
      );
    }
    else {
      const updateQuery = `UPDATE ${testTable[this.testname]} SET
            VALUE = ?,
            UPDATED_ON = NOW()
      WHERE BILLINGID = ${billingid} AND PARAMETER = ? `;

      let counter = 0;

      while (counter < resultdata.length && resultdata.length != 0) {
        const { value, parameter } = resultdata[counter];
        connection.query(
          updateQuery,
          [value, parameter],
          function (err, result) {
            if (err) {
              throw err;
            }
          }
        );
        counter++;
        if (counter === resultdata.length) {
          connection.query(
            `UPDATE result_comments SET comments = ? WHERE BILLINGID = ? AND TESTID = ?`,
            [comment, billingid, testid],
            function (err, result) {
              if (err) {
                response
                  .status(500)
                  .send("An error occurred during the update.");
              } else {
                response
                  .send({
                    status: "success",
                    statusCode: 200,
                    message: "update successful",
                  })
              }
            }
          );
        }
      }
    }
  }

  async pregnancyTest(records, response) {
    const {
      method,
      reaction,
      testname,
      patientid,
      billingid,
      testid,
      comments,
    } = records;

    const queryString = `INSERT INTO ${testTable[this.testname]} (
         METHOD,
         VALUE,
         PATIENTID,
         BILLINGID,
         COMMENTS,
         TESTID
      ) VALUE(?,?,?,?,?,?)`;

    if (await this.ShouldCreateRecord()) {
      await this.useTransactionForResult(
        queryString,
        [method, reaction, patientid, billingid, comments, testid],
        testid,
        response
      );
    } else {
      let messageLog = this.errMessage;
      const queryString = `UPDATE ${testTable[testname]} 
         SET METHOD = ?,
         VALUE = ?,
         COMMENTS = ?
         WHERE BILLINGID = ${this.billingid} AND TESTID = ?`;
      const Values = [method, reaction, comments, testid];

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

    const { testname, billingid, testid, patientid, records, comments } =
      requestBody;
    let errMessage = this.errMessage;
    let pushResponse = this.pushResponse;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `INSERT INTO ${testTable[testname]}
         (parameter,unit,value,billingid,patientid)
         VALUES ?
         `;
        const mappedValues = records.map((item, index) => {
          return [
            item.parameter,
            item.unit,
            parseInt(item.value),
            billingid,
            patientid,
          ];
        });

        await this.useTransactionForResult(
          insertionQuery,
          [mappedValues],
          testid,
          response,
          comments
        );
      } else {
        try {
          const target = records.length - 1;
          records.forEach((item, index) => {
            const updateQuery = `
            UPDATE ${testTable[testname]}
            SET value = ?,
            unit = ?
            WHERE billingid = ? AND parameter = ?
          `;
            const { value, unit, parameter } = item;

            connection.query(
              updateQuery,
              [value, unit, billingid, parameter],
              (err, result) => {
                if (err) {
                  this.errMessage(err, response);
                }
                if (result) {
                  if (index === target) {
                    connection.query(
                      `UPDATE RESULT_COMMENTS
                  SET COMMENTS = ? WHERE BILLINGID = ? AND TESTID = ?`,
                      [comments, this.billingid, testid],
                      function (err, result) {
                        if (err) {
                          errMessage(err, response);
                        }
                        pushResponse(result, response);
                      }
                    );
                  }
                }
              }
            );
          });
        } catch (err) {
          this.errMessage(err, response);
        }
      }
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
    } = records;

    if (this.isTestValid) {
      let pushResponse = this.pushResponse;
      // showuld we create a new entering
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `INSERT INTO ${testTable[testname]}
         (HBsAg, HBsAb, HBeAg, HBeAb, HBcAb,COMMENTS,BILLINGID,PATIENTID)
         VALUES (?,?,?,?,?,?,?,?)`;

        const values = [
          HBsAg,
          HBsAb,
          HBeAg,
          HBeAb,
          HBcAb,
          comments,
          billingid,
          patientid,
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
         UPDATED_ON = NOW()
         WHERE BILLINGID = ?
         `;

        connection.query(
          updateQuery,
          [HBsAg, HBsAb, HBeAg, HBeAb, HBcAb, comments, billingid],
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

  // async thyroid(records, response) {
  //   let messageLog = this.errMessage;

  //   const { testdata, testname, billingid, comments, patientid, testid } =
  //     records;
  //   if (this.isTestValid) {
  //     if (await this.ShouldCreateRecord()) {
  //       const insertionQuery = `INSERT INTO ${testTable[testname]} 
  //            (PARAMETER,BILLINGID,VALUE,PATIENTID,COMMENTS)
  //            VALUES ?
  //           `;
  //       const values = [];
  //       for (let i = 0; i < testdata.length; i++) {
  //         values.push([
  //           testdata[i]["parameter"],
  //           billingid,
  //           testdata[i]["value"],
  //           patientid,
  //           comments,
  //         ]);
  //       }

  //       await this.useTransactionForResult(
  //         insertionQuery,
  //         [values],
  //         testid,
  //         response
  //       );
  //     } else {
  //       const updateQuery = `
  //            UPDATE ${testTable[testname]} SET
  //            VALUE = ?,
  //            COMMENTS  = ?,
  //            UPDATED_ON = NOW()
  //            WHERE BILLINGID = ${this.billingid} AND PARAMETER = ?
  //           `;

  //       let currentValue = 0;
  //       let target = testdata.length;
  //       while (currentValue < target) {
  //         const workingParameter = testdata[currentValue]["parameter"];
  //         const workingValue = testdata[currentValue]["value"];
  //         connection.query(
  //           updateQuery,
  //           [workingValue, comments, workingParameter],
  //           function (err, result) {
  //             if (err) {
  //               messageLog(err);
  //             }
  //             if (result) {
  //               const { affectedRows } = result;

  //               if (affectedRows != 1) {
  //                 const query = `INSERT INTO ${testTable[testname]} (
  //                       PARAMETER,
  //                       BILLINGID,
  //                       VALUE,
  //                       PATIENTID,
  //                       COMMENTS
  //                     ) VALUES (?,?,?,?,?)`;

  //                 connection.query(
  //                   query,
  //                   [
  //                     workingParameter,
  //                     billingid,
  //                     workingValue,
  //                     patientid,
  //                     comments,
  //                   ],
  //                   function (err, result) {
  //                     if (err) {
  //                       throw err;
  //                     }
  //                     return;
  //                   }
  //                 );
  //               }
  //             }
  //           }
  //         );
  //         currentValue++;

  //         if (currentValue == target) {
  //           response.send({
  //             status: "success",
  //             message: "record updated successfully",
  //             statusCode: 200,
  //           });
  //         }
  //       }
  //     }
  //   }
  // }

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


  async hormones(records, response) {
    const { testname, billingid, testid, parameter, value, comment, patientid } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const query = `INSERT INTO ${testTable[testname]} (parameter,billingid,patientid,value,comment) VALUES (?,?,?,?,?)`;

        await this.useTransactionForResult(query, [parameter, billingid, patientid, parseInt(value), comment], testid, response)

      } else {
        // TODO: to update the result if present 
        const updateQuery = `UPDATE ${testTable[testname]} SET value = ?, comment= ?, updated_on = NOW() WHERE billingid = ?`;

        connection.query(updateQuery, [parseInt(value), comment, billingid], (err, result) => {
          if (err) {
            this.errMessage(err, response)
          }
          else {
            this.pushResponse(result, response)
          }
        })
      }
    }
  }

  async helicobacter_pylori(records, response) {
    const { specimen, billingid, patientid, testid, testname, result, comments } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const query = `INSERT INTO ${testTable[testname]} (specimen,result,billingid,comments,patientid)
        VALUES(?,?,?,?,?)`;

        await this.useTransactionForResult(query, [specimen, result, billingid, comments, patientid], testid, response);
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

}

module.exports = { Result, beginTransaction, query, testTable };
