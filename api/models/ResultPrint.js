const connection = require("../db");
const { Result, testTable } = require("./result");
const { getAge } = require('../../api/test/setup/fbc');
const { setups } = require('../../helpers/testtables');
const logger = require('../../logger')
const { promisifyQuery, customError } = require('../../helper')
const ResultClass = new Result();
const errMessage = ResultClass.errMessage;
const { MappingSetup, mappWithBilingid, testCategoryMapping, } = require("./ResultQueryMapping");



const emptySummry = [{ title: "registered clients", value: 0, },
{ title: 'test count', value: 0 },
{ title: "samples collected ", value: 0 },
{ title: "processed test", value: 0, },
{ title: "test ready ", value: 0 },
{ title: "Approved test", value: 0, }
]


// this represent the setups in the database for those chemistry test, full blood count is give a
// default string of empty so that using the billing id we could populate
// with getAge


const samplingQuery = `
      SELECT
      ts.ready_date,
      b.clientstatus as urgency,
      ts.collection_date,
      np.patientid,
      ss.approvalstatus,
      ss.ascensionid,
      ts.processing_date,
      br.name AS samplingCenter,
      b.billingid,
      np.GENDER AS gender,
      np.mobile_number AS mobilenumber,
      r.employeeid,
      ts.testid,
      r.USERNAME AS phelobotomist,
      np.GENDER AS gender,
      CASE
        WHEN np.MIDDLENAME IS NULL THEN  CONCAT(np.FIRSTNAME," ",np.LASTNAME)
        WHEN np.MIDDLENAME IS NOT NULL THEN  CONCAT(np.FIRSTNAME, ' ', np.MIDDLENAME, ' ', np.LASTNAME)
      END AS clientname,
      CONCAT(np.age," ",np.agetype) AS age
      FROM test_ascension AS ts
      INNER JOIN billing  AS b ON ts.billingid = b.billingid
      INNER JOIN new_patients AS np ON np.patientid = b.patientid
      INNER JOIN samplestatus AS ss ON ss.billingid = b.billingid
      INNER JOIN roles AS r ON r.employeeid = ss.phelobotomist
      INNER JOIN branch AS br ON br.branchid = b.branchid
      where ts.billingid = ? AND ts.testid = ? GROUP BY ts.billingid LIMIT 1
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
      logger.error(err);
    }
  };

  get_summary_ready_page = async (request, response) => {
    const { querydate, content } = request.query;

    const query = `SELECT 
        pt.billedon,
        pt.billingid,
        tt.collection,
        (SELECT COUNT(*) FROM billing WHERE DATE(billedon) = ?) AS registered,
        tt.ready,
        tt.collection_date,
        tt.processing,
        tt.testid,
        tt.ApprovalStatus
          FROM billing AS pt
        INNER JOIN test_ascension AS tt ON tt.billingid = pt.billingid
        WHERE DATE(pt.billedon) = ?
       `;

    function getTodayDate() {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, "0");
      const day = String(currentDate.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    try {
      const result = await promisifyQuery(query, [querydate || getTodayDate(), querydate || getTodayDate()])
      if (result && result.length > 0) {
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
        const testcount = result.length;
        response.send([{ title: "registered clients", value: result[0]?.["registered"], },
        { title: 'test count', value: testcount }, { title: "samples collected ", value: collection, },
        { title: "processed test", value: processing, }, { title: "test ready ", value: ready, },
        { title: "Approved test", value: approval, },
        ]);
      } else { response.send(emptySummry) }
    } catch (err) {
      logger.error(err);
      customError('error occured', 500, response);
    }
  }


  getSamplingInformation = async (billing, testid) => {
    try {
      const sampling = await promisifyQuery(samplingQuery, [billing, testid]);
      return sampling;
    } catch (err) {
      logger.error(err);
    }
  }

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

      connection.beginTransaction(async function (err) {
        if (err) { logger.error(err); }
        try {
          let sampling = await new ResultPrint().getSamplingInformation(billingid, testid);
          let resultQueryResult = await promisifyQuery(resultQuery, billingid);
          responseResult.sampling = sampling;
          responseResult.result = resultQueryResult;
          responseResult.category = category
          response.send(responseResult);
        }
        catch (err) {
          logger.error(err);
          console.log(err)
          connection.rollback();
        }
      })
    } else {
      response.send({
        statusCode: 401,
        status: "error",
      });
    }
  };

  resultPreviewHematological = async function (request, response) {
    const { billingid, testid, test } = request.query;

    let responseResult = { sampling: [], result: [] };
    const category = testCategoryMapping[test];

    const dbTable = MappingSetup[test];

    if (typeof dbTable != undefined && billingid && testid && test && category == "hema") {
      let query = mappWithBilingid(dbTable, billingid);

    connection.beginTransaction(async function (err) {
      if (err) { logger.error(err); }
      try {
        const result = await promisifyQuery(query);
          responseResult.result = result;
          const sampling = await promisifyQuery(samplingQuery, [billingid, testid]);
          responseResult.sampling = sampling;
          responseResult.testcategory = category;

          if (retrieve === false || retrieve == undefined) {
            response.status(200).json(responseResult); // Send the response to the client
          } else { return responseResult }
        } catch (err) {
          logger.error(err);
          connection.rollback();
        }
      });
    } else {
    response.send({ statusCode: 401, status: "error", message: "include all necessary details", });
    }
  };

  getComments = async function (billingid, testid, response) {
    try {
      const result = await promisifyQuery(`SELECT * FROM result_comments WHERE BILLINGID = ? AND TESTID = ? `,
        [billingid, testid])
      if (response) { response.send({ status: 'success', statusCode: 200, result }) } else { return result }
    } catch (err) {
      logger.error(err);
      if (response) { customError('error occured', 500, response); } else { return err }
    }
  };

  // this function would update the  test ascension table using the client blling id as to whether the result is approved or declined
  // decison query in the request is used here 
  makeDecisionOnResult = async function (request, response) {
    const { billingid, testid, decision, message } = request.body;
    // update query to change approval status 
    let updateQuery = `UPDATE test_ascension 
    SET approvalstatus = true ,
    approvedby = ?  WHERE billingid = ? AND testid = ?`;
    if (decision == 'decline') {
      const { declineMessage, actionplan } = message;
      if (declineMessage && actionplan) {
        updateQuery = `UPDATE test_ascension
          SET approvalStatus = 0,
          declineMessage ='${declineMessage}',
          actionPlan = '${actionplan}',
          approvedby = ?  WHERE billingid = ? AND testid = ?`
      }
    }
    try {
      const queryResult = await promisifyQuery(updateQuery, [1, billingid, testid]);
      const { affectedRows } = queryResult;
      affectedRows == 1 ?
        response.send({ status: 'success', statusCode: 200, message: 'update successful' })
        :
        response.send({ status: 'error', statusCode: 401, message: 'error updating data' })
    } catch (err) {
        logger.error(err);
    customError('error occured', 500, response);
  }
  }

  checkApproval = async function (billingid, testid, response) {
    const q = `SELECT approvalstatus FROM test_ascension WHERE billingid = ? AND testid = ?`;
    try {
      const result = await promisifyQuery(q, [billingid, testid]);
      if (result && result.length > 0) {
        const { approvalstatus } = result[0];
        const approved = approvalstatus === 1 ? true : false;
        if (response) {response.send({approved})} else {return approved}
      } else {
        if (response) {response.send({approved:false})} else {return false}
      }
    } catch {
      logger.error(err);
      if (response) { response.send({ status: 'error', statusCode: 500, message: 'error occured in checking printing status' }) }
      else { return false }
    }
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
