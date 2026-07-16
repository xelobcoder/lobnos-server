"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
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
        return undefined;
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
            var { conditions, finalQuery } = await Operations.generateAscensionQuery({ from, to, stage: null, isUltrasound: false, organizationId: null, clinicianId: null });
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
    static async getAscensionOverViewModel(tenantid, filters) {
        try {
            const params = [];
            let whereConditions = `WHERE (d.department IS NULL OR LOWER(d.department) <> 'ultrasound') AND rf.isRefundCompleted = 0 AND dbo.status <> 'voided' AND dbo.status <> 'refunded'`;
            if ((filters === null || filters === void 0 ? void 0 : filters._dateFrom) && filters._dateFrom !== "all") {
                whereConditions += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                params.push(filters._dateFrom);
                params.push(filters._dateEnd);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.billingid) {
                whereConditions += ` AND b.billingid = ?`;
                params.push(filters.billingid);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.patientid) {
                whereConditions += ` AND p.patientid = ?`;
                params.push(filters.patientid);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.testname) {
                whereConditions += ` AND tp.id = ?`;
                params.push(filters.testname);
            }
            if (filters === null || filters === void 0 ? void 0 : filters.patientname) {
                whereConditions += ` AND REGEXP_REPLACE(
					LOWER(CONCAT_WS(' ', p.firstname, p.middlename, p.lastname)),
					'[[:space:]]+',
					' '
					) LIKE ?`;
                params.push(`%${filters.patientname.toLowerCase().trim().replace(/\s+/g, " ")}%`);
            }
            const query = `
									SELECT 
						p.patientid,
						CONCAT(
							p.fullpatientid, ' | ',
							p.firstname, ' ', p.lastname, ' | ',
							p.gender, ' | ',
							p.age, ' ', p.agetype
						) AS patient_details,

						b.billingid,
						b.billedon,
						b.clientstatus AS payment_status,
						MIN(ta.ascension_date) AS ascension_date,
						COUNT(ta.id) AS total_tests,

						GROUP_CONCAT(
							DISTINCT CONCAT(
								COALESCE(tp.name, CONCAT('Test-', ta.testid)),
								' (',
								CASE
									WHEN ta.resultEntryEnd IS NOT NULL 
										THEN CONCAT('Completed @ ', DATE_FORMAT(ta.resultEntryEnd, '%h:%i %p'))

									WHEN ta.processingEndDate IS NOT NULL 
										THEN CONCAT('Processing Done @ ', DATE_FORMAT(ta.processingEndDate, '%h:%i %p'))

									WHEN ta.collectionEndDate IS NOT NULL 
										THEN CONCAT('Collected @ ', DATE_FORMAT(ta.collectionEndDate, '%h:%i %p'))

									WHEN ta.collectionStartDate IS NOT NULL 
										THEN CONCAT('Collection Started @ ', DATE_FORMAT(ta.collectionStartDate, '%h:%i %p'))

									ELSE 'Pending'
								END,
								')'
							)
							ORDER BY tp.name
							SEPARATOR ', '
						) AS tests_with_stage

						FROM billing b

						JOIN new_patients p 
						ON p.patientid = b.patientid

						JOIN test_ascension ta 
						ON ta.billingid = b.billingid

						LEFT JOIN test_panels tp 
						ON tp.id = ta.testid

						LEFT JOIN departments d
						ON d.id = tp.category

						LEFT JOIN dbobillingrefundtable rf
						ON rf.serviceid = ta.serviceid

						LEFT JOIN dboservices AS dbo ON dbo.serviceid = ta.serviceid

						${whereConditions}

						GROUP BY 
						p.patientid,
						p.fullpatientid,
						p.firstname,
						p.lastname,
						p.gender,
						p.age,
						p.agetype,
						b.billingid,
						b.billedon,
						b.clientstatus

						ORDER BY 
						b.billingid DESC;
		`;
            return await (0, helper_1.promisifyQuery)(tenantid, query, params);
        }
        catch (err) {
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || "Error fetching ascension overview model");
        }
    }
    static async getAscensionOverViewModelTransaction(tenantid, billingid) {
        try {
            const query = `
							SELECT 
							ta.id AS ascension_id,

							ta.testid,
							COALESCE(tp.name, CONCAT('Test-', ta.testid)) AS test_name,

							ta.serviceid,
							ta.billingid,

							ta.ascension_date,

							ta.collectionStartDate,
							ta.collectionEndDate,
							ta.processingStartDate,
							ta.processingEndDate,
							ta.resultEntryStart,
							ta.resultEntryEnd,

							rdp.requested_mode,
							rdl.delivered_mode,
							rdl.delivered_at,
							rrd.username AS delivered_by_name,
							rdl.notes as delivery_notes,

							rr.username AS collected_by_name,
							vv.username AS processed_by_name,
							ee.username AS result_entered_by_name,

							-- 🔬 SAMPLE STATUS
							ss.keyid AS sample_status_id,
							ss.approvalstatus,
							ss.rejectionmessage,
							ss.isRedraw,
							ss.samplevalidatedon,

							CASE
								WHEN ss.approvalstatus = 1 THEN 'Validated'
								WHEN ss.rejectionmessage IS NOT NULL THEN 'Rejected'
								WHEN ss.isRedraw = 1 THEN 'Redraw Requested'
								WHEN ss.keyid IS NOT NULL THEN 'Pending Validation'
								ELSE 'No Sample'
							END AS sample_validation_stage,

							-- 🧪 RESULT VALIDATION
							ra.id AS result_approval_id,
							ra.isapproved,
							ra.approvedBy,
							ra.printCount,
							ra.minvalidation,
							ra.maxvalidation,
							ra.lastupdatedon,

							CASE
								WHEN ra.isapproved = 1 THEN 'Approved'
								WHEN ra.id IS NOT NULL THEN 'Pending Approval'
								ELSE 'No Result Yet'
							END AS result_validation_stage,

							-- 🔬 TEST WORKFLOW
							CASE
								WHEN ta.resultEntryEnd IS NOT NULL THEN 'Completed'
								WHEN ta.processingEndDate IS NOT NULL THEN 'Processing Done'
								WHEN ta.collectionEndDate IS NOT NULL THEN 'Collected'
								WHEN ta.collectionStartDate IS NOT NULL THEN 'Collection Started'
								ELSE 'Pending'
							END AS current_stage

							FROM test_ascension ta

							LEFT JOIN dboservices AS trx ON trx.serviceid = ta.serviceid
							LEFT JOIN dbobillingrefundtable AS ddd ON ddd.serviceid = ta.serviceid
						
							LEFT JOIN test_panels tp 
							ON tp.id = ta.testid

							LEFT JOIN departments d
							ON d.id = tp.category

							LEFT JOIN roles rr 
							ON rr.employeeid = ta.sampleCollectedBy

							LEFT JOIN roles vv
							ON vv.employeeid = ta.sampleProcessedBy

							LEFT JOIN roles ee
							ON ee.employeeid = ta.resultEnteredBy

							LEFT JOIN samplestatus ss
							ON ss.ascensionid = ta.id

							LEFT JOIN dbotestresultapproval ra
							ON ra.ascensionid = ta.id


							LEFT JOIN result_delivery_log AS rdl
							ON ss.ascensionid = rdl.ascensionid

							LEFT JOIN patient_result_delivery_preference AS rdp
							ON ss.ascensionid = rdp.ascension
							
							LEFT JOIN roles AS rrd
							ON rrd.employeeid = rdl.delivered_by_employeeid

							WHERE ta.billingid = ?
							AND (d.department IS NOT NULL AND LOWER(d.department) <> 'ultrasound')
							AND (trx.isDeleted = 0 OR trx.isDeleted IS NULL) AND ddd.isRefundCompleted <> 1
							ORDER BY 
							ta.id ASC,
							ss.keyid ASC,
							ra.id ASC;`;
            return await (0, helper_1.promisifyQuery)(tenantid, query, [billingid]);
        }
        catch (err) {
            console.log(err);
            throw new Error((err === null || err === void 0 ? void 0 : err.message) || "Error fetching ascension overview model transaction details");
        }
    }
    static async generateAscensionQuery(queryParams) {
        const { from, to, isUltrasound, stage, clinicianId, organizationId, patientname, testid, patientid, billingid, ascensionid } = queryParams;
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
            if (from && to) {
                finalQuery = finalQuery + ` AND DATE(ta.ascension_date) BETWEEN ? AND ? `;
                conditions.push(new Date(from));
                conditions.push(new Date(to));
            }
            // Priority filters: patientid > billingid > ascensionid
            if (patientid) {
                finalQuery += ` AND np.patientid = ?`;
                conditions.push(patientid);
            }
            if (billingid) {
                finalQuery += ` AND b.billingid = ?`;
                conditions.push(billingid);
            }
            if (ascensionid) {
                // we can have multiple ascensionid like 33,34,35,36,37,414,1387  or just a single number
                const isMultipleAscensionIds = typeof ascensionid === 'string' && ascensionid.includes(',');
                if (isMultipleAscensionIds) {
                    finalQuery += ` AND ta.id IN (${ascensionid})`;
                }
                else {
                    finalQuery += ` AND ta.id = ?`;
                    conditions.push(ascensionid);
                }
            }
            if (testid && (testid != null || testid != undefined) && !isNaN(testid)) {
                finalQuery += ` AND ta.testid = ?`;
                conditions.push(testid);
            }
            if (patientname) {
                finalQuery += `
				AND REGEXP_REPLACE(
					LOWER(CONCAT_WS(' ', np.firstname, np.middlename, np.lastname)),
					'[[:space:]]+',
					' '
					) LIKE ?
				`;
                conditions.push(`%${patientname.toLowerCase().trim().replace(/\s+/g, " ")}%`);
            }
            if (clinicianId) {
                finalQuery += ` AND ds.clinicianId = ?`;
                conditions.push(clinicianId);
            }
            if (organizationId) {
                finalQuery += ` AND ds.organizationId = ?`;
                conditions.push(organizationId);
            }
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
            const { from, to, patientid, billingid, fullname, sortingwise, count, page, mobile_number, ascensionid } = data;
            let queryString = queries_1.q_get_all_entered_result;
            const conditions = [];
            const values = [];
            conditions.push(`ss.approvalstatus = 1`);
            conditions.push('dta.isapproved = 1');
            if (patientid && !isNaN(patientid)) {
                conditions.push(`np.patientid = ?`);
                values.push(parseInt(patientid.toString()));
            }
            if (billingid) {
                conditions.push(`b.billingid = ?`);
                values.push(billingid);
            }
            if (ascensionid) {
                conditions.push(`ta.id = ?`);
                values.push(ascensionid);
            }
            if (mobile_number) {
                conditions.push(`np.mobile_number LIKE ?`);
                values.push(`%${mobile_number}%`);
            }
            if (fullname) {
                conditions.push(`LOWER(CONCAT(np.firstname, ' ', np.middlename, ' ', np.lastname)) LIKE ?`);
                values.push(`%${fullname.toLowerCase()}%`);
            }
            if (from && !to) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND CURRENT_DATE`);
                values.push(from);
            }
            else if (from && to) {
                conditions.push(`DATE(b.billedon) BETWEEN ? AND ?`);
                values.push(from, to);
            }
            if (conditions.length > 0) {
                queryString += ` WHERE ${conditions.join(" AND ")}`;
            }
            queryString += ` GROUP BY ta.id, ta.testid, np.patientid, b.billingid`;
            queryString += ` ORDER BY ta.ascension_date ${sortingwise === 'ASC' ? 'ASC' : 'DESC'}`;
            queryString += ` LIMIT ? OFFSET ?`;
            const result = await (0, helper_1.paginationQuery)({ page, count }, queryString, values, tenantId);
            if (result.length > 0) {
                const approvalList = await Promise.all(result.map(async (item) => {
                    const { ascensionid } = item;
                    const ascensionApprovalEmployeeList = await new testApprovalClass_1.TestApprovalClass(ascensionid).getAscensionAprovedListDetails(tenantId);
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
    async isTestValidated(tenantId, ascensionId) {
        try {
            const query = `SELECT isapproved FROM dbotestresultapproval WHERE ascensionid = ?`;
            const result = await (0, helper_1.promisifyQuery)(tenantId, query, [ascensionId]);
            console.log('isTestValidated result:', result);
            return result.length > 0 && result[0].isapproved === 1;
        }
        catch (error) {
            console.log('Error checking test validation:', error);
            return false;
        }
    }
    async getUltrasoundWaitingList(tenantId, data) {
        const { count = 10, page = 1 } = data;
        const result = await (0, helper_1.paginationQuery)({ count, page }, queries_1.q_ultrasound_waitingList, [], tenantId);
        return result;
    }
    static async getAscensionBasedOnStage(tenantId, queryParams) {
        try {
            const { _dateEnd, _dateFrom, stage, page, count, isUltrasound, sortby, clinicianId, organizationId, ascensionid, billingid, patientid } = queryParams;
            const { finalQuery, conditions: conditionx } = await Operations.generateAscensionQuery({
                sortby, from: _dateFrom, to: _dateEnd, stage,
                patientid, billingid, ascensionid,
                testid: queryParams.testid,
                patientname: queryParams.patientname,
                isUltrasound, clinicianId, organizationId, grouped: queryParams.grouped || null
            });
            let query = finalQuery;
            let conditionValues = conditionx;
            if (query == null)
                return null;
            if (queryParams.grouped === 'grouped') {
                query += `ORDER BY b.billingid {sorting} LIMIT ? OFFSET ? `;
                query = query.replace('{sorting}', sortby === 'ASC' ? 'ASC' : 'DESC');
                return await (0, helper_1.paginationQuery)({ count, page }, query, conditionValues, tenantId);
            }
            query += ` GROUP BY ta.id ORDER BY ta.id {sorting} LIMIT ? OFFSET ? `;
            query = query.replace('{sorting}', sortby === 'ASC' ? 'ASC' : 'DESC');
            return await (0, helper_1.paginationQuery)({ count, page }, query, conditionValues, tenantId);
        }
        catch (err) {
            return [];
        }
    }
    async searchLaboratoryOperations(tenantId, searchParams) {
        try {
            const { patientId, billingId, accessionId, page, count } = searchParams;
            const offset = (page - 1) * count;
            const params = [];
            let query = `
				SELECT
					b.billingid,
					b.billedon,
					np.patientid,
					CONCAT(np.firstname, ' ', COALESCE(np.middlename, ''), ' ', np.lastname) AS patient_name,
					np.mobile_number AS phonenumber,
					np.email,
					ta.id AS ascension_id,
					ta.testid,
					tp.name AS testname,
					tp.category,
					d.department,
					ta.ascension_date AS created_on,
					ta.collectionStartDate,
					ta.collectionEndDate,
					ta.processingStartDate,
					ta.processingEndDate,
					ta.resultEntryStart,
					ta.resultEntryEnd,
					(SELECT COUNT(DISTINCT testid) FROM test_ascension WHERE billingid = b.billingid) AS total_tests
				FROM billing b
				INNER JOIN new_patients np ON b.patientid = np.patientid
				LEFT JOIN test_ascension ta ON b.billingid = ta.billingid
				LEFT JOIN test_panels tp ON ta.testid = tp.id
				LEFT JOIN departments d ON tp.category = d.id
				WHERE 1=1
			`;
            if (patientId) {
                query += ` AND np.patientid = ?`;
                params.push(patientId);
            }
            if (billingId) {
                query += ` AND b.billingid = ?`;
                params.push(billingId);
            }
            if (accessionId) {
                query += ` AND ta.id = ?`;
                params.push(accessionId);
            }
            if (searchParams.start_date && searchParams.end_date) {
                query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
                params.push(searchParams.start_date, searchParams.end_date);
            }
            else if (searchParams.start_date) {
                query += ` AND DATE(b.billedon) >= ?`;
                params.push(searchParams.start_date);
            }
            else if (searchParams.end_date) {
                query += ` AND DATE(b.billedon) <= ?`;
                params.push(searchParams.end_date);
            }
            query += ` ORDER BY b.billedon DESC, ta.ascension_date DESC LIMIT ? OFFSET ?`;
            params.push(count, offset);
            const result = await (0, helper_1.promisifyQuery)(tenantId, query, params);
            const groupedResults = {};
            const { TestAscension } = await Promise.resolve().then(() => __importStar(require('./ascension')));
            for (const row of result) {
                const billingKey = row.billingid;
                if (!groupedResults[billingKey]) {
                    groupedResults[billingKey] = {
                        billingId: row.billingid,
                        billedOn: row.billedon,
                        patient: {
                            patientId: row.patientid,
                            name: row.patient_name,
                            phone: row.phonenumber,
                            email: row.email
                        },
                        summary: {
                            totalTests: row.total_tests
                        },
                        services: []
                    };
                }
                if (row.ascension_id) {
                    let stage = await TestAscension.determineStage(tenantId, row.ascension_id);
                    if (row.resultEntryStart) {
                        const isValidated = await this.isTestValidated(tenantId, row.ascension_id);
                        if (isValidated) {
                            stage = 'validated';
                        }
                        else {
                            stage = 'validation';
                        }
                    }
                    groupedResults[billingKey].services.push({
                        ascensionId: row.ascension_id,
                        testId: row.testid,
                        testName: row.testname,
                        category: row.category,
                        department: row.department,
                        ascensionDate: row.created_on,
                        collectionStartDate: row.collectionStartDate,
                        collectionEndDate: row.collectionEndDate,
                        processingStartDate: row.processingStartDate,
                        processingEndDate: row.processingEndDate,
                        resultEntryStartDate: row.resultEntryStart,
                        resultEntryEndDate: row.resultEntryEnd,
                        stage: stage || 'Unknown'
                    });
                }
            }
            return {
                results: Object.values(groupedResults),
                pagination: {
                    page,
                    count,
                    total: result.length > 0 ? result.length : 0
                }
            };
        }
        catch (err) {
            console.log('Error in searchLaboratoryOperations:', err);
            throw new Error(`Failed to retrieve laboratory operations data. Please try again later.`);
        }
    }
    static async uploadUltrasoundImages(tenantId, data) {
        try {
            const { ascensionid, testid, patientid, filename } = data;
            const query = `INSERT INTO ultrasound_images (ascensionid, testid, patientid, filename, created_at) VALUES (?, ?, ?, ?, NOW())`;
            const result = await (0, helper_1.promisifyQuery)(tenantId, query, [ascensionid, testid, patientid, filename]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (err) {
            console.log('Error in uploadUltrasoundImages:', err);
            return false;
        }
    }
    static async getUltrasoundImagesByAscension(tenantId, ascensionid) {
        try {
            if (!ascensionid || isNaN(ascensionid)) {
                return [];
            }
            const query = `SELECT id, filename, created_at FROM ultrasound_images WHERE ascensionid = ? ORDER BY created_at DESC`;
            return await (0, helper_1.promisifyQuery)(tenantId, query, [ascensionid]);
        }
        catch (err) {
            console.log('Error in getUltrasoundImagesByAscension:', err);
            return [];
        }
    }
    static async getUltrasoundImageById(tenantId, id) {
        try {
            const query = `SELECT * FROM ultrasound_images WHERE id = ?`;
            const results = await (0, helper_1.promisifyQuery)(tenantId, query, [id]);
            return results[0];
        }
        catch (err) {
            console.log('Error in getUltrasoundImageById:', err);
            return null;
        }
    }
    static async deleteUltrasoundImage(tenantId, id) {
        try {
            const query = `DELETE FROM ultrasound_images WHERE id = ?`;
            const result = await (0, helper_1.promisifyQuery)(tenantId, query, [id]);
            return (0, helper_1.rowAffected)(result);
        }
        catch (err) {
            console.log('Error in deleteUltrasoundImage:', err);
            return false;
        }
    }
}
exports.default = Operations;
