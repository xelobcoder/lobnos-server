"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const partitioning_1 = __importDefault(require("../billing/partitioning"));
const helper_1 = require("../../hooks/helper");
const testApprovalClass_1 = require("./testApprovalClass");
class Operations {
    constructor(billingid) {
        this.logResultEntryIntoAscensionTable = async (tenantId, testid, billingid) => {
            const isResultEntryLogged = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_log_result_entry, [billingid, testid]);
            return (0, helper_1.rowAffected)(isResultEntryLogged);
        };
        this.getAllTestPreview = async function (tenantId, billingid) {
            try {
                if (billingid) {
                    const alltest = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_all_test_preview, [billingid]);
                    return alltest;
                }
            }
            catch (error) {
                throw error;
            }
        };
        this.billingid = billingid;
    }
    async isvalidBillingid(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_checkbillingid, [this.billingid]);
        return result.length === 0;
    }
    async readyforTest(tenantId) {
        const validId = await this.isvalidBillingid(tenantId);
        if (!validId) {
            return "Invalid billingid";
        }
        if (validId) {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_approved_samples, [this.billingid]);
            return !(result.length === 0);
        }
    }
    async getLaboratoryTestReadyForResultEntry(tenantId, departmentid, branchid) {
        const certified = await this.readyforTest(tenantId);
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
        return await (0, helper_1.promisifyQuery)(tenantId, queryString, values);
    }
    async getAllQualifiedToProcessByDepartment(tenantId, category, count, page, branchid) {
        try {
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
            return await (0, helper_1.promisifyQuery)(tenantId, queryString, values);
        }
        catch (error) {
            throw error;
        }
    }
    async getAllCasesResultEntryByMany(tenantId, requestQuery) {
        const { fullname, count = 10, page = 1, departmentid, testid, status, from, to, billingid, branchid } = requestQuery;
        try {
            var { conditions, finalQuery } = await Operations.generateAscensionQuery({ from, to, stage: null, searchString: null, isUltrasound: false, organizationId: null, clinicianId: null });
            if (fullname) {
                conditions.push(`CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ?`);
            }
            if (departmentid && departmentid !== "all") {
                conditions.push(`tp.category = ?`);
                // values.push(departmentid);
            }
            if (testid && !isNaN(testid)) {
                conditions.push(`ta.testid = ?`);
                // values.push(testid);
            }
            if (from && to) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                // values.push(from, to);
            }
            else if (from) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
                // values.push(from);
            }
            if (billingid) {
                conditions.push(`b.billingid = ?`);
                // values.push(billingid);
            }
            if (conditions.length > 0) {
                finalQuery += ` AND ${conditions.join(" AND ")} `;
            }
            finalQuery += `
					ORDER BY b.billingid DESC
					LIMIT ? OFFSET ?
				`;
            return await (0, helper_1.paginationQuery)({ count, page }, finalQuery, [], tenantId);
        }
        catch (err) {
            throw err;
        }
    }
    static async generateAscensionQuery(queryParams) {
        const { from, to, searchString, isUltrasound, stage, clinicianId, organizationId } = queryParams;
        const startDate = new Date(from) || new Date();
        const enddate = new Date(to) || new Date();
        try {
            let finalQuery;
            const conditions = [];
            finalQuery = replaceQueryValuesNonPartition(finalQuery);
            if (!isUltrasound) {
                finalQuery = (0, queries_1.q_get_all_test_ready_for_various_stages)(finalQuery, stage);
            }
            else {
                finalQuery = (0, queries_1.q_get_all_test_ready_for_various_stages_ultrasound)(finalQuery, stage);
            }
            finalQuery = finalQuery + ` AND DATE(ascension_date) >= ? AND DATE(ascension_date ) <= ? `;
            conditions.push(startDate);
            conditions.push(enddate);
            if (searchString) {
                finalQuery += ` AND (CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname) LIKE ? 
				OR np.patientid LIKE ? 
				OR tp.category LIKE ? 
				OR b.billedon LIKE ? 
				OR d.department LIKE ? 
				OR tp.name LIKE ? 
				OR b.clientstatus LIKE ?)`;
                const searchTerm = `%${searchString}%`;
                conditions.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            }
            if (clinicianId) {
                finalQuery += ` AND ds.clinicianId = ?`;
                conditions.push(clinicianId);
            }
            if (organizationId) {
                finalQuery += ` AND ds.organizationId = ?`;
                conditions.push(organizationId);
            }
            console.log(finalQuery);
            return { conditions, finalQuery };
        }
        catch (err) {
            return null;
        }
        function replaceQueryValuesNonPartition(finalQuery) {
            finalQuery = isUltrasound === true ? queries_1.q_get_all_result_entry_ultrasound_base : queries_1.q_get_all_result_entry_base;
            return finalQuery;
        }
    }
    async getBillCompletedTest(tenantId, billingid) {
        if (billingid) {
            const test_outcome = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_entered_result_part, [billingid]);
            return test_outcome;
        }
    }
    async getAllEnterResult(tenantId, data) {
        try {
            const { from, to, patientid, billingid, fullname, sortingwise, count, page } = data;
            let queryString = queries_1.q_get_all_entered_result;
            const conditions = [];
            const values = [];
            conditions.push(`ss.approvalstatus = 1`);
            conditions.push('dta.isapproved = 1');
            if (from && !to) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
                values.push(from);
            }
            else if (from && to) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                values.push(from, to);
            }
            if (patientid) {
                conditions.push(`np.patientid = ?`);
                values.push(patientid);
            }
            if (billingid) {
                conditions.push(`b.billingid = ?`);
                values.push(billingid);
            }
            if (fullname) {
                conditions.push(`LOWER(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname)) LIKE ?`);
                values.push(`%${fullname.toLowerCase()}%`);
            }
            if (conditions.length > 0) {
                queryString += ` WHERE ${conditions.join(" AND ")}`;
            }
            queryString += ` GROUP BY tr.ascensionid, tr.testid, tr.patientid, b.billingid`;
            queryString += ` ORDER BY tr.created_on ${sortingwise === "ASC" ? "ASC" : "DESC"}`;
            queryString += ` LIMIT ? OFFSET ?`;
            const result = await (0, helper_1.paginationQuery)({ page, count }, queryString, values, tenantId);
            if (result.length > 0) {
                const approvalList = await Promise.all(result.map(async (item) => {
                    const { ascensionid } = item;
                    const ascensionApprovalEmployeeList = await new testApprovalClass_1.TestApprovalClass(ascensionid).getAscensionAprovedListDetails(tenantId);
                    console.log("Approval List: ", ascensionApprovalEmployeeList);
                    return Object.assign(Object.assign({}, item), { validators: ascensionApprovalEmployeeList });
                }));
                return approvalList;
            }
            return [];
        }
        catch (err) {
            console.log(err);
        }
    }
    async getUltrasoundWaitingList(tenantId, data) {
        const { count = 10, page = 1 } = data;
        const result = await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_ultrasound_waitingList, [], tenantId);
        return result;
    }
    static async getAscensionBasedOnStage(tenantId, queryParams) {
        try {
            const { _dateEnd, _dateFrom, stage, searchString, page, count, isUltrasound, sortby, clinicianId, organizationId } = queryParams;
            let query;
            let conditionValues = [];
            if (_dateFrom && _dateEnd) {
                const { finalQuery, conditions: conditionx } = await Operations.generateAscensionQuery({
                    sortby, from: _dateFrom, to: _dateEnd, stage,
                    searchString, isUltrasound, clinicianId, organizationId
                });
                query = finalQuery;
                conditionValues = conditionx;
            }
            if (query == null)
                return null;
            query += ` GROUP BY ta.id ORDER BY ta.id {sorting} LIMIT ? OFFSET ? `;
            query = query.replace('{sorting}', sortby === 'ASC' ? 'ASC' : 'DESC');
            return await (0, helper_1.paginationQuery)({ count, page }, query, conditionValues, tenantId);
        }
        catch (err) {
            if (err.errno === 1146 && err.code === "ER_NO_SUCH_TABLE" || err.code === "ER_PARTITION_CLAUSE_ON_NONPARTITIONED") {
                await new partitioning_1.default('billing', 'billing').addYearPartition(tenantId, new Date().getFullYear());
                await new partitioning_1.default('test_ascension', 'asc').addYearPartition(tenantId, new Date().getFullYear());
            }
            return [];
        }
    }
}
exports.default = Operations;
