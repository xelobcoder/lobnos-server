import { createHash } from 'crypto';
import KnexConnection from '../../database/KnexConnections';
import { AuthUser } from '../../middleware/authority';
import { roleAllowed } from '../../middleware/roles';
import { PhysicalSampleService } from './PhysicalSampleService';

export function validateCollectionPlan(input: any) {
     const billingid = Number(input.billingid);
     const reason = String(input.reason || '').trim();
     const key = String(input.idempotencyKey || '').trim();
     if (!Number.isSafeInteger(billingid) || billingid <= 0 || !reason || reason.length > 1000 || !key || key.length > 60) throw new Error('Billing, an override reason (up to 1000 characters), and a retry key are required');
     if (!Array.isArray(input.containers) || !input.containers.length || input.containers.length > 30) throw new Error('Enter between one and 30 actual containers');
     const containers = input.containers.map((container: any) => {
          if (!container || !Array.isArray(container.ascensionIds)) throw new Error('Each container needs a list of ordered tests');
          const ascensionIds = [...new Set<number>((container.ascensionIds || []).map(Number))].sort((a, b) => a - b);
          const sampleTypeId = Number(container.sampleTypeId), containerTypeId = Number(container.containerTypeId), quantity = Number(container.quantity);
          const unit = String(container.unit || '').trim().toLowerCase();
          if (!ascensionIds.length || ascensionIds.some(id => !Number.isSafeInteger(id) || id <= 0) || !Number.isSafeInteger(sampleTypeId) || sampleTypeId <= 0 || !Number.isSafeInteger(containerTypeId) || containerTypeId <= 0 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 99999999 || !unit || unit.length > 30) throw new Error('Each container needs tests, a specimen type, a tube type, positive actual quantity and unit');
          if (Math.abs(quantity * 100 - Math.round(quantity * 100)) > 0.00001) throw new Error('Container quantity supports at most two decimal places');
          return { ascensionIds, sampleTypeId, containerTypeId, quantity, unit };
     });
     const drawnQuantity = input.drawnQuantity === '' || input.drawnQuantity == null ? null : Number(input.drawnQuantity);
     if (drawnQuantity !== null && (!Number.isFinite(drawnQuantity) || drawnQuantity <= 0 || new Set(containers.map(c => c.unit)).size !== 1 || Math.abs(containers.reduce((sum, c) => sum + c.quantity, 0) - drawnQuantity) > 0.00001)) throw new Error('Container quantities must add up to the draw amount in the same unit');
     const collectionCenterId = input.collectionCenterId;
     if (collectionCenterId != null && (typeof collectionCenterId !== 'number' || !Number.isSafeInteger(collectionCenterId) || collectionCenterId < 1)) {
          throw new Error('Select a valid collection center');
     }
     return { billingid, reason, key, drawnQuantity, containers, collectionCenterId: collectionCenterId ?? undefined };
}

export class CollectionPlanService {
     constructor(private tenantId: number) {}
     async options() {
          const db = await KnexConnection(this.tenantId);
          const [sampleTypes, containerTypes] = await Promise.all([db('sampletype').select('id', 'name').orderBy('name'), db('samplecontainer').select('id', 'name').orderBy('name')]);
          return { sampleTypes, containerTypes };
     }
     async create(actor: AuthUser, input: any) {
          const plan = validateCollectionPlan(input);
          const db = await KnexConnection(this.tenantId);
          const hash = createHash('sha256').update(JSON.stringify({ ...plan, key: undefined })).digest('hex');
          return db.transaction(async trx => {
               let billingQuery = trx('billing').where({ billingid: plan.billingid });
               if (actor.branch != null) billingQuery = billingQuery.where('branchid', actor.branch);
               else if (!roleAllowed(actor.role, ['admin', 'manager'])) throw new Error('A branch is required for collection staff');
               const bill = await billingQuery.forUpdate().first();
               if (!bill) throw new Error('Billing order not found in your branch');
               const prior = await trx('physical_sample_events').where({ idempotency_key: `PLAN:${plan.key}` }).first();
               const samples = new PhysicalSampleService(this.tenantId);
               if (prior) {
                    const metadata = typeof prior.metadata === 'string' ? JSON.parse(prior.metadata) : prior.metadata;
                    if (metadata.request_hash !== hash || Number(metadata.billingid) !== plan.billingid) throw new Error('Retry key was used for a different collection plan');
                    return Promise.all(metadata.sample_ids.map((id: number) => samples.detail(id, trx)));
               }
               const ids = [...new Set<number>(plan.containers.flatMap(c => c.ascensionIds))].sort((a, b) => a - b);
               const tests = await trx('test_ascension').whereIn('id', ids).orderBy('id').forUpdate();
               if (tests.length !== ids.length || tests.some(test => Number(test.billingid) !== plan.billingid)) throw new Error('All tests must belong to this patient billing order');
               if (tests.some(test => test.processingStartDate || test.processingEndDate || test.resultEntryEnd)) throw new Error('Container overrides must be recorded before laboratory processing');
               if (await trx('test_ascension_samples').whereIn('ascension_id', ids).first()) throw new Error('These tests already have physical containers. Reload the collection screen before planning');
               const created: any[] = [];
               for (const [index, container] of plan.containers.entries()) {
                    created.push(await samples.create({ consent: input.consent, billingid: plan.billingid, ...container, action: 'start', allowAdditional: true,
                         collectionCenterId: plan.collectionCenterId, collectionBranchId: actor.branch,
                         manualOverride: { sampleTypeId: container.sampleTypeId, containerTypeId: container.containerTypeId, reason: plan.reason },
                         idempotencyKey: `PLAN:${plan.key}:${index}` }, actor.employeeid, trx));
               }
               await trx('physical_sample_events').insert(created.map((sample, index) => ({ sample_id: sample.id, event_type: 'collection_plan_override', from_status: null, to_status: 'collection_started', actor_employeeid: actor.employeeid,
                    reason: plan.reason, sample_version: 1, idempotency_key: index === 0 ? `PLAN:${plan.key}` : null, metadata: JSON.stringify({ request_hash: hash, billingid: plan.billingid, sample_ids: created.map(sample => Number(sample.id)), drawn_quantity: plan.drawnQuantity, containers: plan.containers }), created_at: new Date() })));
               return created;
          });
     }
}
