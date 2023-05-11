const connection = require("../db");
const util = require("util");
const beginTransaction = util
  .promisify(connection.beginTransaction)
  .bind(connection);
const query = util.promisify(connection.query).bind(connection);

const testTable = {
  hepatitisb: "hepatitisBresult",
  hepatitisc: "hepatitisC",
  bloodgrouping: "bloodgroup",
  glycated_haemoglobin: "glycated_haemoglobin",
  urinalysis: "urinalysisresult",
  cardiac_enzymes: "result_cardiac_enzymes",
  pregnancy_test: "result_pregnancy_test",
  thyroidfunctionaltest: "result_thyroid_functional_test",
  malaria: "malaria",
  hepatitis_b_profile: "hepatitisb_profile",
  widal: "result_widal",
  betahcg: 'result_beta_hcg',
  aids: 'result_aids',
  liverfunctiontest: 'result_function_liver',
  esr: 'result_esr'
};

class Result {
  constructor(billingid, testname) {
    this.billingid = billingid;
    this.testname = testname;
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
  async useTransactionForResult(queryString, value, testid, response, comments) {
    try {
      await beginTransaction();
      await query(queryString, value);
      await query(
        `UPDATE TEST_ASCENSION SET READY = 'true',READY_DATE = NOW() WHERE BILLINGID = ${this.billingid} AND TESTID = ?`,
        testid
      );
      // await query(`INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`,[testid,this.billingid,comments])

      if (arguments[4] != undefined) {
        await query(`INSERT INTO RESULT_COMMENTS (TESTID,BILLINGID,COMMENTS) VALUES (?,?,?)`, [testid, this.billingid, comments])
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
    if (await this.isTestValid()) {
      const { billingid, bloodgroup, rhesus, patientid, remarks, testid } =
        records;
      //insert record
      if (await this.ShouldCreateRecord()) {
        const query = `INSERT INTO BLOODGROUP (BILLINGID,BGROUP,RHESUS,PATIENTID,REMARKS) VALUES (?,?,?,?,?)`;
        let values = [billingid, bloodgroup, rhesus, patientid, remarks];
        // excute query
        await this.useTransactionForResult(query, values, testid, response);
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
    const {
      COMMENT,
      LDH,
      MYOGLOBIN,
      CK_MB,
      AST,
      TROPONIN,
      testid,
      patientid,
      billingid,
    } = records;

    const queryValues = ["LDH", "MYOGLOBIN", "CK_MB", "AST", "TROPONIN"].map(
      (item, index) => {
        return [item, billingid, records[item], patientid, COMMENT];
      }
    );

    const insertionQuery = `INSERT INTO ${testTable[this.testname]} (
         PARAMETERNAME,
         BILLINGID,
         VALUE,
         PATIENTID,
         COMMENTS
      ) VALUES ?`;

    if (await this.ShouldCreateRecord()) {
      await this.useTransactionForResult(
        insertionQuery,
        [queryValues],
        testid,
        response
      );
    } else {
      console.log("update");
    }
  }

  async pregnancyTest(records, response) {
    console.log(records);
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
      });
    }
  }

  async renalFunctionalTest(records, response) {
    console.log(records);
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
          function (err, result) {
            if (err) {
              throw err;
            }
            if (result) {
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
          }
        );
      }
    }
  }

  async liverfunctionTest(requestBody, response) {
    const { testname, billingid, testid, patientid, records, comments } = requestBody;
    let errMessage = this.errMessage;
    let pushResponse = this.pushResponse;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {

        const insertionQuery = `INSERT INTO ${testTable[testname]}
         (parameter,unit,value,billingid,patientid)
         VALUES ?
         `
        const mappedValues = records.map((item, index) => {
          return [item.parameter, item.unit, parseInt(item.value), billingid, patientid]
        })

        await this.useTransactionForResult(insertionQuery, [mappedValues], testid, response, comments);
      }
      else {
        try {
          const target = records.length - 1;
          records.forEach((item, index) => {
            const updateQuery = `
            UPDATE ${testTable[testname]}
            SET value = ?,
            unit = ?
            WHERE billingid = ? AND parameter = ?
          `
            const { value, unit, parameter } = item;

            connection.query(updateQuery, [value, unit, billingid, parameter], (err, result) => {
              if (err) {
                this.errMessage(err, response);
              }
              if (result) {
                if (index === target) {
                  connection.query(`UPDATE RESULT_COMMENTS
                  SET COMMENTS = ? WHERE BILLINGID = ? AND TESTID = ?`, [comments, this.billingid, testid], function (err, result) {
                    if (err) {
                      errMessage(err, response)
                    }
                    pushResponse(result, response)
                  })

                }
              }
            })
          })
        }
        catch (err) {
          this.errMessage(err, response)
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
          COMMENTS
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

        const values = [TYPHIO, TYPHIH, PARATYPHIAH, PARATYPHIBH, COMMENTS, this.billingid]

        connection.query(updateQuery, values, (err, result) => {
          if (err) {
            console.log(err)
          }
          if (result) {
            this.pushResponse(result, response)
          }
        })
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

  async thyroid(records, response) {
    let messageLog = this.errMessage;

    const { testdata, testname, billingid, comments, patientid, testid } =
      records;
    if (this.isTestValid) {
      if (await this.ShouldCreateRecord()) {
        const insertionQuery = `INSERT INTO ${testTable[testname]} 
             (PARAMETER,BILLINGID,VALUE,PATIENTID,COMMENTS)
             VALUES ?
            `;
        const values = [];
        for (let i = 0; i < testdata.length; i++) {
          values.push([
            testdata[i]["parameter"],
            billingid,
            testdata[i]["value"],
            patientid,
            comments,
          ]);
        }

        await this.useTransactionForResult(
          insertionQuery,
          [values],
          testid,
          response
        );
      } else {
        const updateQuery = `
             UPDATE ${testTable[testname]} SET
             VALUE = ?,
             COMMENTS  = ?,
             UPDATED_ON = NOW()
             WHERE BILLINGID = ${this.billingid} AND PARAMETER = ?
            `;

        let currentValue = 0;
        let target = testdata.length;
        while (currentValue < target) {
          const workingParameter = testdata[currentValue]["parameter"];
          const workingValue = testdata[currentValue]["value"];
          connection.query(
            updateQuery,
            [workingValue, comments, workingParameter],
            function (err, result) {
              if (err) {
                messageLog(err);
              }
              if (result) {
                const { affectedRows } = result;

                if (affectedRows != 1) {
                  const query = `INSERT INTO ${testTable[testname]} (
                        PARAMETER,
                        BILLINGID,
                        VALUE,
                        PATIENTID,
                        COMMENTS
                      ) VALUES (?,?,?,?,?)`;

                  connection.query(
                    query,
                    [
                      workingParameter,
                      billingid,
                      workingValue,
                      patientid,
                      comments,
                    ],
                    function (err, result) {
                      if (err) {
                        throw err;
                      }
                      return;
                    }
                  );
                }
              }
            }
          );
          currentValue++;

          if (currentValue == target) {
            response.send({
              status: "success",
              message: "record updated successfully",
              statusCode: 200,
            });
          }
        }
      }
    }
  }

  async betahcg(records, response) {
    let errMessage = this.errMessage;
    let pushResponse = this.pushResponse
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
      }
      else {
        const updateQuery = `UPDATE ${testTable[testname]}
         SET VALUE = ?,
         UNIT = ?,
         COMMENTS = ?
         WHERE BILLINGID = ?
        `;

        const nv = [value, unit, comments, billingid];

        connection.query(updateQuery, nv, function (err, result) {
          if (err) {
            console.log(err)
            errMessage(err, response);
          }

          if (result) {
            pushResponse(result, response)
          }
        });
      }
    }

  }


  async Aids(records, response) {
    const { reaction, testname, billingid, patientid, testid, comments } = records;

    if (await this.ShouldCreateRecord()) {
      const insertion = `INSERT INTO ${testTable[testname]}
        (reaction,billingid,patientid,comments) VALUES (?,?,?,?)`;

      const values = [reaction, billingid, patientid, comments];

      await this.useTransactionForResult(insertion, values, testid, response);
    }
    else {
      // update the result
      const updateQuery = `UPDATE ${testTable[testname]}
              SET reaction = ?,
              comments = ?,
              updated_on = NOW()
              WHERE billingid = ?
      `

      connection.query(updateQuery, [reaction, comments, billingid], (err, result) => {
        if (err) {
          this.errMessage(err, response)
        }
        if (result) {
          this.pushResponse(result, response);
        }
      })
    }
  }


  async esr(records, response) {
    const { value, comments, testname, testid, billingid, patientid } = records;

    if (this.isTestValid()) {
      if (await this.ShouldCreateRecord()) {
        const insertion = `INSERT INTO ${testTable[testname]}
        (VALUE,COMMENTS,BILLINGID,PATIENTID) VALUES (?,?,?,?)`

        const params = [value, comments, billingid, patientid]
        await this.useTransactionForResult(insertion, params, testid, response);
      } else {
        const updateQuery = `UPDATE ${testTable[testname]}
          SET VALUE  = ?,
          updated_on = NOW(),
          COMMENTS = ? 
          WHERE BILLINGID = ? AND PATIENTID  =?
        `
        const params = [value, comments, billingid, patientid]

        connection.query(updateQuery, params, (err, result) =>{
          if (err) {
            this.errMessage(err,response);
          }

          if (result) {
            this.pushResponse(result,response)
          }
        })
      }
    }
  }
}

module.exports = Result;
