"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SampleHandler = void 0;
const ascension_1 = require("../ascension");
const queries_1 = require("./queries");
const queries_2 = require("../../creator/queries");
const helper_1 = require("../../../hooks/helper");
class SampleHandler extends ascension_1.TestAscension {
    constructor(ascensionId) {
        super(ascensionId);
        this.ascensionId = ascensionId;
    }
    static async getTransactionTestListForSampleAssessment(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_sample_assessment_list, [billingid]);
    }
    static async updateSampleStatusForAscension(tenantId, record) {
        const { rejectionmessage, approvalstatus, ascensionId, validatedby, validatedon } = record;
        const row = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_sample_status_validation, [approvalstatus, rejectionmessage, validatedon, validatedby, ascensionId]);
        return (0, helper_1.rowAffected)(row);
    }
    static async updateTestSampleApprovalStatusBulk(tenantId, collection) {
        if (collection.length === 0)
            return null;
        for (let i = 0; i < collection.length; i++) {
            try {
                const { testid, validatedby, rejectionmessage, billingid, approvalstatus, id: ascensionId, validatedon } = collection[i];
                const hasValidParams = testid && billingid && validatedby && validatedon && ascensionId && [0, 1].includes(approvalstatus);
                if (!hasValidParams || (approvalstatus === 0 && rejectionmessage == null))
                    continue;
                await this.updateSampleStatusForAscension(tenantId, Object.assign(Object.assign({}, collection[i]), { ascensionId }));
            }
            catch (err) {
                return false;
            }
        }
        return true;
    }
    static async getPendingUnvalidatedSamples(tenantId, pagination) {
        return await (0, helper_1.paginationQuery)(pagination, queries_2.q_get_pending_collected_but_unvalidated_samples, [], tenantId);
    }
    static async getRejectedCollectedSample(tenantId, pagination) {
        return await (0, helper_1.paginationQuery)(pagination, queries_2.q_get_rejected_collected_samples, [], tenantId);
    }
    static async getSampleDisputeLog(tenantId, records) {
        const { ascensionid, branchid, count = 10, page = 1 } = records;
        let result = await (0, helper_1.paginationQuery)({ page, count }, queries_1.q_get_logs_rejectedsampledisputelog, [ascensionid], tenantId);
        if (result.length > 0) {
            result = result.map((item, index) => {
                const { disputedby, disputedon, disputereason, username } = item;
                return { disputedby, disputedon, disputereason, branch: branchid, username };
            });
            return result;
        }
        return result;
    }
    static async disputeSampleRejection(tenantId, records) {
        const { ascensionid, disputereason, disputedby, disputedon } = records;
        const isUpdated = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_sample_update_dispute, [disputereason, disputedby, disputedon, ascensionid]);
        if (isUpdated) {
            const values = [ascensionid, disputereason, disputedby, disputedon];
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.a_sample_dispute_query, values);
            return (0, helper_1.rowAffected)(result);
        }
    }
}
exports.SampleHandler = SampleHandler;
