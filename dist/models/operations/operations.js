"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const helper_1 = require("../../../helper");
class Operations {
    constructor(billingid) {
        this.initiateTestProcessing = async (testid, billingid) => {
            const is_updated = await (0, helper_1.promisifyQuery)(queries_1.q_startProcessingTest, [billingid, testid]);
            return (0, helper_1.rowAffected)(is_updated);
        };
        this.logResultEntry = async (testid, billingid) => {
            // update test ascension table with the testid, datetime and the billing id and ready = true and ready_date = NOW()
            const isResultEntryLogged = await (0, helper_1.promisifyQuery)(queries_1.q_log_result_entry, [billingid, testid]);
            return (0, helper_1.rowAffected)(isResultEntryLogged);
        };
        this.getAllTestPreview = async function (billingid) {
            if (billingid) {
                const alltest = await (0, helper_1.promisifyQuery)(queries_1.q_get_all_test_preview, [billingid]);
                return alltest;
            }
        };
        this.billingid = billingid;
    }
    async isvalidBillingid() {
        const result = await (0, helper_1.promisifyQuery)(queries_1.q_checkbillingid, [this.billingid]);
        return result.length === 0;
    }
    async readyforTest() {
        const validId = await this.isvalidBillingid();
        if (!validId) {
            return "Invalid billingid";
        }
        if (validId) {
            const result = await (0, helper_1.promisifyQuery)(queries_1.q_approved_samples, [this.billingid]);
            return !(result.length === 0);
        }
    }
    async getLaboratoryTestReadyForResultEntry(departmentid) {
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
        return await (0, helper_1.promisifyQuery)(queryString, values);
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
        return await (0, helper_1.promisifyQuery)(queryString, values);
    }
    async getAllCasesResultEntryByMany(requestQuery) {
        const { fullname, count = 10, page = 1, departmentid, testid, status, from, to } = requestQuery;
        try {
            let query = queries_1.q_get_all_result_entry;
            const values = [];
            const conditions = [];
            if (fullname) {
                conditions.push(`CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ?`);
                values.push(`${fullname}%`);
            }
            if (departmentid && departmentid !== "all") {
                conditions.push(`tp.category = ?`);
                values.push(departmentid);
            }
            if (status === "completed") {
                conditions.push(`ta.ready = 'true'`);
            }
            else if (status === "pending") {
                conditions.push(`ta.ready = 'false'`);
            }
            if (testid && !isNaN(testid)) {
                conditions.push(`ta.testid = ?`);
                values.push(testid);
            }
            if (from && to) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                values.push(from, to);
            }
            else if (from) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
                values.push(from);
            }
            if (conditions.length > 0) {
                query += ` AND ${conditions.join(" AND ")}`;
            }
            query += `
      ORDER BY b.billingid DESC
      LIMIT ? OFFSET ?
    `;
            return await (0, helper_1.paginationQuery)({ count, page }, query, values);
        }
        catch (err) {
            throw err;
        }
    }
    async getAllEnterResult(data) {
        const { from, to, patientid, billingid, sortingwise, count, page } = data;
        let queryString = queries_1.q_get_all_entered_result;
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
        let result = await (0, helper_1.promisifyQuery)(queryString);
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
                    const test_outcome = await (0, helper_1.promisifyQuery)(getTestQuery, [parseInt(billingid)]);
                    item.testMap = test_outcome;
                }
                return item;
            }));
        }
        return result;
    }
    async getUltrasoundWaitingList(data) {
        const { count = 10, page = 1 } = data;
        const result = await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_ultrasound_waitingList);
        return result;
    }
    async processedScanList(data) {
        try {
            const { from, to, search, count = 10, page = 1 } = data;
            const values = [];
            const conditions = [`d.department = 'ultrasound'`, `ta.ready = 'true'`];
            if (from) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                values.push(from, to || "CURRENT_DATE");
            }
            if (search) {
                conditions.push(`(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ? OR np.MOBILE_NUMBER = ?)`);
                values.push(`%${search}%`, search);
            }
            let whereClause = "";
            if (conditions.length > 0) {
                whereClause = "WHERE " + conditions.join(" AND ");
            }
            const query = queries_1.q_ultrasound_processed_list;
            values.unshift(whereClause);
            return await (0, helper_1.paginationQuery)({ count, page }, query, values);
        }
        catch (err) {
            throw new Error(err);
        }
    }
}
exports.default = Operations;
