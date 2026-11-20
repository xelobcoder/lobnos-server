import { REPORT_AMENDMENT_SIGNOFF_REQUIRED_CODE } from './LaboratoryReportVersions';

export type LaboratoryReportBatchEntry = { ascensionid: number; testid: number };

function isAmendmentSignoffRequired(error: unknown): boolean {
     return typeof error === 'object' && error !== null && 'code' in error &&
          error.code === REPORT_AMENDMENT_SIGNOFF_REQUIRED_CODE;
}

function isUnreleasedResult(error: unknown): boolean {
     return typeof error === 'object' && error !== null && 'code' in error &&
          error.code === 'RESULT_NOT_RELEASED';
}

export async function loadLaboratoryReportBatch<Entry extends LaboratoryReportBatchEntry, Report>(
     entries: readonly Entry[],
     loadReport: (entry: Entry) => Promise<Report>,
): Promise<{ reports: Report[]; includedEntries: Entry[]; skippedTests: LaboratoryReportBatchEntry[] }> {
     const outcomes = await Promise.all(entries.map(async (entry) => {
          try {
               return { kind: 'loaded' as const, entry, report: await loadReport(entry) };
          } catch (error) {
               if (isAmendmentSignoffRequired(error) || isUnreleasedResult(error)) return { kind: 'skipped' as const, entry };
               throw error;
          }
     }));
     const included = outcomes.filter((outcome) => outcome.kind === 'loaded');
     const skipped = outcomes.filter((outcome) => outcome.kind === 'skipped');

     return {
          reports: included.map(({ report }) => report),
          includedEntries: included.map(({ entry }) => entry),
          skippedTests: skipped.map(({ entry }) => ({ ascensionid: entry.ascensionid, testid: entry.testid })),
     };
}
