"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestAscension = void 0;
const operations_1 = __importDefault(require("./operations"));
const queries_1 = require("./queries");
const types_1 = require("./types");
const billingclientTypes_1 = require("../billing/billingclientTypes");
const queries_2 = require("../creator/queries");
const ascensionQueries_1 = require("./ascensionQueries");
const drugsUpload_1 = require("../drugs/drugsUpload");
const helper_1 = require("../../hooks/helper");
const creator_1 = __importDefault(require("../creator/creator"));
const TiifuWorkingClass_1 = require("../../database/TiifuWorkingClass");
const KnexConnections_1 = __importDefault(require("../../database/KnexConnections"));
const appset_1 = __importDefault(require("../application/appsettings/appset"));
class TestAscension extends operations_1.default {
    constructor(ascensionId) {
        super(0);
        this.ascensionId = ascensionId;
    }
    static async updateSampleAscensionstate(tenantId, ascensionId, stage, value, employeeid) {
        if (!ascensionId || !types_1.ascensionStages[stage] || !value)
            return false;
        let query = null;
        if (['processingStartDate', 'processingEndDate'].includes(stage)) {
            query = queries_1.q_update_ascension_processing_state;
        }
        else if (['collectionStartDate', 'collectionEndDate'].includes(stage)) {
            query = queries_1.q_update_ascension_collection_state;
        }
        else if (['resultEntryStart', 'resultEntryEnd'].includes(stage)) {
            query = queries_1.q_update_ascension_result_entry_state;
        }
        else {
            query = null;
        }
        if (query == null)
            return null;
        query = query.replace('{stage}', stage);
        const sanitizedDate = new Date(value);
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [sanitizedDate, employeeid, ascensionId]);
        return (0, helper_1.rowAffected)(result);
    }
    static async incrementTestEditCount(tenantId, billingid, ascensionid) {
        const current_count_value = await (0, helper_1.promisifyQuery)(tenantId, ascensionQueries_1.q_get_AscensionEditCount, [billingid, ascensionid]);
        if (current_count_value.length > 0) {
            const { counter } = current_count_value[0];
            const current_count = parseInt(counter) + 1;
            const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_update_general_ascension_test_edit_count, [current_count, ascensionid, billingid]);
            return (0, helper_1.rowAffected)(result);
        }
        return false;
    }
    async deleteBilledAssociatedAscension(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.delete_test_ascension_billed, [billingid]);
    }
    static async findAscension(tenantId, ascensionId) {
        if (!ascensionId)
            return null;
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_ascension_find_id, [ascensionId]);
        return result.length > 0 ? result[0] : null;
    }
    static async determineStage(tenantId, ascensionId) {
        if (!ascensionId)
            return false;
        const data = await TestAscension.findAscension(tenantId, ascensionId);
        if (!data)
            return false;
        const { collectionEndDate, collectionStartDate, resultEntryEnd, resultEntryStart, processingStartDate, processingEndDate, approvalStatus, printtedOn, } = data;
        if (approvalStatus)
            return billingclientTypes_1.Client_PLS_Lifecycle[10];
        if (resultEntryEnd)
            return billingclientTypes_1.Client_PLS_Lifecycle[9];
        if (resultEntryStart)
            return billingclientTypes_1.Client_PLS_Lifecycle[8];
        if (processingEndDate)
            return billingclientTypes_1.Client_PLS_Lifecycle[7];
        if (processingStartDate)
            return billingclientTypes_1.Client_PLS_Lifecycle[6];
        if (collectionEndDate)
            return billingclientTypes_1.Client_PLS_Lifecycle[3];
        if (collectionStartDate)
            return billingclientTypes_1.Client_PLS_Lifecycle[2];
        return billingclientTypes_1.Client_PLS_Lifecycle[1];
    }
    static async getPendingSampleUncollected(tenantId, count, page, start_date, end_date, filter, sortby = 'ASC', billingid) {
        let query = queries_1.q_pending_sample_uncollected;
        let params = [];
        if (billingid) {
            query += ` AND b.billingid = ?`;
            params.push(billingid);
        }
        if (start_date && end_date) {
            query += ` AND DATE(b.billedon) BETWEEN ? AND ?`;
            params = [start_date, end_date];
        }
        if (filter) {
            const words = filter.trim().split(/\s+/).filter(w => w.length > 0);
            const nameConditions = words.map(() => `(p.firstname LIKE BINARY ? OR p.middlename LIKE BINARY ? OR p.lastname LIKE BINARY ?)`).join(' OR ');
            query += ` AND (ts.id = ? OR ${nameConditions})`;
            params.push(filter);
            words.forEach(word => {
                params.push(`%${word}%`, `%${word}%`, `%${word}%`);
            });
        }
        query += ` ORDER BY b.billingid ${sortby} LIMIT ? OFFSET ?`;
        return await (0, helper_1.promisifyQuery)(tenantId, query, [...params, count, (page - 1) * count]);
    }
    static async getTransactionAscentionTestDetails(tenantId, billingid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_transaction_ascension_phelobotomy_details, [billingid]);
    }
    static async getTransactionTestsQualifiedForResultEntry(tenantId, billingid, branchid) {
        return await (0, helper_1.promisifyQuery)(tenantId, queries_2.q_get_all_test_qualified_to_for_result_entry_on_test, [billingid, branchid]);
    }
    static async getAllPendingAscensions(tenantId, count = 30, page = 1) {
        let query = queries_1.q_pending_sample_uncollected;
        let params = [];
        query += ` ORDER BY b.billedon DESC`;
        if (page && count) {
            const offset = (page - 1) * count;
            query += ` LIMIT ? OFFSET ?`;
            params = [count, offset];
        }
        return await (0, helper_1.promisifyQuery)(tenantId, query, params);
    }
    static async findAllBillingAssociatedTestAscensions(tenantId, billingid, onlyAscensionid = true) {
        const billingAscensions = await new TiifuWorkingClass_1.TiifuWorkingClass("test_ascension").findMany(tenantId, "billingid", billingid);
        if (Array.isArray(billingAscensions) && billingAscensions.length > 0) {
            if (onlyAscensionid) {
                return billingAscensions.map((item) => item.id);
            }
            return billingAscensions;
        }
        return [];
    }
    static async getAscensionSavedDrugs(tenantId, ascensionId, testid) {
        try {
            let drugsList = await creator_1.default.getResultDrugReactions(tenantId, ascensionId, testid);
            let AllDrugsAvailable = await new drugsUpload_1.DrugManagementService().getDrugs(tenantId);
            if (Array.isArray(drugsList) && drugsList.length > 0) {
                let mergedArray = [...drugsList];
                for (let i = 0; i < AllDrugsAvailable.length; i++) {
                    const { id } = AllDrugsAvailable[i];
                    let filterFound = drugsList.filter((_field, index) => _field.id == id);
                    if (filterFound.length == 0)
                        mergedArray.push(AllDrugsAvailable[i]);
                }
                if (mergedArray.length > 0) {
                    let refinedArray = mergedArray.map((item, index) => {
                        const { ascensionid, id, reaction, drug } = item;
                        return {
                            ascensionid,
                            id,
                            sensitivity: reaction ? reaction : "",
                            drug
                        };
                    });
                    return refinedArray;
                }
            }
            return AllDrugsAvailable;
        }
        catch (err) {
            throw err;
        }
    }
    static async completeFlowByPass(tenantId, billingid, employeeid) {
        const application_settings = await new appset_1.default().getAllAppSettings(tenantId);
        if (!application_settings)
            return;
        const isCompleteLabFlowEnabled = parseInt(application_settings['completeFlow'].toString()) ? true : false;
        if (isCompleteLabFlowEnabled)
            return;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const trx = await connection.transaction();
        const cart = await trx("test_ascension AS ta")
            .leftJoin("dboservices AS sbo", "sbo.billingid", "ta.billingid")
            .where({ "sbo.billingid": billingid })
            .orWhere({ "sbo.relatedbillingid": billingid });
        const AscensionIdx = cart.map(item => item.id);
        if (AscensionIdx.length == 0)
            return;
        if (!isCompleteLabFlowEnabled) {
            try {
                for (const item of cart) {
                    const currentDate = new Date();
                    await trx('test_ascension')
                        .update({
                        collectionStartDate: currentDate,
                        collectionEndDate: currentDate,
                        processingStartDate: currentDate,
                        processingEndDate: currentDate,
                        sampleCollectedBy: employeeid,
                        sampleProcessedBy: employeeid,
                    }).where({ billingid: billingid, id: item.id });
                    await trx('samplestatus')
                        .update({
                        approvalstatus: 1,
                        phelobotomist: employeeid,
                        validatedby: employeeid,
                        samplevalidatedon: currentDate,
                    }).where({ ascensionid: item.id });
                }
                await trx.commit();
                return true;
            }
            catch (error) {
                await trx.rollback();
                throw error;
            }
        }
    }
    static async completeFlowByPassMultiple(tenantId, billingIds, employeeid) {
        if (!Array.isArray(billingIds) || billingIds.length === 0)
            return;
        const application_settings = await new appset_1.default().getAllAppSettings(tenantId);
        if (!application_settings)
            return;
        const isCompleteLabFlowEnabled = parseInt(application_settings['completeFlow'].toString()) ? true : false;
        if (isCompleteLabFlowEnabled)
            return;
        const connection = await (0, KnexConnections_1.default)(tenantId);
        const trx = await connection.transaction();
        try {
            for (const billingid of billingIds) {
                const cart = await trx("test_ascension").where({ billingid }).orWhere({ relatedbillingid: billingid });
                if (!cart || cart.length === 0)
                    continue;
                for (const item of cart) {
                    const currentDate = new Date();
                    await trx('test_ascension')
                        .update({
                        collectionStartDate: currentDate,
                        collectionEndDate: currentDate,
                        processingStartDate: currentDate,
                        processingEndDate: currentDate,
                        sampleCollectedBy: employeeid,
                        sampleProcessedBy: employeeid,
                    }).where({ billingid: billingid, id: item.id });
                    await trx('samplestatus')
                        .update({
                        approvalstatus: 1,
                        phelobotomist: employeeid,
                        validatedby: employeeid,
                        samplevalidatedon: currentDate,
                    }).where({ ascensionid: item.id });
                }
            }
            await trx.commit();
            return true;
        }
        catch (error) {
            await trx.rollback();
            throw error;
        }
    }
    static async systemLaboratoryByPass(tenantId, ascensionid, bypasstage, employeeid, trx) {
        if (!bypasstage || !['byPassCollection', 'byPassProcessing', 'byPassSampleValidation', 'byPassValidation'].includes(bypasstage))
            return;
        const connection = trx ? trx : await (0, KnexConnections_1.default)(tenantId);
        // laod application settings to check if complete lab flow is enabled
        const application_settings = await new appset_1.default().getAllAppSettings(tenantId);
        if (!application_settings)
            return;
        const { byPassCollection, byPassProcessing, byPassSampleValidation, byPassValidation } = application_settings;
        const isPassCollectionEnabled = byPassCollection ? parseInt(byPassCollection.toString()) ? true : false : false;
        const isPassProcessingEnabled = byPassProcessing ? parseInt(byPassProcessing.toString()) ? true : false : false;
        const isPassSampleValidationEnabled = byPassSampleValidation ? parseInt(byPassSampleValidation.toString()) ? true : false : false;
        const isPassValidationEnabled = byPassValidation ? parseInt(byPassValidation.toString()) ? true : false : false;
        if (!isPassCollectionEnabled && !isPassProcessingEnabled && !isPassSampleValidationEnabled && !isPassValidationEnabled)
            return;
        if (bypasstage === 'byPassCollection' && isPassCollectionEnabled) {
            await trx('test_ascension')
                .update({
                collectionStartDate: new Date(),
                collectionEndDate: new Date(),
                sampleCollectedBy: employeeid,
            }).where({ id: ascensionid });
        }
        if (bypasstage === 'byPassProcessing' && isPassProcessingEnabled) {
            await trx('test_ascension')
                .update({
                processingStartDate: new Date(),
                processingEndDate: new Date(),
                sampleProcessedBy: employeeid,
            }).where({ id: ascensionid });
        }
        if (bypasstage === 'byPassSampleValidation' && isPassSampleValidationEnabled) {
            await trx('samplestatus')
                .update({
                approvalstatus: 1,
                phelobotomist: employeeid,
                validatedby: employeeid,
                samplevalidatedon: new Date(),
            }).where({ ascensionid: ascensionid });
        }
        if (bypasstage === 'byPassValidation' && isPassValidationEnabled) {
            await trx('dbotestresultapproval')
                .update({ isapproved: 1, approvedBy: employeeid, lastupdatedon: new Date() })
                .where({ ascensionid: ascensionid });
        }
    }
}
exports.TestAscension = TestAscension;
