"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const { customError, promisifyQuery, paginationQuery, responseError, rowAffected } = require("../../helper");
const logger = require("../../logger");
const connection = require("../db");
class Operations {
    constructor(billingid) {
        this.initiateTestProcessing = async (testid, billingid) => {
            return await promisifyQuery(queries_1.q_startProcessingTest, [billingid, testid]);
        };
        this.logResultEntry = async (testid, billingid) => {
            // update test ascension table with the testid, datetime and the billing id and ready = true and ready_date = NOW()
            const isResultEntryLogged = await promisifyQuery(queries_1.q_log_result_entry, [billingid, testid]);
            return rowAffected(isResultEntryLogged);
        };
        this.getAllTestPreview = async function (request, response) {
            const { billingid } = request.query;
            if (billingid) {
                const queryString = `
            SELECT ta.testid,
            tp.NAME,
            ta.billingid,
            tp.CATEGORY,
            ta.processing,
            ta.processing_date,
            ta.ready,
            ta.ready_date
          FROM test_ascension as ta
            INNER JOIN test_panels as tp ON ta.testid = tp.ID
            INNER JOIN departments AS d ON d.id = tp.CATEGORY
          WHERE ta.billingid = ${billingid}
      `;
                connection.query(queryString, (err, result) => {
                    if (err) {
                        customError(err.message, 500);
                    }
                    else {
                        response.send({
                            statusCode: 200,
                            result,
                            status: "success",
                        });
                    }
                });
            }
            else {
                customError("billingid is required", 400);
            }
        };
        this.billingid = billingid;
    }
    async isvalidBillingid() {
        const result = await promisifyQuery(queries_1.q_checkbillingid, [this.billingid]);
        return result.length === 0;
    }
    async readyforTest() {
        const validId = await this.isvalidBillingid();
        if (!validId) {
            return "Invalid billingid";
        }
        if (validId) {
            const result = await promisifyQuery(queries_1.q_approved_samples, [this.billingid]);
            return !(result.length === 0);
        }
    }
    async getLaboratoryBillReadyForResultEntry(departmentid) {
        const certified = await this.readyforTest();
        if (!certified)
            return "billingid  not ready for result entry" /* OperationsFailures.notready */;
        if (!departmentid || (typeof departmentid == "string" && departmentid != "all")) {
            throw new Error("departmentid not provided or wrong format provided");
        }
        const values = [];
        let queryString = queries_1.q_billing_test_collection;
        if (typeof departmentid == "number") {
            queryString += ` AND tp.category =  ?`;
            values.push(departmentid);
        }
        queryString += ` AND ta.collection = 'true' AND ta.ready='false'  AND d.department <> 'ultrasound' `;
        return await promisifyQuery(queryString, values);
    }
    async getAllQualifiedToProcessByDepartment(category, count, page) {
        //  we want to return all test whose sample was approved and ready to be processed
        let queryString = queries_1.q_qualifiedToProcessByDepartment;
        const values = [];
        if (category != "all") {
            queryString += ` AND tp.category = ?`;
            values.push(category);
        }
        values.push(count);
        values.push(page - 1 * count);
        queryString += ` AND ta.collection = 'true' AND ta.ready='false' AND d.department <> 'ultrasound' 
    GROUP BY np.patientid ORDER BY b.billingid ASC LIMIT ? OFFSET ?`;
        return await promisifyQuery(queryString, values);
    }
    async getAllCasesResultEntryByMany(requestQuery) {
        const { fullname, count, page, department, testid, status, from, to } = requestQuery;
        try {
            let query = queries_1.q_get_all_result_entry;
            const values = [];
            if (fullname) {
                query += ` CONCAT( np.firstname,' ',np.middlename,' ',np.lastname) LIKE ??`;
                values.push(`${fullname}%`);
            }
            if (department) {
                if (department == "all") {
                    query = query;
                }
                else {
                    query += ` AND d.id = ?`;
                    values.push(department);
                }
            }
            if (status === "completed") {
                query += ` AND ta.ready='true'`;
            }
            else if (status === "pending") {
                query += ` AND ta.ready='false'`;
            }
            else {
                query = query;
            }
            if (testid && !isNaN(testid)) {
                query += ` AND ta.testid = ?`;
                values.push(testid);
            }
            if (from && !to) {
                query += ` AND DATE(b.billedon) BETWEEN ?? AND CURRENT_DATE`;
                values.push(from);
            }
            else if (from && to) {
                query += ` AND DATE(b.billedon) BETWEEN ?? AND  ??`;
                values.push(from);
                values.push(to);
            }
            else {
                query = query;
            }
            query += ` ORDER BY b.billingid DESC
    LIMIT ? OFFSET ?`;
            return await paginationQuery({ count, page }, query, values);
        }
        catch (err) {
            throw err;
        }
    }
    async getAllEnterResult(data) {
        const { from, to, patientid, billingid, sortingwise, count, page } = data;
        let queryString = `SELECT  CONCAT(  np.FIRSTNAME,
                  ' ',
                  np.MIDDLENAME,
                  ' ',
                  np.LASTNAME) AS fullname,
                np.PATIENTID AS patientid,
                np.gender,
                b.BILLINGID AS billingid,
                b.billedon AS billing_date,
                tp.CATEGORY AS category
              FROM new_patients as np
                INNER JOIN billing as b ON np.PATIENTID = b.PATIENTID
                INNER JOIN samplestatus AS ss ON ss.billingid = b.BILLINGID
                INNER JOIN test_ascension AS ta ON ta.billingid = b.BILLINGID
                INNER JOIN test_panels AS tp ON tp.ID = ss.testid
                INNER JOIN departments AS d ON d.ID = tp.CATEGORY
            `;
        queryString += ` WHERE ss.approvalstatus = 1 AND d.department <> 'ultrasound'`;
        if (from && !to) {
            queryString += ` AND DATE(b.billedon) BETWEEN '${from}' AND CURRENT_DATE`;
        }
        else if (from && to) {
            queryString += ` AND DATE(b.billedon) BETWEEN '${from}' AND  '${to}'`;
        }
        else {
            queryString = queryString;
        }
        if (patientid) {
            queryString += ` AND np.PATIENTID = ${patientid}`;
        }
        if (billingid) {
            queryString += ` AND b.billingid = ${billingid}`;
        }
        queryString += ` GROUP BY b.billingid DESC LIMIT 30`;
        let result = await promisifyQuery(queryString);
        if (result.length > 0) {
            const getTestQuery = ` SELECT ta.testid,
                          tp.name,
                          ta.billingid,
                          tp.category,
                          ta.processing,
                          ta.processing_date,
                          ta.ready,
                          ta.ready_date
                        FROM test_ascension as ta
                          INNER JOIN test_panels as tp ON ta.testid = tp.id
                          INNER JOIN departments AS d ON d.id = tp.category
       WHERE ta.billingid = ?`;
            result = await Promise.all(result.map(async (item, index) => {
                const { billingid } = item;
                if (billingid) {
                    const test_outcome = await promisifyQuery(getTestQuery, [parseInt(billingid)]);
                    item.testMap = test_outcome;
                }
                return item;
            }));
        }
        return result;
    }
    async getUltrasoundWaitingList(data) {
        const { count = 10, page = 1 } = data;
        const queryString = ` 
    SELECT DISTINCT
          np.patientid,
          b.billingid,
          CONCAT( np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
          b.billedon,
          tp.name,
          tp.id AS testid,
          tp.category,
          d.department
  FROM new_patients as np
    INNER JOIN billing as b ON np.patientid = b.patientid
    INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
    INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
    INNER JOIN test_panels AS tp ON tp.id = ta.testid
    INNER JOIN departments AS d ON d.id = tp.category
  WHERE  d.department = 'ultrasound' AND ta.ready = 'false' LIMIT ? OFFSET ?`;
        const result = await paginationQuery({ count, page }, queryString);
        return result;
    }
    async processedScanList(request, response) {
        try {
            const { count = 10, page = 1 } = request.query;
            const { from, to, search } = request.query;
            let query = `
      SELECT DISTINCT
          np.patientid,
          b.billingid,
          CONCAT( np.firstname,' ',np.middlename,' ',np.lastname) AS fullname,
          b.billedon,
          tp.name,
          tp.id AS testid,
          tp.category,
          ta.ready,
          d.department
    FROM new_patients as np
          INNER JOIN billing as b ON np.PATIENTID = b.patientid
          INNER JOIN test_ascension AS ta ON ta.billingid = b.billingid
          INNER JOIN samplestatus AS ss ON ss.ascensionid = ta.id
          INNER JOIN test_panels AS tp ON tp.id = ta.testid
          INNER JOIN departments AS d ON d.id = tp.CATEGORY
    WHERE  d.department = 'ultrasound' AND ta.ready ='true'
      `;
            const values = [];
            if (from && to) {
                query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                values.push(`${from}`);
                values.push(`${to}`);
            }
            else if (from && !to) {
                query += `  AND DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`;
                values.push(`${from}`);
            }
            else {
                query = query;
            }
            if (search) {
                query += ` AND (CONCAT(np.firstname," ",np.middlename," ",np.lastname) LIKE ? 
        OR np.MOBILE_NUMBER = ?)`;
                values.push(`%${search}%`);
                values.push(search);
            }
            if (!from && !to) {
                query += ` ORDER BY b.BILLINGID ASC  LIMIT ? OFFSET ?`;
            }
            console.log(values);
            const result = await paginationQuery({ count, page }, query, values);
            response.send({ result, statusCode: 200, status: "success" });
        }
        catch (err) {
            console.log(err);
            responseError(response);
        }
    }
}
module.exports = Operations;
