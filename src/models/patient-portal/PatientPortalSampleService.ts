import KnexConnection from '../../database/KnexConnections';
import { PatientPortalError } from './PatientPortalAccountService';
import { PhysicalSampleService } from '../samples/PhysicalSampleService';

const positiveId = (value: number) => Number.isSafeInteger(value) && value > 0;

/** Patient-facing projection: never expose staff, delivery recipients or internal event metadata. */
export function portalSample(sample: any) {
     return {
          id: Number(sample.id), barcode: sample.barcode || sample.sample_uid, sampleUid: sample.sample_uid,
          billingid: Number(sample.billingid), status: sample.status, sampleType: sample.sample_type_name || 'Specimen',
          containerType: sample.container_type_name || 'Container', replacesSampleId: sample.replaces_sample_id ? Number(sample.replaces_sample_id) : null,
          createdAt: sample.created_at, collectedAt: sample.collected_at, receivedAt: sample.received_at,
          acceptedAt: sample.accepted_at, rejectedAt: sample.rejected_at, rejectionReason: sample.rejection_reason || null,
     };
}

export class PatientPortalSampleService {
     constructor(private readonly tenantId: number) { }

     async list(patientid: number, page = 1) {
          if (!positiveId(patientid) || !positiveId(page)) throw new PatientPortalError('Invalid sample request', 400);
          const db = await KnexConnection(this.tenantId);
          const base = db('physical_samples').where({ patientid });
          const [count, samples] = await Promise.all([
               base.clone().count({ total: '*' }).first(),
               base.clone().select('id', 'barcode', 'sample_uid', 'billingid', 'status', 'sample_type_name', 'container_type_name',
                    'replaces_sample_id', 'created_at', 'collected_at', 'received_at', 'accepted_at', 'rejected_at', 'rejection_reason')
                    .orderBy('created_at', 'desc').orderBy('id', 'desc').limit(25).offset((page - 1) * 25),
          ]);
          const total = Number((count as any)?.total || 0);
          const replacements = samples.length ? await db('physical_samples').where({ patientid })
               .whereIn('replaces_sample_id', samples.map(sample => sample.id))
               .select('id', 'sample_uid', 'status', 'replaces_sample_id').orderBy('id', 'desc') : [];
          const replacementByParent = new Map<number, any>();
          for (const replacement of replacements) {
               if (!replacementByParent.has(Number(replacement.replaces_sample_id))) {
                    replacementByParent.set(Number(replacement.replaces_sample_id), replacement);
               }
          }
          return { items: samples.map(sample => {
               const replacement = replacementByParent.get(Number(sample.id));
               return { ...portalSample(sample), replacement: replacement ? {
                    id: Number(replacement.id), sampleUid: replacement.sample_uid, status: replacement.status,
               } : null };
          }), page, total, totalPages: Math.ceil(total / 25) };
     }

     async history(patientid: number, sampleId: number) {
          if (!positiveId(patientid) || !positiveId(sampleId)) throw new PatientPortalError('Invalid sample request', 400);
          const db = await KnexConnection(this.tenantId);
          // Authorization precedes the staff audit service, including any delivery reconciliation.
          if (!await db('physical_samples').where({ patientid, id: sampleId }).first('id')) {
               throw new PatientPortalError('Sample not found', 404, 'NOT_FOUND');
          }
          const detail = await new PhysicalSampleService(this.tenantId).auditDetail(sampleId);
          if (Number(detail.patientid) !== patientid) throw new PatientPortalError('Sample not found', 404, 'NOT_FOUND');
          const lineage = (detail.lineage || [detail]).filter((sample: any) => Number(sample.patientid) === patientid);
          const ids = new Set(lineage.map((sample: any) => Number(sample.id)));
          return {
               sample: portalSample(detail), lineage: lineage.map(portalSample),
               events: (detail.events || []).filter((event: any) => ids.has(Number(event.sample_id)) &&
                    ['created', 'collection_started', 'collected', 'received', 'accepted', 'rejected', 'review_accepted',
                         'rejection_upheld', 'recollection_started', 'replacement_started'].includes(event.event_type))
                    .map((event: any) => ({ id: Number(event.id), sampleId: Number(event.sample_id), sampleUid: event.sample_uid,
                         type: event.event_type, status: event.to_status, createdAt: event.created_at,
                         reason: ['rejected', 'rejection_upheld'].includes(event.event_type) ? event.reason || null : null })),
               communications: (detail.communications || []).filter((message: any) => ids.has(Number(message.sample_id)))
                    .map((message: any) => ({ sampleUid: message.sample_uid, message: message.message, status: message.status,
                         createdAt: message.created_at })),
          };
     }
}
