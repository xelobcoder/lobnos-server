import { describe, expect, it } from 'vitest';
import { REPORT_AMENDMENT_SIGNOFF_REQUIRED_CODE } from './LaboratoryReportVersions';
import { loadLaboratoryReportBatch } from './LaboratoryReportBatch';

describe('loadLaboratoryReportBatch', () => {
     it('skips only amendment-signoff-blocked reports and keeps other reports in order', async () => {
          const entries = [
               { ascensionid: 11, testid: 101 },
               { ascensionid: 12, testid: 102 },
               { ascensionid: 13, testid: 103 },
          ];
          const result = await loadLaboratoryReportBatch(entries, async (entry) => {
               if (entry.ascensionid === 12) {
                    throw Object.assign(new Error('Sign-off required'), { code: REPORT_AMENDMENT_SIGNOFF_REQUIRED_CODE });
               }
               return `report-${entry.ascensionid}`;
          });

          expect(result.reports).toEqual(['report-11', 'report-13']);
          expect(result.includedEntries).toEqual([entries[0], entries[2]]);
          expect(result.skippedTests).toEqual([{ ascensionid: 12, testid: 102 }]);
     });

     it('still rejects unrelated report-loading errors', async () => {
          const failure = new Error('Database unavailable');
          await expect(loadLaboratoryReportBatch(
               [{ ascensionid: 11, testid: 101 }],
               async () => { throw failure; },
          )).rejects.toBe(failure);
     });
});
