"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
const helper_1 = require("../../hooks/helper");
const creator_1 = __importDefault(require("../creator/creator"));
const resultEncryptionReferer_1 = __importDefault(require("../creator/resultEncryptionReferer"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const resultSettings_1 = __importDefault(require("../application/appsettings/result-settings/resultSettings"));
const commission_configurations_1 = require("../commissions/commission-configurations");
const testApprovalClass_1 = require("../operations/testApprovalClass");
const registration_1 = __importDefault(require("../registration/registration"));
const emptySummry = [
    { title: "registered clients", value: 0 },
    { title: "test count", value: 0 },
    { title: "samples collected", value: 0 },
    { title: "processed test", value: 0 },
    { title: "test ready", value: 0 },
    { title: "Approved test", value: 0 },
];
/**
 * Class representing ResultPrint with various methods to handle print-related functionalities.
 */
class ResultPrint {
    constructor(billingid) {
        this.billingid = billingid;
    }
    /**
     * Retrieves printable test results based on query parameters.
     * @param {Object} requestquery - The query parameters from the request.
     * @returns {Promise<Array>} - The list of printable test results.
     */
    async get_printables(tenantId, requestquery) {
        const { querydate, content } = requestquery;
        let { query, params } = (0, queries_1.modelQueryWithFilters)(querydate, content);
        const printables = await (0, helper_1.promisifyQuery)(tenantId, query, params);
        return printables;
    }
    /**
     * Retrieves extra information about a test.
     * @param {number} id - The billingid.
     * @returns {Promise<any[]>} - The extra information about the test.
     */
    async get_extrainfo_test(tenantId, id) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.extrainfoTestQuery, [id]);
        return result;
    }
    /**
     * Updates the print count for a test.
     * @param {number} id - The ID of the test.
     * @param {number} count - The new print count.
     * @throws Will throw an error if id or count is not provided.
     */
    async updatePrintCount(tenantId, id, count) {
        if (!id || !count) {
            throw new Error("test ascension id and count required");
        }
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.updatePrintCountQuery, [count, id]);
        return result;
    }
    /**
     * Retrieves the result entry scientist's username and the username of the person who validated the result.
     * @param {number} billingid - The billing ID.
     * @param {number} testid - The test ID.
     * @returns {Promise<{ resultentry: string | null; validatedBy: string | null }>} - The usernames of the result entry scientist and the validator.
     * @throws Will throw an error if billingid or testid is not provided.
     */
    async getResultEntryScientist(tenantId, billingid, testid, ascensionId) {
        try {
            const employeeIdRow = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM test_results WHERE ascensionid  = ?`, [ascensionId]);
            let employeeid = null;
            let enteredOn = null;
            if (employeeIdRow.length > 0) {
                enteredOn = employeeIdRow[0]['created_on'];
                employeeid = employeeIdRow[0]["employeeid"];
            }
            let username = null;
            const usernameResult = await (0, helper_1.promisifyQuery)(tenantId, queries_1.approvedByUsernameQuery, [employeeid]);
            if (usernameResult.length > 0) {
                username = usernameResult[0]["username"];
            }
            const approvalClass = new testApprovalClass_1.TestApprovalClass(ascensionId);
            const validators = await approvalClass.getAscensionAprovedListDetails(tenantId);
            const ascensionApprovalDetails = await approvalClass.getAscensionApprovedDetail(tenantId);
            const lastupdatedon = (ascensionApprovalDetails === null || ascensionApprovalDetails === void 0 ? void 0 : ascensionApprovalDetails.lastupdatedon) ? ascensionApprovalDetails['lastupdatedon'] : null;
            return { resultentry: username, validators, lastupdatedon, enteredOn };
        }
        catch (err) {
            console.log(err);
            throw err;
        }
    }
    /**
     * Retrieves summary information for the ready page based on query parameters.
     * @param {Object} requestquery - The query parameters
     * @returns {Promise<void>}
     */
    async get_summary_ready_page(tenantId, requestquery) {
        var _a;
        const { querydate } = requestquery;
        function getTodayDate() {
            const currentDate = new Date();
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, "0");
            const day = String(currentDate.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        }
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.summaryReadyPageQuery, [querydate || getTodayDate(), querydate || getTodayDate()]);
            if (result && result.length > 0) {
                const processing = result.filter((item) => {
                    return item.processing === "true" && item.collection === "true" && item.ready === "true";
                }).length;
                const ready = result.filter((item) => {
                    return item.processing === "true" && item.ready === "true";
                }).length;
                const collection = result.filter((item) => {
                    return item.collection === "true";
                }).length;
                const approval = result.filter((item) => {
                    return item.ApprovalStatus === 1;
                }).length;
                const testcount = result.length;
                return [
                    { title: "registered clients", value: (_a = result[0]) === null || _a === void 0 ? void 0 : _a["registered"] },
                    { title: "test count", value: testcount },
                    { title: "samples collected", value: collection },
                    { title: "processed test", value: processing },
                    { title: "test ready", value: ready },
                    { title: "Approved test", value: approval },
                ];
            }
            else {
                return emptySummry;
            }
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Retrieves sampling information for a test.
     * @param {number} billing - The billing ID.
     * @param {number} testid - The test ID.
     * @returns {Promise<any>} - The sampling information.
     */
    async getSamplingInformation(tenantId, billing, testid) {
        try {
            let sampling = await (0, helper_1.promisifyQuery)(tenantId, queries_1.samplingQuery, [billing, testid]);
            if (sampling.length === 0)
                return {};
            sampling = sampling.map((item) => {
                const processing_time = new Date(item === null || item === void 0 ? void 0 : item.processing_date).toLocaleTimeString();
                const collection_time = new Date(item === null || item === void 0 ? void 0 : item.collection_date).toLocaleTimeString();
                const ready_time = new Date(item === null || item === void 0 ? void 0 : item.ready_date).toLocaleTimeString();
                const processing_date = new Date(item === null || item === void 0 ? void 0 : item.processing_date).toLocaleDateString();
                const collection_date = new Date(item === null || item === void 0 ? void 0 : item.collection_date).toLocaleDateString();
                const ready_date = new Date(item === null || item === void 0 ? void 0 : item.ready_date).toLocaleDateString();
                return Object.assign(Object.assign({}, item), { processing_date, collection_date, ready_date, processing_time, collection_time, ready_time });
            });
            return sampling[0];
        }
        catch (err) {
            commission_configurations_1.logger.error(err);
        }
    }
    /**
     * Retrieves comments for a test.
     * @param {number} billingid - The billing ID.
     * @param {number} testid - The test ID.
     * @param {Object} response - The response object.
     * @returns {Promise<any[]>} - The list of comments.
     */
    async getComments(tenantId, billingid, testid, response) {
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, `SELECT * FROM result_comments WHERE BILLINGID = ? AND TESTID = ?`, [billingid, testid]);
            if (response) {
                response.send({ status: "success", statusCode: 200, result });
            }
            else {
                return result;
            }
        }
        catch (err) {
            commission_configurations_1.logger.error(err);
            if (response) {
                (0, helper_1.customError)("error occured", 500, response);
            }
            else {
                throw new Error(err);
            }
        }
    }
    /**
     * Makes a decision on the result of a test (approve or decline).
     * @param {Object} requestbody - The request body containing the decision details.
     * @returns {Promise<number>} - The number of rows affected by the update.
     * @throws Will throw an error if the query fails.
     */
    async makeDecisionOnResult(tenantId, requestbody) {
        const { billingid, testid, declineMessage, approvalstatus, actionPlan, approvedby } = requestbody;
        try {
            const queryResult = await (0, helper_1.promisifyQuery)(tenantId, queries_1.makeDecisionOnResultQuery, [
                approvalstatus,
                actionPlan,
                declineMessage,
                approvedby,
                billingid,
                testid,
            ]);
            return (0, helper_1.rowAffected)(queryResult);
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Checks if a test has been approved.
     * @param {number} billingid - The billing ID.
     * @param {number} testid - The test ID.
     * @param {Object} response - The response object.
     * @returns {Promise<boolean>} - True if the test is approved, false otherwise.
     * @throws Will throw an error if the query fails.
     */
    async checkApproval(tenantId, billingid, testid) {
        try {
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.checkApprovalQuery, [billingid, testid]);
            if (result && result.length > 0) {
                const { approvalstatus } = result[0];
                return approvalstatus === 1;
            }
            return false;
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Performs an advanced search on tables with filters.
     * @param {Object} requestquery - The query parameters from the request.
     * @returns {Promise<any>} - The search results.
     * @throws Will throw an error if the query fails.
     */
    async advancedTablesSearch(tenantId, requestquery) {
        try {
            const { values, query } = (0, queries_1.advancedTablesSearchQueryWithFilters)(requestquery);
            const { count, page } = requestquery;
            const result = await (0, helper_1.paginationQuery)({ count, page }, query, values, tenantId);
            return result;
        }
        catch (err) {
            throw err;
        }
    }
    async previewReport(tenantId, billingid, testid) {
        try {
            let patientid = await new registration_1.default().getPatientInfoUsingBillingId(tenantId, billingid);
            if (patientid.length === 0)
                "such id not found" /* OperationsFailures.unfoundID */;
            patientid = patientid[0]["patientid"];
            const previewReportContent = await new creator_1.default(testid).resultPresentationView(tenantId, testid, billingid, patientid);
            if (Array.isArray(previewReportContent) || typeof previewReportContent == "string")
                return null;
            let resultRequiringDecryption = previewReportContent['result'];
            previewReportContent['result'] = await ResultPrint.decryptResultArray(resultRequiringDecryption);
            return previewReportContent;
        }
        catch (err) {
            throw err;
        }
    }
    /**
     * Decrypts an array of result data using resultEncrptionReferer
     * @param resultArray The array of result data to decrypt
     * @returns The decrypted result array
     */
    static async decryptResultArray(resultArray) {
        if (resultArray && Array.isArray(resultArray) && resultArray.length > 0) {
            const decryptedResult = await (0, resultEncryptionReferer_1.default)(resultArray, "decryption");
            if (decryptedResult.resources && Array.isArray(decryptedResult.resources) && decryptedResult.resources.length > 0) {
                return resultArray.map((item) => {
                    const matched = decryptedResult.resources.find((field) => field.fieldid == item.fieldid);
                    return matched ? Object.assign(Object.assign({}, item), matched) : item;
                });
            }
            else {
                throw new Error("Decrypting Result Failed");
            }
        }
        return resultArray;
    }
    async getTransactionApprovedTest(tenantId, billingid) {
        try {
            if (!billingid) {
                throw new Error("billingid is required");
            }
            const transactionAscensionsList = await new TiifuWorkingClass_1.TiifuWorkingClass('test_ascension').findMany(tenantId, 'billingid', billingid);
            if (Array.isArray(transactionAscensionsList)) {
                if (transactionAscensionsList.length == 0)
                    return transactionAscensionsList;
                const ascensionList = transactionAscensionsList.map((item) => item.id);
                let ApprovedAscensionIds = [];
                for (const ascensionId of ascensionList) {
                    const isApproved = await resultSettings_1.default.isApprovalLimitReached(null, ascensionId, 'minimum');
                    if (isApproved) {
                        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.transactionApprovedMini, [ascensionId]);
                        if (Array.isArray(result) && result.length > 0) {
                            ApprovedAscensionIds.push(result[0]);
                        }
                    }
                }
                return ApprovedAscensionIds;
            }
            return [];
        }
        catch (err) {
            throw err;
        }
    }
}
exports.default = ResultPrint;
