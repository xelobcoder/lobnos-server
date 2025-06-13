import { TestAscension } from "./ascension";
import { q_get_pending_ascension_cases, q_get_stages_column_dual } from "./queries";
import { ascensionStages, durationTimeFormat } from "./types";
import * as Queries from './ascensionQueries';
import { months } from "../appointments/appointmentTypes";
import { promisifyQuery } from "../../hooks/helper";
export class AscensionAnalytics extends TestAscension {
       constructor(ascensionId: number) {
              super(ascensionId);
       }

       async getCurrentPendingAscensionCasesCount(tenantId: number) {
              const result = await promisifyQuery(tenantId, q_get_pending_ascension_cases);
              if (result.length == 0) return 0;
              return result[0]['pendingcases']
       }

       private static async calCalculateDuration(start: Date, end: Date): Promise<durationTimeFormat> {
              return { hour: 0, min: 0, seconds: 0 }
       }

       async calCulateTimeUsedInEachAscensionStage(tenantId: number, startStage: string, endStage: string): Promise<durationTimeFormat | boolean> {
              if (this.ascensionId || ascensionStages[startStage] || ascensionStages[endStage]) return false;

              const query = q_get_stages_column_dual.replace("start", startStage).replace("end", endStage);

              const result = await promisifyQuery(tenantId, query, [startStage, endStage]);

              if (result.length == 0) return false;
              const startDate = result[0][startStage];
              const endDate = result[0][endStage];
              let duration = AscensionAnalytics.calCalculateDuration(startDate, endDate);
              return duration
       }


       private static getMonths() {
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

       public static async phelobotomistSummary(tenantId: number, phelobotomistid = null) {
              let query = Queries.phelobotomistSummary;
              if (phelobotomistid && typeof phelobotomistid == "number")
                     query += ` WHERE ta.sampleCollectedBy = ?`
              query += ` GROUP BY ta.sampleCollectedBy`
              return await promisifyQuery(tenantId, Queries.phelobotomistSummary, [phelobotomistid]);
       }

       private static async approvedTestsPerScientist(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.approvedTestsPerScientist);
       }

       private static async approvalRatePerScientist(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.approvalRatePerScientist);
       }

       private static async totalTestsPerMonth(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalTestsPerMonth);
       }

       private static async averageProcessingTime(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.averageProcessingTime);
       }

       private static async totalTestsByApprovalStatus(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalTestsByApprovalStatus);
       }

       private static async testsSamplePendingApproval(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsSamplePendingApproval);
       }

       private static async recentCollections(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.recentCollections);
       }

       private static async averageTimeToCollection(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.averageTimeToCollection);
       }

       private static async totalProcessedByMonth(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalProcessedByMonth);
       }

       private static async testsWithDeclineMessages(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsWithDeclineMessages);
       }



       private static async testsByCollectionStatus(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsByCollectionStatus);
       }

       private static async averageResultEntryTime(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.averageResultEntryTime);
       }

       private static async testsByServiceType(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsByServiceType);
       }

       public static async monthlyApprovalRate(tenantId: number, date: number) {
              let result = await promisifyQuery(tenantId, Queries.monthlyApprovalRate, [date]);
              if (result.length > 0) {
                     result = result.map((item: { month: number, year: number, monthly_approval_rate: number, test_count: number }, index: number) => {
                            for (const [key, value] of Object.entries(months)) {
                                   if (value === item.month) {
                                          return { ...item, month: key };
                                   }
                            }
                            return item;
                     })
              }
              return result;
       }

       private static async testsNotProcessed(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsNotProcessed);
       }

       private static async testsCompletedVsInitiatedVrsUninitiated(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsCompletedVsInitiatedVrsUninitiated);
       }

       private static async collectionToProcessingTime(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.collectionToProcessingTime);
       }

       private static async testsByScientistApprovalRates(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsByScientistApprovalRates);
       }

       private static async testTrendsOverTime(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testTrendsOverTime);
       }

       private static async testsWithoutActionPlans(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsWithoutActionPlans);
       }

       private static async comparisonOfCollectionStartDates(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.comparisonOfCollectionStartDates);
       }

       private static async totalTestsByDeclineReason(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalTestsByDeclineReason);
       }

       private static async averageTimeBetweenCollectionAndProcessing(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.averageTimeBetweenCollectionAndProcessing);
       }

       private static async testsCompletedIn24Hours(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsCompletedIn24Hours);
       }

       private static async countOfTestsByEachScientist(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.countOfTestsByEachScientist);
       }


       private static async testsWithProcessingDelays(tenantId: number, expected_time: number) {
              return await promisifyQuery(tenantId, Queries.testsWithProcessingDelays(expected_time));
       }

       public static async totalTestsByYear(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalTestsByYear);
       }


       private static async yearlyTotalTestsSampleCollected(tenantId: number, year: number) {
              return await promisifyQuery(tenantId, Queries.yearlyTotalTestsSampleCollected, [year]);
       }

       private static async timeBetweenCollectionStartAndEnd(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.minMaxAvgTimeBetweenCollectionStartAndEnd);
       }


       private static async dayToDayTotalTestSampleCollectedCompletely(tenantId: number, month: number, year: number) {
              return await promisifyQuery(tenantId, Queries.dayToDayTotalTestSampleCollectedCompletely, [month, year])
       }

       public static async getCollectionToDisputeToApprovedToRedrawnLast30days(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalTestCollectedWithApprovalRateWithRejectionAdisputedOnLast31);
       }

       public static async getCollectionToDisputeToApprovedToRedrawnOverAmonthBasedOnYear(tenantId: number, year: number, month: number) {
              return await promisifyQuery(tenantId, Queries.CollectionToDisputeToApprovedToRedrawnLastOfAMonth, [month, year]);
       }

       public static async getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear(tenantId: number, year: number) {
              return await promisifyQuery(tenantId, Queries.getCollectionToDisputeToApprovedToRedrawnLastOverApacticularYear, [year]);
       }

       private static async totalSamplePendingCollection24(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.totalSamplePendingCollectionWithDateIn24Hours);
       }

       private static async totalSampleRedrawOrders24(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsRedrawOrdersIn24Hours);
       }

       private static async totalSampleRejected24(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsRejectedIn24Hours);
       }

       private static async totalSampleRedrawCompleted24(tenantId: number) {
              return await promisifyQuery(tenantId, Queries.testsRedrawOrdersCompletedIn24Hours);
       }

       public static async phelobotomistAnalytics24Hours(tenantId: number): Promise<{ pending: [], rejected: [], orders: [], completed: [] }> {
              let pending = await this.totalSamplePendingCollection24(tenantId);
              let rejected = await this.totalSampleRejected24(tenantId);
              let orders = await this.totalSampleRedrawOrders24(tenantId);
              let completed = await this.totalSampleRedrawCompleted24(tenantId);

              rejected = rejected[0]['tests_rejected_in_24h'];
              completed = completed[0]['redraw_orders_completed_in_24h']
              orders = orders[0]['redraw_orders_in_24h']
              pending = pending[0]['pending'];

              return { pending, rejected, orders, completed };
       }


       public async getAllAnalytics(tenantId: number) {
              try {
                     const [
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
                     ] = await Promise.all([
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
                     }
              } catch (error) {
                     throw new Error("Error retrieving analytics data: " + error.message);
              }
       }

       public getMonthDayByDayTotalTestSampled(tenantId: number, month: number, year: number) {
              return AscensionAnalytics.dayToDayTotalTestSampleCollectedCompletely(tenantId, month, year);
       }

       public getYearlyTotalTestsSampled(tenantId: number, year: number) {
              return AscensionAnalytics.yearlyTotalTestsSampleCollected(tenantId, year);
       }


       private static async getAllMonthsDayByDayTotalTestsSampled(tenantId: number, year: number) {

              const formattedResults: { [key: string]: { day: number; count: number }[] } = {
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

       public static async getAscensionEditCount(tenantId: number, ascensionId: number, billingid: number): Promise<number> {
              const rows = await promisifyQuery(tenantId, Queries.q_get_AscensionEditCount, [billingid, ascensionId]);
              if (rows.length === 0) return 0
              return rows[0]['counter'];
       }


}



