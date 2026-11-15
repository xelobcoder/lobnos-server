import { createHash } from 'crypto';
import { assertReportRevision } from '../operations/ResultReleaseGuard';
import { controlsFail } from '../operations/LabAccessPolicy';

export const reportVersionTable = 'lab_report_versions';
export const reportHash = (value: string) => createHash('sha256').update(value).digest('hex');

export async function assertReportAmendmentSigned(db: any, ascensionid: number, revision: number) {
     const latest = await db(reportVersionTable).where({ ascensionid }).orderBy('version_number', 'desc').first('revision');
     if (latest && Number(latest.revision) !== revision) {
          return controlsFail('This amended report requires electronic sign-off before delivery', 409);
     }
}

export function readReportSnapshot(row: any) {
     if (reportHash(row.snapshot) !== row.snapshot_hash) return controlsFail('The archived report failed its integrity check', 409);
     return JSON.parse(row.snapshot);
}

export function clinicalReportFields(report: any) {
     const fields = new Map<string, { label: string; value: string }>();
     for (const row of report.records || []) {
          fields.set(`field:${row.fieldid ?? row.id ?? row.field}`, {
               label: row.field,
               value: [row.value, row.units, row.textReference || [row.lowerlimit, row.upperlimit].filter(Boolean).join('–')].filter(x => x != null && x !== '').join(' | '),
          });
     }
     fields.set('comments', { label: 'Report comments', value: String(report.comments ?? '') });
     fields.set('drugs', { label: 'Culture and sensitivity', value: (report.drugList || []).map((item: any) => `${item.drug}: ${item.sensitivity}`).sort().join('\n') });
     fields.set('literature', { label: 'Interpretation / literature', value: String(report.literatureReview ?? '') });
     return fields;
}

export function reportChanges(before: any, after: any) {
     const old = clinicalReportFields(before);
     const next = clinicalReportFields(after);
     return [...new Set([...old.keys(), ...next.keys()])].flatMap(key => {
          const a = old.get(key), b = next.get(key);
          return (a?.value ?? '') === (b?.value ?? '') && a?.label === b?.label ? [] : [{
               field: b?.label ?? a?.label, before: a?.value ?? null, after: b?.value ?? null,
          }];
     });
}

export function clinicalReportHash(report: any) {
     return reportHash(JSON.stringify([...clinicalReportFields(report)].sort(([a], [b]) => a.localeCompare(b))));
}

export function reportVersionMetadata(row: any) {
     return { id: row.id, version: row.version_number, revision: row.revision, reason: row.reason,
          signedBy: row.signed_by, signerName: row.signer_name, recordedAt: row.recorded_at,
          changes: row.changes ? JSON.parse(row.changes) : [] };
}

export async function archiveLaboratoryReport(db: any, ascensionid: number, revision: number, dataset: any,
     channel: 'print' | 'release', signer?: { id: number; name: string; reason: string; reviewHash: string }) {
     return db.transaction(async (trx: any) => {
          await trx('test_ascension').where({ id: ascensionid }).forUpdate().first();
          await assertReportRevision(trx, ascensionid, revision, channel);
          const latest = await trx(reportVersionTable).where({ ascensionid }).orderBy('version_number', 'desc').first();
          if (latest && Number(latest.revision) === revision) {
               if (signer) return controlsFail('This revision is already on record', 409);
               return latest;
          }
          if (latest && !signer) return controlsFail('This amended report requires electronic sign-off before release', 409);
          if (signer && (!latest || clinicalReportHash(dataset) !== signer.reviewHash)) {
               return controlsFail('The report to sign changed. Reload and review the amendment.', 409);
          }
          const snapshot = JSON.stringify(dataset);
          const row = { ascensionid, revision, version_number: latest ? Number(latest.version_number) + 1 : 1,
               snapshot, snapshot_hash: reportHash(snapshot), recorded_at: new Date(),
               reason: signer?.reason ?? null, signed_by: signer?.id ?? null, signer_name: signer?.name ?? null,
               changes: latest ? JSON.stringify(reportChanges(readReportSnapshot(latest), dataset)) : null };
          const [id] = await trx(reportVersionTable).insert(row);
          return { id, ...row };
     });
}
