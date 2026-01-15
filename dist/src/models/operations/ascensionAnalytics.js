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
exports.AscensionAnalytics = void 0;
const ascension_1 = require("./ascension");
const queries_1 = require("./queries");
const types_1 = require("./types");
const Queries = __importStar(require("./ascensionQueries"));
const appointmentTypes_1 = require("../appointments/appointmentTypes");
const helper_1 = require("../../hooks/helper");
class AscensionAnalytics extends ascension_1.TestAscension {
    constructor(ascensionId) {
        super(ascensionId);
    }
    async getCurrentPendingAscensionCasesCount(tenantId) {
        const result = await (0, helper_1.promisifyQuery)(tenantId, queries_1.q_get_pending_ascension_cases);
        if (result.length == 0)
            return 0;
        return result[0]['pendingcases'];
    }
    static async calCalculateDuration(start, end) {
        return { hour: 0, min: 0, seconds: 0 };
    }
    async calCulateTimeUsedInEachAscensionStage(tenantId, startStage, endStage) {
        if (this.ascensionId || types_1.ascensionStages[startStage] || types_1.ascensionStages[endStage])
            return false;
        const query = queries_1.q_get_stages_column_dual.replace("start", startStage).replace("end", endStage);
        const result = await (0, helper_1.promisifyQuery)(tenantId, query, [startStage, endStage]);
        if (result.length == 0)
            return false;
        const startDate = result[0][startStage];
        const endDate = result[0][endStage];
        let duration = AscensionAnalytics.calCalculateDuration(startDate, endDate);
        return duration;
    }
    static getMonths() {
        return [
            { month: 1, name: "January" },
            { month: 2, name: "February" },
            { month: 3, name: "March" },
            { month: 4, name: "April" },
            { month: 5, name: "May" },
            { month: 6, name: "June" },
            { month: 7, name: "July" },
            { month: 8, name: "August" },
            { month: 9, name: "September" },
            { month: 10, name: "October" },
            { month: 11, name: "November" },
            { month: 12, name: "December" }
        ];
    }
    static async phelobotomistSummary(tenantId, phelobotomistid = null) {
        let query = Queries.phelobotomistSummary;
        if (phelobotomistid && typeof phelobotomistid == "number")
            query += ` WHERE ta.sampleCollectedBy = ?`;
        query += ` GROUP BY ta.sampleCollectedBy`;
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.phelobotomistSummary, [phelobotomistid]);
    }
    static async approvedTestsPerScientist(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.approvedTestsPerScientist);
    }
    static async approvalRatePerScientist(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.approvalRatePerScientist);
    }
    static async totalTestsPerMonth(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalTestsPerMonth);
    }
    static async averageProcessingTime(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.averageProcessingTime);
    }
    static async totalTestsByApprovalStatus(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalTestsByApprovalStatus);
    }
    static async testsSamplePendingApproval(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsSamplePendingApproval);
    }
    static async recentCollections(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.recentCollections);
    }
    static async averageTimeToCollection(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.averageTimeToCollection);
    }
    static async totalProcessedByMonth(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalProcessedByMonth);
    }
    static async testsWithDeclineMessages(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsWithDeclineMessages);
    }
    static async testsByCollectionStatus(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsByCollectionStatus);
    }
    static async averageResultEntryTime(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.averageResultEntryTime);
    }
    static async testsByServiceType(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsByServiceType);
    }
    static async monthlyApprovalRate(tenantId, date) {
        let result = await (0, helper_1.promisifyQuery)(tenantId, Queries.monthlyApprovalRate, [date]);
        if (result.length > 0) {
            result = result.map((item, index) => {
                for (const [key, value] of Object.entries(appointmentTypes_1.months)) {
                    if (value === item.month) {
                        return Object.assign(Object.assign({}, item), { month: key });
                    }
                }
                return item;
            });
        }
        return result;
    }
    static async testsNotProcessed(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsNotProcessed);
    }
    static async testsCompletedVsInitiatedVrsUninitiated(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsCompletedVsInitiatedVrsUninitiated);
    }
    static async collectionToProcessingTime(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.collectionToProcessingTime);
    }
    static async testsByScientistApprovalRates(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsByScientistApprovalRates);
    }
    static async testTrendsOverTime(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testTrendsOverTime);
    }
    static async testsWithoutActionPlans(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsWithoutActionPlans);
    }
    static async comparisonOfCollectionStartDates(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.comparisonOfCollectionStartDates);
    }
    static async totalTestsByDeclineReason(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalTestsByDeclineReason);
    }
    static async averageTimeBetweenCollectionAndProcessing(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.averageTimeBetweenCollectionAndProcessing);
    }
    static async testsCompletedIn24Hours(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsCompletedIn24Hours);
    }
    static async countOfTestsByEachScientist(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.countOfTestsByEachScientist);
    }
    static async testsWithProcessingDelays(tenantId, expected_time) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsWithProcessingDelays(expected_time));
    }
    static async totalTestsByYear(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalTestsByYear);
    }
    static async yearlyTotalTestsSampleCollected(tenantId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.yearlyTotalTestsSampleCollected, [year]);
    }
    static async timeBetweenCollectionStartAndEnd(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.minMaxAvgTimeBetweenCollectionStartAndEnd);
    }
    static async dayToDayTotalTestSampleCollectedCompletely(tenantId, month, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.dayToDayTotalTestSampleCollectedCompletely, [month, year]);
    }
    static async getCollectionToDisputeToApprovedToRedrawnLast30days(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalTestCollectedWithApprovalRateWithRejectionAdisputedOnLast31);
    }
    static async getCollectionToDisputeToApprovedToRedrawnOverAmonthBasedOnYear(tenantId, year, month) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.CollectionToDisputeToApprovedToRedrawnLastOfAMonth, [month, year]);
    }
    static async getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear(tenantId, year) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear, [year]);
    }
    static async totalSamplePendingCollection24(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.totalSamplePendingCollectionWithDateIn24Hours);
    }
    static async totalSampleRedrawOrders24(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsRedrawOrdersIn24Hours);
    }
    static async totalSampleRejected24(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsRejectedIn24Hours);
    }
    static async totalSampleRedrawCompleted24(tenantId) {
        return await (0, helper_1.promisifyQuery)(tenantId, Queries.testsRedrawOrdersCompletedIn24Hours);
    }
    static allTimePendingCollections(tenantId) {
        return (0, helper_1.promisifyQuery)(tenantId, Queries.totalAllTimePendingCollections);
    }
    static async phelobotomistAnalytics24Hours(tenantId) {
        let pending = await this.totalSamplePendingCollection24(tenantId);
        let rejected = await this.totalSampleRejected24(tenantId);
        let orders = await this.totalSampleRedrawOrders24(tenantId);
        let completed = await this.totalSampleRedrawCompleted24(tenantId);
        let allTimePending = await this.allTimePendingCollections(tenantId);
        allTimePending = allTimePending[0]['total_pending_collections'];
        rejected = rejected[0]['tests_rejected_in_24h'];
        completed = completed[0]['redraw_orders_completed_in_24h'];
        orders = orders[0]['redraw_orders_in_24h'];
        pending = pending[0]['pending'];
        return { pending, rejected, orders, completed, allTimePending };
    }
    async getAllAnalytics(tenantId) {
        try {
            const [totalTestsPerMonth, averageProcessingTime, totalTestsByApprovalStatus, testsSamplePendingApproval, recentCollections, averageTimeToCollection, totalProcessedByMonth, testsWithDeclineMessages, testsByCollectionStatus, averageResultEntryTime, testsNotProcessed, testsCompletedVsInitiatedVrsUninitiated, collectionToProcessingTime, testsByScientistApprovalRates, testTrendsOverTime, testsWithoutActionPlans, totalTestsByDeclineReason, averageTimeBetweenCollectionAndProcessing, testsCompletedIn24Hours, countOfTestsByEachScientist, totalTestsByYear, timeBetweenCollectionStartAndEnd, getAllMonthsDayByDayTotalTestsSampled] = await Promise.all([
                AscensionAnalytics.totalTestsPerMonth(tenantId),
                AscensionAnalytics.averageProcessingTime(tenantId),
                AscensionAnalytics.totalTestsByApprovalStatus(tenantId),
                AscensionAnalytics.testsSamplePendingApproval(tenantId),
                AscensionAnalytics.recentCollections(tenantId),
                AscensionAnalytics.averageTimeToCollection(tenantId),
                AscensionAnalytics.totalProcessedByMonth(tenantId),
                AscensionAnalytics.testsWithDeclineMessages(tenantId),
                AscensionAnalytics.testsByCollectionStatus(tenantId),
                AscensionAnalytics.averageResultEntryTime(tenantId),
                AscensionAnalytics.testsNotProcessed(tenantId),
                AscensionAnalytics.testsCompletedVsInitiatedVrsUninitiated(tenantId),
                AscensionAnalytics.collectionToProcessingTime(tenantId),
                AscensionAnalytics.testsByScientistApprovalRates(tenantId),
                AscensionAnalytics.testTrendsOverTime(tenantId),
                AscensionAnalytics.testsWithoutActionPlans(tenantId),
                AscensionAnalytics.totalTestsByDeclineReason(tenantId),
                AscensionAnalytics.averageTimeBetweenCollectionAndProcessing(tenantId),
                AscensionAnalytics.testsCompletedIn24Hours(tenantId),
                AscensionAnalytics.countOfTestsByEachScientist(tenantId),
                AscensionAnalytics.totalTestsByYear(tenantId),
                AscensionAnalytics.timeBetweenCollectionStartAndEnd(tenantId),
                AscensionAnalytics.getAllMonthsDayByDayTotalTestsSampled(tenantId, 2024)
            ]);
            return {
                totalTestsPerMonth,
                averageProcessingTime,
                totalTestsByApprovalStatus,
                testsSamplePendingApproval,
                recentCollections,
                averageTimeToCollection,
                totalProcessedByMonth,
                testsWithDeclineMessages,
                testsByCollectionStatus,
                averageResultEntryTime,
                testsNotProcessed,
                testsCompletedVsInitiatedVrsUninitiated,
                collectionToProcessingTime,
                testsByScientistApprovalRates,
                testTrendsOverTime,
                testsWithoutActionPlans,
                totalTestsByDeclineReason,
                averageTimeBetweenCollectionAndProcessing,
                testsCompletedIn24Hours,
                countOfTestsByEachScientist,
                totalTestsByYear,
                timeBetweenCollectionStartAndEnd,
                getAllMonthsDayByDayTotalTestsSampled
            };
        }
        catch (error) {
            throw new Error("Error retrieving analytics data: " + error.message);
        }
    }
    getMonthDayByDayTotalTestSampled(tenantId, month, year) {
        return AscensionAnalytics.dayToDayTotalTestSampleCollectedCompletely(tenantId, month, year);
    }
    getYearlyTotalTestsSampled(tenantId, year) {
        return AscensionAnalytics.yearlyTotalTestsSampleCollected(tenantId, year);
    }
    static async getAllMonthsDayByDayTotalTestsSampled(tenantId, year) {
        const formattedResults = {
            January: [],
            February: [],
            March: [],
            April: [],
            May: [],
            June: [],
            July: [],
            August: [],
            September: [],
            October: [],
            November: [],
            December: []
        };
        for (const { month, name } of AscensionAnalytics.getMonths()) {
            const dailyResults = await this.dayToDayTotalTestSampleCollectedCompletely(tenantId, month, year);
            dailyResults.forEach(row => {
                formattedResults[name].push({
                    day: row.day_of_month,
                    count: row.test_count
                });
            });
        }
        return formattedResults;
    }
    static async getAscensionEditCount(tenantId, ascensionId, billingid) {
        const rows = await (0, helper_1.promisifyQuery)(tenantId, Queries.q_get_AscensionEditCount, [billingid, ascensionId]);
        if (rows.length === 0)
            return 0;
        return rows[0]['counter'];
    }
}
exports.AscensionAnalytics = AscensionAnalytics;
