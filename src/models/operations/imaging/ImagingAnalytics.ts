import ImagingAnalyticsWithDate from "./ImagingAnalyticsWithDate";

export type ImagingBreakdown = "modality" | "day";

export class ImagingAnalytics {
     public static async getImagingAnalytics(tenantId: number, startDate: string, endDate: string, breakdowns: ImagingBreakdown[] = []) {
          const source = new ImagingAnalyticsWithDate(tenantId);
          const [totalsRows, userRows, modalityRows, dayRows] = await Promise.all([
               source.totals(startDate, endDate),
               source.casesByUser(startDate, endDate),
               breakdowns.includes("modality") ? source.casesByModality(startDate, endDate) : Promise.resolve(null),
               breakdowns.includes("day") ? source.casesByDay(startDate, endDate) : Promise.resolve(null),
          ]);

          const result: Record<string, unknown> = {
               startDate,
               endDate,
               totalCasesWithResults: Number(totalsRows?.[0]?.casesWithResults || 0),
               totalUltrasoundCases: Number(totalsRows?.[0]?.ultrasoundCases || 0),
               casesByUser: (userRows || []).map((row: any) => ({
                    employeeid: row.employeeid ?? null,
                    employeeName: row.employeeName ?? null,
                    role: row.role ?? null,
                    casesWorked: Number(row.casesWorked || 0),
                    ultrasoundCases: Number(row.ultrasoundCases || 0),
               })),
          };
          if (modalityRows) result.casesByModality = modalityRows.map((row: any) => ({ modality: row.modality, cases: Number(row.cases || 0) }));
          if (dayRows) result.casesByDay = dayRows.map((row: any) => ({ day: row.day, cases: Number(row.cases || 0), ultrasoundCases: Number(row.ultrasoundCases || 0) }));
          return result;
     }
}
