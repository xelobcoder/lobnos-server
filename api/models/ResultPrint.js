const connection = require("../db");
const { Result, testTable } = require("./result");
const { getAge } = require('../../api/test/setup/fbc');
const ResultClass = new Result();
const errMessage = ResultClass.errMessage;
const {
  MappingSetup,
  mappWithBilingid,
  testCategoryMapping,
} = require("./ResultQueryMapping");
const pushResponse = ResultClass.pushResponse;

const LIVER_SETUP = "setup_liver_function_test";
const RENAL_SETUP = "setup_renal_function_test";
const CARDIAC_ENZYMES = "setup_cardiac_enzymes";
const THYROID_SETUP = "setup_thyroid_test";
const LIPID_PROFILE_SETUP = "setup_lipid_profile_test";
const FULL_BLOOD_COUNT = 'result_function_full_blood_count'
const BETAHCG = `setup_beta_hcg`;
const ESR = `setup_esr`;
const LHHORMONE = 'lhsetup';
const FSHHORMONE = 'fshsetup';


// this represent the setups in the database for those chemistry test, full blood count is give a 
// default string of empty so that using the billing id we could populate
// with getAge
const setups = {
  liver_function_test: LIVER_SETUP,
  renal_function_test: RENAL_SETUP,
  cardiac_enzymes: CARDIAC_ENZYMES,
  full_blood_count: '',
  LHHORMONE,
  FSHHORMONE
};

const samplingQuery = `
      SELECT 
        ts.collection_date,
        ts.processing_date,
        ts.ready_date,
        pt.URGENCY AS urgency,
        pt.Phelobotomist,
        np.GENDER AS gender,
        CASE 
          WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
          WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) 
        END AS fullname,
        CONCAT(np.age," ",np.agetype) AS age,
        pt.INSPECTION_TIME AS inspectionTime,
        b.NAME as samplingCenter,
        c.NAME as clinician
      FROM test_ascension AS ts
      INNER JOIN performing_test AS pt ON pt.BILLINGID = ts.billingid
      INNER JOIN branch AS b ON b.BRANCHID = pt.SAMPLING_CENTER
      INNER JOIN new_patients as np ON np.PATIENTID = pt.PATIENTID
      INNER JOIN billing as bb ON bb.BILLINGID = pt.BILLINGID
      INNER JOIN clinician as c ON bb.CLINICIAN = c.ID
      WHERE ts.billingid = ? and ts.testid = ?
    `;

class ResultPrint {
  constructor(billingid) {
    this.billingid = billingid;
  }
  get_printables = (request, response) => {
    const { querydate, content } = request.query;
    let modelQuery = `
      SELECT 
          ta.billingid AS billingid,
      CASE
         WHEN COUNT(ta.testid) = (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Ready'
         WHEN COUNT(ta.testid) < (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Partial'
         ELSE 'Unknown'
      END AS status,
         ta.ready,
         ta.ready_date,
         b.OUTSTANDING AS outstanding,
         b.PAID_AMOUNT AS paid_amount,
         np.PATIENTID AS patientid,
         COUNT(ta.testid) AS readycount,
         (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,
      CASE 
        WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
        WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) 
        END AS fullname
      FROM 
         TEST_ASCENSION AS ta 
         INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
         INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
      WHERE 
         ta.ready = 'true' and ta.ApprovalStatus = 1
      `;

    const params = [];

    // Add filters if provided
    if (querydate) {
      modelQuery += " AND DATE(ta.ready_date) = ?";
      params.push(querydate);
    } else {
      modelQuery += " AND DATE(ta.ready_date) = CURDATE()";
    }

    if (content) {
      modelQuery += " AND ta.billingid = ?";
      params.push(content);
    }

    modelQuery += " GROUP BY ta.billingid ORDER BY ta.billingid DESC LIMIT 100";

    connection.query(modelQuery, params, (err, result) => {
      if (err) {
        errMessage.call(this, err, response);
      } else[response.send(result)];
    });
  };

  get_extrainfo_test = (id, request, response) => {
    const model = `SELECT tp.NAME AS name,
      ta.testid,
       ta.ready
       FROM test_ascension AS ta 
      INNER JOIN test_panels AS tp ON ta.testid = tp.ID
      WHERE billingid = ?`;

    connection.query(model, id, (err, result) => {
      if (err) {
        errMessage.call(this, err, response);
      } else[response.send(result)];
    });
  };

  run_query = async (query, date) => {
    try {
      return new Promise((reject, resolve) => {
        connection.query(query, date, (err, result) => {
          if (err) {
            reject(err);
          }

          resolve(result);
        });
      });
    } catch (err) {
      throw err;
    }
  };

  get_summary_ready_page = async (request, response) => {
    const { querydate, content } = request.query;

    const query = `SELECT 
        pt.DATE,
        pt.BILLINGID,
        tt.collection,
        (SELECT COUNT(*) FROM performing_test WHERE DATE = ?) AS registered,
        tt.ready,
        tt.collection_date,
        tt.processing,
        tt.testid,
        tt.ApprovalStatus
          FROM performing_test AS pt
        INNER JOIN BILLING AS b ON b.billingid = pt.billingid
        INNER JOIN test_ascension AS tt ON tt.billingid = b.BILLINGID
        WHERE pt.DATE = ?
       `;

    function getTodayDate() {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    connection.query(
      query,
      [querydate || getTodayDate(), querydate || getTodayDate()],
      (err, result) => {
        if (err) {
          throw err;
        } else {
          if (result.length == 0) {
            response.send([
              {
                title: "registered clients",
                value: 0,
              },
              {
                title: "processing test",
                value: 0,
              },
              {
                title: "collected test ",
                value: 0,
              },
              {
                title: "test ready ",
                value: 0,
              },
              {
                title: "Approved test",
                value: 0,
              },
            ]);
          } else {
            const processing = result.filter((item, index) => {
              return item.processing == "true" &&
                item.collection == 'true'
                && item.ready == 'true';
            }).length;
            const ready = result.filter((item, index) => {
              return item.processing == "true" && item.ready == "true";
            }).length;
            const collection = result.filter((item, index) => {
              return item.collection == "true";
            }).length;
            const approval = result.filter((item, index) => {
              return item.ApprovalStatus == 1;
            }).length;

            response.send([
              {
                title: "registered clients",
                value: result[0]?.["registered"],
              },
              {
                title: "processing test",
                value: processing,
              },
              {
                title: "collected test ",
                value: collection,
              },
              {
                title: "test ready ",
                value: ready,
              },
              {
                title: "Approved test",
                value: approval,
              },
            ]);
          }
        }
      }
    );
  };

  resultPreviewChemistry = async function (request, response, category) {
    const { billingid, testid, test } = request.query;
    let responseResult = { sampling: [], result: [] };
    const testname = testTable[test];
    let testSetup = setups[test];


    if (testname && billingid && testid) {
      // once it is full_blood_count , we use the billingid and getAge function
      // to get the gender result reference
      if (test == 'full_blood_count') {
        testSetup = await getAge(null, billingid);
      }

      let resultQuery;

      if (typeof testSetup != undefined) {
        resultQuery = `SELECT
               rt.parameter,
                  st.UPPER as upper,
                  st.LOWER as lower,
                  st.UNIT as unit,
                  rt.value
               FROM ${testSetup} AS st
                  INNER JOIN ${testname} AS rt ON rt.parameter = st.PARAMETER
               WHERE rt.billingid = ?`;
      }


      connection.query(samplingQuery, [billingid, testid], function (err, samplingResult) {
        if (err) {
          connection.rollback(function () {
            throw err;
          });
        }

        responseResult.sampling = samplingResult;

        connection.query(resultQuery, billingid, function (err, resultResult) {
          if (err) {
            connection.rollback(function () {
              throw err;
            });
          }

          responseResult.result = resultResult;
          responseResult.testcategory = category;
          response.status(200).json(responseResult); // Send the response to the client
        });
      }
      );
    } else {
      response.send({
        statusCode: 401,
        status: "error",
      });
    }
  };

  resultPreviewHematological = function (request, response) {
    const { billingid, testid, test } = request.query;

    let responseResult = { sampling: [], result: [] };
    const category = testCategoryMapping[test];

    const dbTable = MappingSetup[test];

    if (
      typeof dbTable != undefined &&
      billingid &&
      testid &&
      test &&
      category == "hema"
    ) {
      let query = mappWithBilingid(dbTable, billingid);

      connection.beginTransaction(function (err) {
        if (err) {
          throw err;
        }

        connection.query(query, function (err, result) {
          if (err) {
            connection.rollback(function () {
              throw err;
            });
          }
          responseResult.result = result;

          connection.query(
            samplingQuery,
            [billingid, testid],
            function (err, result) {
              if (err) {
                connection.rollback(function () {
                  throw err;
                });
              }

              responseResult.sampling = result;
              responseResult.testcategory = category;
              connection.commit(function (err) {
                if (err) {
                  connection.rollback(function () {
                    throw err;
                  });
                }
                response.status(200).json(responseResult); // Send the response to the client
              });
            }
          );
        });
      });
    } else {
      response.send({
        statusCode: 401,
        status: "error",
        message: "include all necessary details",
      });
    }
  };

  getComments = function (billingid, testid, response) {
    connection.query(
      `SELECT * FROM result_comments WHERE BILLINGID = ? AND TESTID = ? `,
      [billingid, testid],
      function (err, result) {
        response.send(result);
      }
    );
  };

  // this function would update the  test ascension table using the client blling id as to whether the result is approved or declined
  // decison query in the request is used here 
  makeDecisionOnResult = function (request, response) {
    const { billingid, testid, decision, message } = request.body;
    // update query to change approval status 
    let updateQuery = `UPDATE TEST_ASCENSION 
    SET APPROVALSTATUS = true ,
    APPROVEDBY = ?  WHERE BILLINGID = ? AND TESTID = ?`;
    if (decision == 'decline') {
      const { declineMessage, actionplan } = message;
      if (declineMessage && actionplan) {
        updateQuery = `UPDATE test_ascension
          SET approvalStatus = 0,
          declineMessage ='${declineMessage}',
          actionPlan = '${actionplan}',
          APPROVEDBY = ?  WHERE BILLINGID = ? AND TESTID = ?`
      }
    }

    connection.query(updateQuery, ['Tiifu Hamza', billingid, testid], function (err, result) {
      if (err) {
        console.log(err)
        throw err;
      }
      else {
        if (result.affectedRows == 1) {
          response.status(200).json({ status: 'success', statusCode: 200, message: 'update successful' })
        }
        else {
          response.status(401).json({ status: 'error' })
        }
      }
    })
  }

  checkApproval = async function (request, response) {
    const { billingid, testid } = request.body;

    const q = `SELECT ApprovalStatus FROM TEST_ASCENSION WHERE BILLINGID = ? AND TESTID = ?`;

    connection.query(q, [billingid, testid], function (err, result) {
      if (err) {
        throw err;
      } else {
        if (result.length > 0) {
          const { ApprovalStatus } = result[0];
          if (ApprovalStatus == 1) {
            response.send({ approved: true })
          } else {
            response.send({ approved: false })
          }
        } else {
          response.send({ approved: null })
        }
      }
    })
  }


  advancedTablesSearch(request, response) {
    const { patientid, fullname, mobile, from, to } = request.query;
    // IF TO AND FROM DATE IS PRESENT
    // SEARCH AS INTERVAL 
    // ELSE 
    // SEARCH USING ANY OF THE PARAMETERS AVAILABLE
    //  IF PATIENTID IS AVAILABLE 
    // USE PATIENTID
    // ELSE USE FULLNAME OR MOBILE NUMBER

    let query = `
        SELECT 
              ta.billingid AS billingid,
          CASE
            WHEN COUNT(ta.testid) = (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Ready'
            WHEN COUNT(ta.testid) < (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) THEN 'Partial'
            ELSE 'Unknown'
          END AS status,
            ta.ready,
            ta.ready_date,
            b.OUTSTANDING AS outstanding,
            b.PAID_AMOUNT AS paid_amount,
            np.PATIENTID AS patientid,
            COUNT(ta.testid) AS readycount,
            (SELECT COUNT(*) FROM test_ascension WHERE billingid = ta.billingid) AS testcount,
          CASE 
            WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
            WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME) 
            END AS fullname
          FROM 
            TEST_ASCENSION AS ta 
            INNER JOIN billing AS b ON b.BILLINGID = ta.billingid
            INNER JOIN new_patients AS np ON b.PATIENTID = np.PATIENTID
          WHERE 
            ta.ready = 'true' and ta.ApprovalStatus = 1 
   `
    //  if patient id is part of query id
    if (patientid) {
      query += `AND np.PATIENTID = ${patientid}`
    }
    // if fullname exist 
    if (fullname) {
      query += ` AND np.FIRSTNAME LIKE '%${fullname}%' OR np.MIDDLENAME LIKE '%${fullname}%' OR np.LASTNAME LIKE '%${fullname}%'`
    }

    if (mobile) {
      query += `AND np.MOBILE = ${mobile}`
    }
    query += ` GROUP BY b.billingid`;

    if (to && from) {
      query += ` HAVING DATE(ta.ready_date) BETWEEN '${from}' AND '${to}'`
    }

    if (to && from) {
      query += ` ORDER BY b.billingid DESC LIMIT 100`
    } else {
      query += ` ORDER BY b.billingid DESC LIMIT 20`
    }


    connection.query(query, (err, result) => {
      if (err) {
        response.send({ status: 'error', statusCode: 401, message: 'error occured' })
      } else {
        response.send({
          status: 'success',
          statusCode: 200,
          result
        });
      }
    }
    )
  }
}

module.exports = ResultPrint;
