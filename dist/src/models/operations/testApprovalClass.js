"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestApprovalClass = void 0;
const operations_1 = __importDefault(require("./operations"));
const testApprovalQueries_1 = require("./OperationsQueries/testApprovalQueries");
const resultSettings_1 = __importDefault(require("../application/appsettings/resultSettings"));
const helper_1 = require("../../hooks/helper");
const RolesRepository_1 = __importDefault(require("../settings/users/RolesRepository"));
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
class TestApprovalClass extends operations_1.default {
    constructor(ascensionid) {
        super(null);
        this.ascensionid = ascensionid;
    }
    static async updateTestApprovalStatus(ascensionid, approvedBy, tenantId) {
        if (ascensionid && approvedBy) {
            const approvedDetails = await new TestApprovalClass(ascensionid).getAscensionApprovedList(tenantId);
            const canStaffApproveResult = await resultSettings_1.default.canStaffApproveResult(tenantId, approvedBy);
            const isMaximumApprovalReached = await resultSettings_1.default.isApprovalLimitReached(tenantId, approvedDetails, null, "maximum");
            const minListUnverified = Array.isArray(approvedDetails) ? [...approvedDetails, approvedBy] : [approvedDetails, approvedBy];
            const isMinimumApprovalReached = await resultSettings_1.default.isApprovalLimitReached(tenantId, minListUnverified, null, 'minimum');
            const _approvalState = isMinimumApprovalReached == true ? 1 : 0;
            if (!canStaffApproveResult)
                return "You do not have permission to access this resources" /* OperationsFailures.dontHaveAccessPermission */;
            if (isMaximumApprovalReached)
                return "Maximun result validation reached" /* OperationsFailures.maximumResultValidation */;
            if (Array.isArray(approvedDetails) && approvedDetails.length == 0) {
                return await updateQueryExecutor(approvedBy.toString(), _approvalState, ascensionid, tenantId);
            }
            else if (typeof approvedDetails === "number") {
                if (approvedDetails == approvedBy) {
                    return "This resource already exist" /* OperationsFailures.resourceExist */ + " .Resource was already validated by the current user";
                }
                const newApproved = [approvedDetails, approvedBy].join(",");
                return await updateQueryExecutor(newApproved, _approvalState, ascensionid, tenantId);
            }
            else if (Array.isArray(approvedDetails) && approvedDetails.length > 0) {
                if (approvedDetails.includes(approvedBy) == false) {
                    const newApproved = [...approvedDetails, approvedBy].join(",");
                    return await updateQueryExecutor(newApproved, _approvalState, ascensionid, tenantId);
                }
                return "This resource already exist" /* OperationsFailures.resourceExist */ + " .Resource was already validated by the current user";
            }
        }
        return false;
        async function updateQueryExecutor(approvedBy, isApproved, ascensionid, tenantId) {
            try {
                const result = await (0, helper_1.promisifyQuery)(tenantId, testApprovalQueries_1.q_updateTestApprovalStatus, [isApproved, approvedBy, ascensionid]);
                return (0, helper_1.rowAffected)(result);
            }
            catch (error) {
                console.log(error);
            }
        }
    }
    static async getAscensionPrintCount(ascensionid, tenantId) {
        let count = await (0, helper_1.promisifyQuery)(tenantId, testApprovalQueries_1.q_get_print_count_for_test, [ascensionid]);
        if (count.length == 0)
            return false;
        count = count[0]['printCount'];
        return count;
    }
    async getAscensionApprovedDetail(tenantId) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, testApprovalQueries_1.q_get_result_approval_details, [this.ascensionid]);
        return rows.length > 0 ? rows[0] : null;
    }
    async getAscensionApprovedList(tenantId) {
        let approvedIndividualsPacket = await this.getAscensionApprovedDetail(tenantId);
        if (approvedIndividualsPacket === null)
            return [];
        let approvedIndividuals = approvedIndividualsPacket.approvedBy;
        if (typeof approvedIndividuals === "string" && approvedIndividuals.includes(",")) {
            let approvedIndividualsList = approvedIndividuals.split(",");
            if (approvedIndividualsList.length > 0) {
                let approvedIndividualsListCont = approvedIndividualsList.map((item, index) => parseInt(item.toString()));
                return approvedIndividualsListCont;
            }
            return [];
        }
        if (typeof approvedIndividuals == "string" &&
            approvedIndividuals.includes(",") == false && !isNaN(parseInt(approvedIndividuals.toString()))) {
            return parseInt(approvedIndividuals.toString());
        }
        if (approvedIndividuals === null)
            return [];
    }
    async getAscensionAprovedListDetails(tenantId) {
        try {
            let approvedList = await this.getAscensionApprovedList(tenantId);
            async function getUser(employeeId) {
                const EmployeeRepo = await new RolesRepository_1.default(tenantId).getRoleById(employeeId);
                return EmployeeRepo ? { username: EmployeeRepo['username'], employeeid: employeeId, role: EmployeeRepo['role'] } : null;
            }
            if (typeof approvedList === "number") {
                return [await getUser(approvedList)];
            }
            if (approvedList.length === 0)
                return [];
            return Promise.all(approvedList.map(async (employeeId, index) => {
                return await getUser(employeeId);
            }));
        }
        catch (err) {
            console.log(err);
        }
    }
    static async addAprovalItem(tenantId, ascensionId, transaction) {
        const queryRunner = transaction || await (0, KnexConnections_1.default)(tenantId);
        const query = `INSERT INTO dbotestresultapproval (ascensionid,minvalidation,maxvalidation) VALUES (?,?,?)`;
        const resultsettings = await resultSettings_1.default.getResultEntrySettings(tenantId);
        const minvalidation = resultsettings['minimumResultValidation'] || 1;
        const maxvalidation = resultsettings['maximumResultValidation'] || 10;
        return await queryRunner.raw(query, [ascensionId, minvalidation, maxvalidation]);
    }
}
exports.TestApprovalClass = TestApprovalClass;
