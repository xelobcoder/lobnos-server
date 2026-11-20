import { expect, it } from 'vitest';
import { accountingSqlDatabase } from '../../testSupport/accountingSqlDatabase';
import { archiveLaboratoryReport, assertReportAmendmentSigned, clinicalReportHash, laboratoryPrintSnapshot, plainLaboratoryText, readReportSnapshot, reportVersionMetadata } from './LaboratoryReportVersions';

it('removes Markdown heading and emphasis markers from report labels', () => {
     expect(plainLaboratoryText('##### WIDAL TEST')).toBe('WIDAL TEST');
     expect(plainLaboratoryText('  ### **WIDAL** TEST')).toBe('WIDAL TEST');
});

it('does not expose amendment history in the printable report snapshot', () => {
     expect(laboratoryPrintSnapshot({
          testname: 'WIDAL',
          records: [],
          reportVersion: { version: 2, reason: 'Correction', changes: [] },
     })).toEqual({ testname: 'WIDAL', records: [] });
});

it('retains the issued original and releases only the amended revision the validator reviewed', async () => {
     const { db, native } = accountingSqlDatabase();
     try {
          native.exec(`
               CREATE TABLE resultsettings(id INTEGER PRIMARY KEY, resultsEntrySettings TEXT);
               CREATE TABLE test_ascension(id INTEGER PRIMARY KEY, resultEntryEnd TEXT);
               CREATE TABLE dbotestresultapproval(ascensionid INTEGER, approval_revision INTEGER, isapproved INTEGER);
               CREATE TABLE lab_critical_events(ascensionid INTEGER, resolved_at TEXT);
               CREATE TABLE lab_report_versions(id INTEGER PRIMARY KEY, ascensionid INTEGER, revision INTEGER, version_number INTEGER,
                    snapshot TEXT, snapshot_hash TEXT, recorded_at TEXT, reason TEXT, signed_by INTEGER, signer_name TEXT, changes TEXT);
               INSERT INTO test_ascension VALUES (41, '2026-11-15');
               INSERT INTO dbotestresultapproval VALUES (41, 0, 1);
          `);
          const original = { records: [{ fieldid: 2, field: 'Synthetic value', value: '10', units: 'units' }], comments: '' };
          const amended = { records: [{ ...original.records[0], value: '20' }], comments: '' };
          const v1 = await archiveLaboratoryReport(db, 41, 0, original, 'release');
          await db('dbotestresultapproval').where({ ascensionid: 41 }).update({ approval_revision: 1 });
          await expect(archiveLaboratoryReport(db, 41, 1, amended, 'release')).rejects.toThrow('sign-off');
          const signer = { id: 7, name: 'QA Validator', reason: 'Verified source record', reviewHash: clinicalReportHash(amended) };
          await expect(archiveLaboratoryReport(db, 41, 1, { ...amended, comments: 'Unreviewed change' }, 'release', signer)).rejects.toThrow('changed');
          const v2 = await archiveLaboratoryReport(db, 41, 1, amended, 'release', signer);
          expect(reportVersionMetadata(v2)).toMatchObject({
               version: 2, signedBy: 7, signerName: 'QA Validator', reason: 'Verified source record',
               changes: [{ field: 'Synthetic value', before: '10 | units', after: '20 | units' }],
          });
          const released = await archiveLaboratoryReport(db, 41, 1, amended, 'release');
          expect(released.id).toBe(v2.id);
          expect(readReportSnapshot(await db('lab_report_versions').where({ id: v1.id }).first())).toEqual(original);
     } finally {
          await db.destroy();
     }
});

it('allows a revalidated amended report to be archived without a signer when sign-off is disabled', async () => {
     const { db, native } = accountingSqlDatabase();
     try {
          native.exec(`
               CREATE TABLE resultsettings(id INTEGER PRIMARY KEY, resultsEntrySettings TEXT);
               CREATE TABLE test_ascension(id INTEGER PRIMARY KEY, resultEntryEnd TEXT);
               CREATE TABLE dbotestresultapproval(ascensionid INTEGER, approval_revision INTEGER, isapproved INTEGER);
               CREATE TABLE lab_critical_events(ascensionid INTEGER, resolved_at TEXT);
               CREATE TABLE lab_access_settings(id INTEGER PRIMARY KEY, require_amendment_signoff INTEGER);
               CREATE TABLE lab_report_versions(id INTEGER PRIMARY KEY, ascensionid INTEGER, revision INTEGER, version_number INTEGER,
                    snapshot TEXT, snapshot_hash TEXT, recorded_at TEXT, reason TEXT, signed_by INTEGER, signer_name TEXT, changes TEXT);
               INSERT INTO test_ascension VALUES (41, '2026-11-15');
               INSERT INTO dbotestresultapproval VALUES (41, 0, 1);
               INSERT INTO lab_access_settings VALUES (1, 1);
          `);
          const original = { records: [{ fieldid: 2, field: 'Findings', value: 'Normal' }], comments: '' };
          const amended = { records: [{ fieldid: 2, field: 'Findings', value: 'Corrected' }], comments: '' };
          await archiveLaboratoryReport(db, 41, 0, original, 'release');
          await db('dbotestresultapproval').where({ ascensionid: 41 }).update({ approval_revision: 1 });
          await expect(assertReportAmendmentSigned(db, 41, 1)).rejects.toThrow('sign-off');

          await db('lab_access_settings').where({ id: 1 }).update({ require_amendment_signoff: 0 });
          await expect(assertReportAmendmentSigned(db, 41, 1)).resolves.toBeUndefined();
          const unsigned = await archiveLaboratoryReport(db, 41, 1, amended, 'release', undefined, false);
          expect(reportVersionMetadata(unsigned)).toMatchObject({ version: 2, signedBy: null, signerName: null, reason: null });
          expect(readReportSnapshot(await db('lab_report_versions').where({ id: unsigned.id }).first())).toEqual(amended);
     } finally {
          await db.destroy();
     }
});
