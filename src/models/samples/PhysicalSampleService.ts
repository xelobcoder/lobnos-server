import { randomUUID } from 'crypto';
import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';

export type PhysicalSampleStatus = 'planned' | 'collection_started' | 'collected' | 'received' | 'accepted' | 'rejected' | 'recollection_required';

const PHYSICAL_SAMPLE_TRANSITIONS: Record<PhysicalSampleStatus, PhysicalSampleStatus[]> = {
     planned: ['collected', 'rejected'],
     collection_started: ['collected', 'rejected'],
     collected: ['received', 'accepted', 'rejected'],
     received: ['accepted', 'rejected'],
     accepted: [],
     rejected: [],
     recollection_required: [],
};

export function canTransitionPhysicalSample(from: PhysicalSampleStatus, to: PhysicalSampleStatus): boolean {
     return PHYSICAL_SAMPLE_TRANSITIONS[from]?.includes(to) || false;
}

export interface CreatePhysicalSampleInput {
     billingid: number;
     ascensionIds: number[];
     action?: 'start' | 'collect' | 'receive';
     quantity?: number | null;
     unit?: string | null;
     notes?: string | null;
     externalFacility?: string | null;
     idempotencyKey?: string | null;
     allowAdditional?: boolean;
     replacesSampleId?: number | null;
     manualOverride?: { sampleTypeId: number; containerTypeId: number; reason: string };
}

export interface SampleRejectionCommunicationInput {
     channels: Array<'sms' | 'email'>;
     message: string;
}

export interface PhysicalSampleReportFilters {
     startDate?: string;
     endDate?: string;
     status?: string;
     search?: string;
     page?: number;
     count?: number;
}

/** Only containers in the same recollection chain belong in a specimen history. */
export function physicalSampleLineage(rows: any[], sampleId: number): any[] {
     const connected = new Set([Number(sampleId)]);
     let expanded = true;
     while (expanded) {
          expanded = false;
          for (const row of rows) {
               const id = Number(row.id);
               const parentId = Number(row.replaces_sample_id);
               if (!parentId || (!connected.has(id) && !connected.has(parentId))) continue;
               for (const next of [id, parentId]) if (!connected.has(next)) { connected.add(next); expanded = true; }
          }
     }
     return rows.filter(row => connected.has(Number(row.id))).sort((left, right) => Number(left.id) - Number(right.id));
}

export function groupPhysicalSampleCandidates(rows: any[]): any[] {
     const groups = new Map<string, any>();
     for (const row of rows) {
          const key = [row.sample_type_id || 0, row.container_type_id || 0, String(row.unit || '').trim().toLowerCase()].join(':');
          if (!groups.has(key)) groups.set(key, {
               requirementKey: key,
               sampleTypeId: row.sample_type_id || null,
               sampleType: row.sample_type_name || 'Unspecified specimen',
               containerTypeId: row.container_type_id || null,
               containerType: row.container_type_name || 'Unspecified container',
               unit: row.unit || null,
               suggestedQuantity: 0,
               ascensions: [],
          });
          const group = groups.get(key);
          const parsedQuantity = Number.parseFloat(String(row.qty_required || ''));
          if (Number.isFinite(parsedQuantity)) group.suggestedQuantity = Math.max(group.suggestedQuantity, parsedQuantity);
          group.ascensions.push({
               ascensionId: Number(row.ascension_id),
               testId: Number(row.testid),
               testName: row.test_name,
               collectionStartDate: row.collectionStartDate,
               collectionEndDate: row.collectionEndDate,
          });
     }
     return [...groups.values()];
}

export class PhysicalSampleService {
     constructor(private readonly tenantId: number) { }

     async worklist(filters: PhysicalSampleReportFilters = {}): Promise<{ summary: Record<string, number>; items: any[]; pagination: any }> {
          const connection = await KnexConnection(this.tenantId);
          const base = connection('physical_samples as sample')
               .join('billing', 'billing.billingid', 'sample.billingid')
               .join('new_patients as patient', 'patient.patientid', 'sample.patientid')
               .leftJoin('roles as collector', 'collector.employeeid', 'sample.collected_by')
               .leftJoin('roles as receiver', 'receiver.employeeid', 'sample.received_by')
               .leftJoin('roles as validator', function () {
                    this.on('validator.employeeid', '=', connection.raw('COALESCE(sample.accepted_by, sample.rejected_by)'));
               })
               .whereNotExists(function (this: Knex.QueryBuilder) {
                    this.select(connection.raw('1'))
                         .from('test_ascension_samples as legacy_link')
                         .join('test_ascension_samples as native_link', 'native_link.ascension_id', 'legacy_link.ascension_id')
                         .join('physical_samples as native_sample', 'native_sample.id', 'native_link.sample_id')
                         .whereRaw('legacy_link.sample_id = sample.id')
                         .where('native_link.is_required', true)
                         .whereNotNull('sample.legacy_ascension_id')
                         .whereNull('native_sample.legacy_ascension_id');
               });
          this.applyReportFilters(base, 'sample.created_at', filters);

          const summaryRows = await base.clone().clearSelect().clearOrder().select('sample.status').countDistinct('sample.id as count').groupBy('sample.status');
          const paging = this.reportPaging(filters);
          const items = await base.clone().select(
               'sample.*',
               connection.raw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) AS patient_name"),
               'patient.fullpatientid',
               'collector.username as collected_by_name',
               'receiver.username as received_by_name',
               'validator.username as validated_by_name',
               connection.raw('(SELECT review.status FROM physical_sample_reviews review WHERE review.sample_id = sample.id ORDER BY review.id DESC LIMIT 1) AS latest_review_status'),
               connection.raw('(SELECT replacement.sample_uid FROM physical_samples replacement WHERE replacement.replaces_sample_id = sample.id ORDER BY replacement.id DESC LIMIT 1) AS replacement_sample_uid'),
               connection.raw('(SELECT replacement.status FROM physical_samples replacement WHERE replacement.replaces_sample_id = sample.id ORDER BY replacement.id DESC LIMIT 1) AS replacement_status'),
               connection.raw("(SELECT GROUP_CONCAT(DISTINCT panel.name ORDER BY panel.name SEPARATOR ', ') FROM test_ascension_samples link INNER JOIN test_ascension ascension ON ascension.id = link.ascension_id INNER JOIN test_panels panel ON panel.id = ascension.testid WHERE link.sample_id = sample.id) AS test_names")
          ).orderBy('sample.created_at', 'desc').limit(paging.count).offset(paging.offset);
          const summary: Record<string, number> = { total: items.length };
          for (const row of summaryRows) summary[String(row.status)] = Number(row.count || 0);
          summary.total = Object.entries(summary).filter(([key]) => key !== 'total').reduce((total, [, count]) => total + Number(count), 0);
          return { summary, items, pagination: { page: paging.page, count: paging.count, total: summary.total, totalPages: Math.ceil(summary.total / paging.count) } };
     }

     async reviewWorklist(filters: PhysicalSampleReportFilters = {}): Promise<{ summary: Record<string, number>; items: any[]; pagination: any }> {
          const connection = await KnexConnection(this.tenantId);
          const base = connection('physical_sample_reviews as review')
               .join('physical_samples as sample', 'sample.id', 'review.sample_id')
               .join('new_patients as patient', 'patient.patientid', 'sample.patientid')
               .leftJoin('roles as requester', 'requester.employeeid', 'review.requested_by')
               .leftJoin('roles as reviewer', 'reviewer.employeeid', 'review.reviewed_by');
          this.applyReportFilters(base, 'review.requested_at', filters, 'review.status');
          const summaryRows = await base.clone().clearSelect().clearOrder().select('review.status').countDistinct('review.id as count').groupBy('review.status');
          const paging = this.reportPaging(filters);
          const items = await base.clone().select(
               'review.*', 'sample.sample_uid', 'sample.billingid', 'sample.sample_type_name', 'sample.container_type_name', 'sample.rejection_reason',
               connection.raw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) AS patient_name"),
               'patient.fullpatientid', 'requester.username as requested_by_name', 'reviewer.username as reviewed_by_name',
               connection.raw("(SELECT GROUP_CONCAT(DISTINCT panel.name ORDER BY panel.name SEPARATOR ', ') FROM test_ascension_samples link INNER JOIN test_ascension ascension ON ascension.id = link.ascension_id INNER JOIN test_panels panel ON panel.id = ascension.testid WHERE link.sample_id = sample.id) AS test_names")
          ).orderBy('review.requested_at', 'desc').limit(paging.count).offset(paging.offset);
          const summary: Record<string, number> = { total: 0 };
          for (const row of summaryRows) { summary[String(row.status)] = Number(row.count || 0); summary.total += Number(row.count || 0); }
          return { summary, items, pagination: { page: paging.page, count: paging.count, total: summary.total, totalPages: Math.ceil(summary.total / paging.count) } };
     }

     async communicationWorklist(filters: PhysicalSampleReportFilters = {}): Promise<{ summary: Record<string, number>; items: any[]; pagination: any }> {
          const connection = await KnexConnection(this.tenantId);
          const base = connection('physical_sample_communications as communication')
               .join('physical_samples as sample', 'sample.id', 'communication.sample_id')
               .join('new_patients as patient', 'patient.patientid', 'communication.patientid')
               .leftJoin('roles as requester', 'requester.employeeid', 'communication.requested_by');
          this.applyReportFilters(base, 'communication.created_at', filters, 'communication.status');
          const paging = this.reportPaging(filters);
          const communicationRows = await base.clone().clearSelect().clearOrder().distinct('communication.id').limit(paging.count).offset(paging.offset);
          await this.reconcileCommunicationStatuses(connection, communicationRows.map((row: any) => Number(row.id)));
          const summaryRows = await base.clone().clearSelect().clearOrder().select('communication.status').countDistinct('communication.id as count').groupBy('communication.status');
          const communications = await base.clone().select(
               'communication.*', 'sample.sample_uid', 'sample.billingid', 'sample.sample_type_name', 'sample.container_type_name', 'sample.rejection_reason',
               connection.raw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) AS patient_name"),
               'patient.fullpatientid', 'requester.username as requested_by_name'
          ).orderBy('communication.created_at', 'desc').limit(paging.count).offset(paging.offset);
          const communicationIds = communications.map((item: any) => Number(item.id));
          const attempts = communicationIds.length ? await connection('physical_sample_delivery_attempts').whereIn('communication_id', communicationIds).orderBy('created_at', 'desc') : [];
          const attemptsByCommunication = new Map<number, any[]>();
          for (const attempt of attempts) attemptsByCommunication.set(Number(attempt.communication_id), [...(attemptsByCommunication.get(Number(attempt.communication_id)) || []), attempt]);
          const summary: Record<string, number> = { total: 0 };
          for (const row of summaryRows) { summary[String(row.status)] = Number(row.count || 0); summary.total += Number(row.count || 0); }
          return { summary, items: communications.map((item: any) => ({ ...item, attempts: attemptsByCommunication.get(Number(item.id)) || [] })), pagination: { page: paging.page, count: paging.count, total: summary.total, totalPages: Math.ceil(summary.total / paging.count) } };
     }

     async auditDetail(sampleId: number): Promise<any> {
          const connection = await KnexConnection(this.tenantId);
          const sample = await this.detail(sampleId, connection);
          const siblings = await connection('physical_samples').where({ billingid: sample.billingid, patientid: sample.patientid }).orderBy('created_at').orderBy('id');
          const lineage = physicalSampleLineage(siblings, sampleId);
          const sampleIds = lineage.map((item: any) => Number(item.id));
          const sampleById = new Map(lineage.map((item: any) => [Number(item.id), item]));
          const events = await connection('physical_sample_events as event')
               .leftJoin('roles as actor', 'actor.employeeid', 'event.actor_employeeid')
               .select('event.*', 'actor.username as actor_name')
               .whereIn('event.sample_id', sampleIds)
               .orderBy('event.created_at').orderBy('event.id');
          const reviews = await connection('physical_sample_reviews as review')
               .leftJoin('roles as requester', 'requester.employeeid', 'review.requested_by')
               .leftJoin('roles as reviewer', 'reviewer.employeeid', 'review.reviewed_by')
               .select('review.*', 'requester.username as requested_by_name', 'reviewer.username as reviewed_by_name')
               .whereIn('review.sample_id', sampleIds)
               .orderBy('review.requested_at');
          const communicationRows = await connection('physical_sample_communications').select('id').whereIn('sample_id', sampleIds);
          await this.reconcileCommunicationStatuses(connection, communicationRows.map((item: any) => Number(item.id)));
          const communications = await connection('physical_sample_communications').whereIn('sample_id', sampleIds).orderBy('created_at');
          const communicationIds = communications.map((item: any) => Number(item.id));
          const attempts = communicationIds.length ? await connection('physical_sample_delivery_attempts').whereIn('communication_id', communicationIds).orderBy('created_at') : [];
          return {
               ...sample,
               lineage,
               events: events.map((event: any) => ({ ...event, sample_uid: sampleById.get(Number(event.sample_id))?.sample_uid })),
               reviews: reviews.map((review: any) => ({ ...review, sample_uid: sampleById.get(Number(review.sample_id))?.sample_uid })),
               communications: communications.map((communication: any) => ({ ...communication, sample_uid: sampleById.get(Number(communication.sample_id))?.sample_uid, attempts: attempts.filter((attempt: any) => Number(attempt.communication_id) === Number(communication.id)) })),
          };
     }

     async candidates(billingid: number): Promise<{ billingid: number; patientid: number; groups: any[]; samples: any[] }> {
          const connection = await KnexConnection(this.tenantId);
          const rows = await this.ascensionRequirementQuery(connection)
               .where('ascension.billingid', billingid)
               .whereNotExists(function (this: Knex.QueryBuilder) {
                    this.select(connection.raw('1')).from('test_ascension_samples as existing_link').whereRaw('existing_link.ascension_id = ascension.id');
               })
               .orderBy('ascension.id');
          if (!rows.length) {
               const billing = await connection('billing').select('patientid').where({ billingid }).first();
               return { billingid, patientid: Number(billing?.patientid || 0), groups: [], samples: await this.listByBilling(billingid) };
          }

          return { billingid, patientid: Number(rows[0].patientid), groups: groupPhysicalSampleCandidates(rows), samples: await this.listByBilling(billingid) };
     }

     async create(input: CreatePhysicalSampleInput, actorEmployeeId: number, parentTransaction?: Knex.Transaction): Promise<any> {
          const ascensionIds = [...new Set((input.ascensionIds || []).map(Number))].sort((left, right) => left - right);
          if (!Number.isInteger(input.billingid) || input.billingid <= 0) throw new Error('Valid billing ID is required');
          if (!ascensionIds.length || ascensionIds.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error('At least one valid ascension ID is required');
          const action = input.action || 'collect';
          if (!['start', 'collect', 'receive'].includes(action)) throw new Error('Sample action must be start, collect or receive');

          const connection = parentTransaction || await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               if (input.idempotencyKey) {
                    const existing = await trx('physical_samples').where({ idempotency_key: input.idempotencyKey }).first();
                    if (existing) return this.detail(existing.id, trx);
               }

               const rows = await this.ascensionRequirementQuery(trx)
                    .whereIn('ascension.id', ascensionIds)
                    .orderBy('ascension.id')
                    .forUpdate();
               if (rows.length !== ascensionIds.length) throw new Error('One or more test ascensions were not found');
               if (rows.some((row: any) => Number(row.billingid) !== input.billingid)) throw new Error('All tests must belong to the same billing order');
               if (new Set(rows.map((row: any) => Number(row.patientid))).size !== 1) throw new Error('All tests must belong to the same patient');

               const requirementKeys = new Set(rows.map((row: any) => [row.sample_type_id || 0, row.container_type_id || 0, String(row.unit || '').trim().toLowerCase()].join(':')));
               if (requirementKeys.size !== 1 && !input.manualOverride) throw new Error('Selected tests require different specimen or container types');
               let actual: any = null;
               if (input.manualOverride) {
                    if (!input.manualOverride.reason?.trim()) throw new Error('A reason is required for a manual container override');
                    const specimen = await trx('sampletype').where({ id: input.manualOverride.sampleTypeId }).first();
                    const container = await trx('samplecontainer').where({ id: input.manualOverride.containerTypeId }).first();
                    if (!specimen || !container) throw new Error('Selected specimen or container type was not found');
                    actual = { sample_type_id: specimen.id, sample_type_name: specimen.name, container_type_id: container.id, container_type_name: container.name };
               }
               // Physical links, not legacy dates (which old bypasses populated), own collection.
               // Ascension row locks above serialize concurrent attempts to create the first container.
               const existingLinks = await trx('test_ascension_samples').whereIn('ascension_id', ascensionIds).first();
               if (!input.allowAdditional && existingLinks) throw new Error('A physical sample is already linked; use its collection or recollection workflow');

               const now = new Date();
               const uid = `S-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
               const first = rows[0];
               const [sampleId] = await trx('physical_samples').insert({
                    sample_uid: uid,
                    barcode: uid,
                    patientid: first.patientid,
                    billingid: input.billingid,
                    sample_type_id: first.sample_type_id || null,
                    sample_type_name: first.sample_type_name || null,
                    container_type_id: first.container_type_id || null,
                    container_type_name: first.container_type_name || null,
                    ...(actual || {}),
                    quantity: input.quantity ?? this.quantityOf(first.qty_required),
                    unit: input.unit || first.unit || null,
                    status: action === 'receive' ? 'received' : action === 'collect' ? 'collected' : 'collection_started',
                    collection_source: action === 'receive' ? 'external' : 'onsite',
                    external_facility: action === 'receive' ? input.externalFacility?.trim() || null : null,
                    collection_started_at: action === 'receive' ? null : now,
                    collection_started_by: action === 'receive' ? null : actorEmployeeId,
                    collected_at: action === 'collect' ? now : null,
                    collected_by: action === 'collect' ? actorEmployeeId : null,
                    received_at: action === 'receive' ? now : null,
                    received_by: action === 'receive' ? actorEmployeeId : null,
                    idempotency_key: input.idempotencyKey || null,
                    notes: input.notes?.trim() || null,
                    replaces_sample_id: input.replacesSampleId || null,
                    created_at: now,
                    updated_at: now,
               });
               await trx('test_ascension_samples').insert(ascensionIds.map((ascensionId) => ({
                    sample_id: sampleId,
                    ascension_id: ascensionId,
                    requirement_key: (() => { const row = rows.find((row: any) => Number(row.ascension_id) === ascensionId); return [row.sample_type_id || 0, row.container_type_id || 0, String(row.unit || '').trim().toLowerCase()].join(':'); })(),
                    is_required: true,
                    created_at: now,
               })));
               const initialStatus = action === 'receive' ? 'received' : action === 'collect' ? 'collected' : 'collection_started';
               await trx('physical_sample_events').insert({ sample_id: sampleId, event_type: initialStatus, from_status: null, to_status: initialStatus, actor_employeeid: actorEmployeeId, reason: input.manualOverride?.reason || (action === 'receive' ? 'Externally collected sample received by the laboratory' : null), sample_version: 1, idempotency_key: input.idempotencyKey ? `${input.idempotencyKey}:event` : null,
                    ...(actual ? { metadata: JSON.stringify({ manual_override: true, actual: { ...actual, quantity: input.quantity, unit: input.unit }, original_requirements: rows.map((row: any) => ({ ascension_id: row.ascension_id, test_name: row.test_name, sample_type_id: row.sample_type_id, sample_type_name: row.sample_type_name, container_type_id: row.container_type_id, container_type_name: row.container_type_name, quantity: row.qty_required, unit: row.unit })) }) } : {}), created_at: now });
               if (action === 'receive') {
                    await trx('test_ascension').whereIn('id', ascensionIds).update({
                         collectionStartDate: trx.raw('COALESCE(collectionStartDate, ?)', [now]),
                         collectionEndDate: trx.raw('COALESCE(collectionEndDate, ?)', [now]),
                    });
               } else {
                    await trx('test_ascension').whereIn('id', ascensionIds).whereNull('collectionStartDate').update({ collectionStartDate: now, sampleCollectedBy: actorEmployeeId });
                    if (action === 'collect') await this.synchronizeCollectedAscensions(trx, ascensionIds, now, actorEmployeeId);
               }
               return this.detail(Number(sampleId), trx);
          });
     }

     async transition(sampleId: number, status: PhysicalSampleStatus, actorEmployeeId: number, reason?: string, options: { expectedVersion?: number; idempotencyKey?: string; communication?: SampleRejectionCommunicationInput } = {}): Promise<any> {
          const allowed: PhysicalSampleStatus[] = ['collected', 'received', 'accepted', 'rejected'];
          if (!allowed.includes(status)) throw new Error('Unsupported sample transition');
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const sample = await trx('physical_samples').where({ id: sampleId }).forUpdate().first();
               if (!sample) throw new Error('Physical sample not found');
               if (sample.storage_state === 'disposed') throw new Error('Disposed specimens cannot be changed');
               if (options.expectedVersion !== undefined && Number(sample.version) !== Number(options.expectedVersion)) throw new Error('Physical sample was changed by another user; reload and try again');
               if (options.idempotencyKey) {
                    const existingEvent = await trx('physical_sample_events').where({ idempotency_key: options.idempotencyKey }).first();
                    if (existingEvent) return this.detail(sampleId, trx);
               }
               const links = await trx('test_ascension_samples').where({ sample_id: sampleId });
               const ascensionIds = links.map((link: any) => Number(link.ascension_id));
               const now = new Date();
               const update: any = { status, version: Number(sample.version || 1) + 1, updated_at: now };
               if (!canTransitionPhysicalSample(sample.status as PhysicalSampleStatus, status)) throw new Error(`Physical sample cannot move from ${sample.status} to ${status}`);

               if (status === 'collected') {
                    if (!sample.collection_started_at) update.collection_started_at = now;
                    if (!sample.collection_started_by) update.collection_started_by = actorEmployeeId;
                    update.collected_at = sample.collected_at || now;
                    update.collected_by = sample.collected_by || actorEmployeeId;
                    await trx('test_ascension').whereIn('id', ascensionIds).whereNull('collectionStartDate').update({ collectionStartDate: sample.collection_started_at || now, sampleCollectedBy: actorEmployeeId });
                    await trx('physical_samples').where({ id: sampleId }).update(update);
                    await this.synchronizeCollectedAscensions(trx, ascensionIds, now, actorEmployeeId);
                    await trx('physical_sample_events').insert({ sample_id: sampleId, event_type: 'collected', from_status: sample.status, to_status: 'collected', actor_employeeid: actorEmployeeId, reason: null, sample_version: update.version, idempotency_key: options.idempotencyKey || null, created_at: now });
                    return this.detail(sampleId, trx);
               } else if (status === 'received') {
                    update.received_at = now;
                    update.received_by = actorEmployeeId;
               } else if (status === 'accepted') {
                    update.accepted_at = now;
                    update.accepted_by = actorEmployeeId;
                    await trx('physical_samples').where({ id: sampleId }).update(update);
                    for (const ascensionId of ascensionIds) {
                         const outstanding = await trx('test_ascension_samples as link')
                              .join('physical_samples as linked_sample', 'linked_sample.id', 'link.sample_id')
                              .where('link.ascension_id', ascensionId)
                              .where('link.is_required', true)
                              .whereNotExists(function () {
                                   this.select(trx.raw('1'))
                                        .from('test_ascension_samples as native_link')
                                        .join('physical_samples as native_sample', 'native_sample.id', 'native_link.sample_id')
                                        .whereRaw('native_link.ascension_id = link.ascension_id')
                                        .where('native_link.is_required', true)
                                        .whereNotNull('linked_sample.legacy_ascension_id')
                                        .whereNull('native_sample.legacy_ascension_id');
                              })
                              .whereNot('linked_sample.status', 'accepted')
                              .whereNotExists(function () {
                                   this.select(trx.raw('1')).from('physical_samples as replacement')
                                        .join('test_ascension_samples as replacement_link', 'replacement_link.sample_id', 'replacement.id')
                                        .whereRaw('replacement.replaces_sample_id = linked_sample.id')
                                        .whereRaw('replacement_link.ascension_id = link.ascension_id')
                                        .where('replacement_link.is_required', true);
                              })
                              .count('* as count')
                              .first();
                         if (Number(outstanding?.count || 0) === 0) await trx('samplestatus').where({ ascensionid: ascensionId }).update({ approvalstatus: 1, validatedby: actorEmployeeId, samplevalidatedon: now, rejectionmessage: null, isRedraw: 0 });
                    }
                    await trx('physical_sample_events').insert({ sample_id: sampleId, event_type: 'accepted', from_status: sample.status, to_status: 'accepted', actor_employeeid: actorEmployeeId, reason: null, sample_version: update.version, idempotency_key: options.idempotencyKey || null, created_at: now });
                    return this.detail(sampleId, trx);
               } else if (status === 'rejected') {
                    if (!reason?.trim()) throw new Error('Rejection reason is required');
                    update.rejected_at = now;
                    update.rejected_by = actorEmployeeId;
                    update.rejection_reason = reason.trim();
                    update.status = 'rejected';
                    if (ascensionIds.length) await trx('samplestatus').whereIn('ascensionid', ascensionIds).update({ approvalstatus: 0, rejectionmessage: reason.trim(), validatedby: actorEmployeeId, samplevalidatedon: now, phelobotomist: actorEmployeeId, date: now, isRedraw: 1, redrawOrderDate: now });
               }
               await trx('physical_samples').where({ id: sampleId }).update(update);
               const [eventId] = await trx('physical_sample_events').insert({ sample_id: sampleId, event_type: status, from_status: sample.status, to_status: status, actor_employeeid: actorEmployeeId, reason: reason?.trim() || null, sample_version: update.version, idempotency_key: options.idempotencyKey || null, created_at: now });
               let communicationId: number | null = null;
               if (status === 'rejected' && options.communication) {
                    const channels = [...new Set(options.communication.channels || [])].filter((channel) => channel === 'sms' || channel === 'email');
                    const message = String(options.communication.message || '').trim();
                    if (channels.length && !message) throw new Error('A patient message is required when SMS or email is selected');
                    const [id] = await trx('physical_sample_communications').insert({ sample_id: sampleId, sample_event_id: eventId, patientid: sample.patientid, message: message || `Sample ${sample.sample_uid} was rejected and requires recollection.`, requested_channels: JSON.stringify(channels), requested_by: actorEmployeeId, preference_snapshot: channels.length ? channels.join(',') : 'none', status: channels.length ? 'pending' : 'none', idempotency_key: `${options.idempotencyKey || eventId}:communication`, created_at: now, updated_at: now });
                    communicationId = Number(id);
               }
               return { ...(await this.detail(sampleId, trx)), communicationId };
          });
     }

     async receiveMany(samples: Array<{ id: number; expectedVersion?: number }>, actorEmployeeId: number): Promise<any[]> {
          const unique = [...new Map(samples.map((sample) => [Number(sample.id), sample])).values()].sort((left, right) => Number(left.id) - Number(right.id));
          if (!unique.length || unique.some((sample) => !Number.isInteger(Number(sample.id)) || Number(sample.id) <= 0)) throw new Error('At least one valid physical sample is required');
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const rows = await trx('physical_samples').whereIn('id', unique.map((sample) => Number(sample.id))).orderBy('id').forUpdate();
               if (rows.length !== unique.length) throw new Error('One or more physical samples were not found');
               if (rows.some((sample: any) => sample.storage_state === 'disposed')) throw new Error('Disposed specimens cannot be changed');
               const expectedById = new Map(unique.map((sample) => [Number(sample.id), sample.expectedVersion]));
               if (rows.some((sample: any) => sample.status !== 'collected')) throw new Error('Only collected samples can be received');
               if (rows.some((sample: any) => expectedById.get(Number(sample.id)) !== undefined && Number(expectedById.get(Number(sample.id))) !== Number(sample.version))) throw new Error('One or more samples changed; reload and try again');
               const now = new Date();
               for (const sample of rows) {
                    const version = Number(sample.version || 1) + 1;
                    await trx('physical_samples').where({ id: sample.id }).update({ status: 'received', received_at: now, received_by: actorEmployeeId, version, updated_at: now });
                    await trx('physical_sample_events').insert({ sample_id: sample.id, event_type: 'received', from_status: 'collected', to_status: 'received', actor_employeeid: actorEmployeeId, reason: null, sample_version: version, created_at: now });
               }
               return Promise.all(rows.map((sample: any) => this.detail(Number(sample.id), trx)));
          });
     }

     async requestReview(sampleId: number, actorEmployeeId: number, reason: string): Promise<any> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const sample = await trx('physical_samples').where({ id: sampleId }).forUpdate().first();
               if (!sample) throw new Error('Physical sample not found');
               if (sample.storage_state === 'disposed') throw new Error('Disposed specimens cannot be reviewed');
               if (sample.status !== 'rejected') throw new Error('Only a rejected sample can be reviewed');
               const rejectionEvent = await trx('physical_sample_events').where({ sample_id: sampleId, event_type: 'rejected' }).orderBy('id', 'desc').first();
               if (!rejectionEvent) throw new Error('Rejection event not found');
               const pending = await trx('physical_sample_reviews').where({ sample_id: sampleId, status: 'pending' }).first();
               if (pending) return pending;
               const [id] = await trx('physical_sample_reviews').insert({ sample_id: sampleId, rejection_event_id: rejectionEvent.id, requested_by: actorEmployeeId, request_reason: reason?.trim() || null, status: 'pending', requested_at: new Date() });
               return trx('physical_sample_reviews').where({ id }).first();
          });
     }

     async decideReview(reviewId: number, actorEmployeeId: number, decision: 'usable' | 'rejection_upheld', notes?: string): Promise<any> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const review = await trx('physical_sample_reviews').where({ id: reviewId }).forUpdate().first();
               if (!review) throw new Error('Sample review not found');
               if (review.status !== 'pending') throw new Error('Sample review is already completed');
               if (Number(review.requested_by) === actorEmployeeId) throw new Error('A different scientist must decide this review');
               const sample = await trx('physical_samples').where({ id: review.sample_id }).forUpdate().first();
               if (!sample || sample.status !== 'rejected') throw new Error('Rejected physical sample not found');
               if (sample.storage_state === 'disposed') throw new Error('Disposed specimens cannot be reviewed');
               const now = new Date();
               await trx('physical_sample_reviews').where({ id: reviewId }).update({ status: decision, reviewed_by: actorEmployeeId, review_notes: notes?.trim() || null, reviewed_at: now });
               if (decision === 'usable') {
                    const links = await trx('test_ascension_samples').where({ sample_id: sample.id });
                    const ascensionIds = links.map((link: any) => Number(link.ascension_id));
                    await trx('physical_samples').where({ id: sample.id }).update({ status: 'accepted', accepted_at: now, accepted_by: actorEmployeeId, version: Number(sample.version) + 1, updated_at: now });
                    await trx('samplestatus').whereIn('ascensionid', ascensionIds).update({ approvalstatus: 1, validatedby: actorEmployeeId, samplevalidatedon: now, rejectionmessage: null, isRedraw: 0 });
                    await trx('physical_sample_events').insert({ sample_id: sample.id, event_type: 'review_accepted', from_status: 'rejected', to_status: 'accepted', actor_employeeid: actorEmployeeId, reason: notes?.trim() || null, sample_version: Number(sample.version) + 1, metadata: JSON.stringify({ reviewId }), created_at: now });
               } else {
                    await trx('physical_samples').where({ id: sample.id }).update({ status: 'recollection_required', version: Number(sample.version) + 1, updated_at: now });
                    await trx('physical_sample_events').insert({ sample_id: sample.id, event_type: 'rejection_upheld', from_status: 'rejected', to_status: 'recollection_required', actor_employeeid: actorEmployeeId, reason: notes?.trim() || null, sample_version: Number(sample.version) + 1, metadata: JSON.stringify({ reviewId }), created_at: now });
               }
               return { review: await trx('physical_sample_reviews').where({ id: reviewId }).first(), sample: await this.detail(sample.id, trx) };
          });
     }

     async findByAscension(ascensionId: number): Promise<any> {
          const connection = await KnexConnection(this.tenantId);
          const link = await connection('test_ascension_samples').where({ ascension_id: ascensionId }).where('is_required', true).orderBy('id', 'desc').first();
          if (!link) throw new Error('No physical sample is linked to this ascension');
          const sample = await this.detail(Number(link.sample_id), connection);
          const latestReview = await connection('physical_sample_reviews').where({ sample_id: link.sample_id }).orderBy('id', 'desc').first();
          return { ...sample, latestReview: latestReview || null };
     }

     async recollect(sampleId: number, actorEmployeeId: number): Promise<any> {
          const connection = await KnexConnection(this.tenantId);
          return connection.transaction(async (trx) => {
               const rejected = await trx('physical_samples').where({ id: sampleId }).forUpdate().first();
               if (!rejected) throw new Error('Physical sample not found');
               if (!['rejected', 'recollection_required'].includes(rejected.status)) throw new Error('Only a rejected sample can be recollected');
               // The original row lock serializes double clicks and network retries.
               // Resume its existing replacement; a later rejection must be recollected from that replacement.
               const replacement = await trx('physical_samples').where({ replaces_sample_id: sampleId }).orderBy('id', 'desc').first();
               if (replacement) return this.detail(Number(replacement.id), trx);
               const links = await trx('test_ascension_samples').where({ sample_id: sampleId });
               if (!links.length) throw new Error('The rejected sample has no linked tests to recollect');
               const ascensionIds = links.map((link: any) => Number(link.ascension_id));
               const now = new Date();
               const uid = `S-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
               const [newSampleId] = await trx('physical_samples').insert({
                    sample_uid: uid, barcode: uid, patientid: rejected.patientid, billingid: rejected.billingid,
                    sample_type_id: rejected.sample_type_id, sample_type_name: rejected.sample_type_name,
                    container_type_id: rejected.container_type_id, container_type_name: rejected.container_type_name,
                    quantity: rejected.quantity, unit: rejected.unit, status: 'collection_started',
                    collection_started_at: now, collection_started_by: actorEmployeeId, replaces_sample_id: sampleId,
                    version: 1, created_at: now, updated_at: now,
               });
               await trx('test_ascension_samples').insert(links.map((link: any) => ({ sample_id: newSampleId, ascension_id: link.ascension_id, requirement_key: link.requirement_key, is_required: true, created_at: now })));
               await trx('test_ascension').whereIn('id', ascensionIds).update({ collectionStartDate: now, collectionEndDate: null, sampleCollectedBy: actorEmployeeId });
               await trx('samplestatus').whereIn('ascensionid', ascensionIds).update({ approvalstatus: 0, rejectionmessage: null, isRedraw: 1, redraw: 1, redrawOrderDate: now, samplevalidatedon: null, validatedby: null });
               await trx('physical_sample_events').insert({ sample_id: newSampleId, event_type: 'recollection_started', from_status: 'recollection_required', to_status: 'collection_started', actor_employeeid: actorEmployeeId, reason: `Recollection of ${rejected.sample_uid}`, sample_version: 1, metadata: JSON.stringify({ replacesSampleId: sampleId }), created_at: now });
               await trx('physical_sample_events').insert({ sample_id: sampleId, event_type: 'replacement_started', from_status: rejected.status, to_status: rejected.status, actor_employeeid: actorEmployeeId, reason: `Replacement ${uid} started`, sample_version: Number(rejected.version || 1), metadata: JSON.stringify({ replacementSampleId: Number(newSampleId) }), created_at: now });
               return this.detail(Number(newSampleId), trx);
          });
     }

     async listByBilling(billingid: number, scope?: any): Promise<any[]> {
          const connection = scope || await KnexConnection(this.tenantId);
          const samples = await connection('physical_samples as sample')
               .where('sample.billingid', billingid)
               .whereNotExists(function (this: Knex.QueryBuilder) {
                    this.select(connection.raw('1'))
                         .from('test_ascension_samples as legacy_link')
                         .join('test_ascension_samples as native_link', 'native_link.ascension_id', 'legacy_link.ascension_id')
                         .join('physical_samples as native_sample', 'native_sample.id', 'native_link.sample_id')
                         .whereRaw('legacy_link.sample_id = sample.id')
                         .where('native_link.is_required', true)
                         .whereNotNull('sample.legacy_ascension_id')
                         .whereNull('native_sample.legacy_ascension_id');
               })
               .select('sample.*')
               .orderBy('sample.created_at');
          return Promise.all(samples.map((sample: any) => this.detail(sample.id, connection)));
     }

     async detail(sampleId: number, scope?: any): Promise<any> {
          const connection = scope || await KnexConnection(this.tenantId);
          const sample = await connection('physical_samples').where({ id: sampleId }).first();
          if (!sample) throw new Error('Physical sample not found');
          const tests = await connection('test_ascension_samples as link')
               .join('test_ascension as ascension', 'ascension.id', 'link.ascension_id')
               .join('test_panels as panel', 'panel.id', 'ascension.testid')
               .select('ascension.id as ascensionId', 'ascension.testid as testId', 'panel.name as testName', 'link.is_required as isRequired')
               .where('link.sample_id', sampleId)
               .orderBy('ascension.id');
          return { ...sample, tests };
     }

     private ascensionRequirementQuery(connection: any): any {
          return connection('test_ascension as ascension')
               .join('billing', 'billing.billingid', 'ascension.billingid')
               .join('test_panels as panel', 'panel.id', 'ascension.testid')
               .leftJoin('sampletype as sample_type', 'sample_type.id', 'panel.sample')
               .leftJoin('samplecontainer as container', 'container.id', 'panel.sample_container')
               .select(
                    'ascension.id as ascension_id', 'ascension.testid', 'ascension.billingid', 'ascension.collectionStartDate', 'ascension.collectionEndDate',
                    'billing.patientid', 'panel.name as test_name', 'panel.sample as sample_type_id', 'sample_type.name as sample_type_name',
                    'panel.sample_container as container_type_id', 'container.name as container_type_name', 'panel.qty_required', 'panel.unit'
               );
     }

     private quantityOf(value: unknown): number | null {
          const quantity = Number.parseFloat(String(value || ''));
          return Number.isFinite(quantity) ? quantity : null;
     }

     private applyReportFilters(query: any, dateColumn: string, filters: PhysicalSampleReportFilters, statusColumn = 'sample.status'): void {
          if (filters.startDate) query.whereRaw(`DATE(${dateColumn}) >= ?`, [filters.startDate]);
          if (filters.endDate) query.whereRaw(`DATE(${dateColumn}) <= ?`, [filters.endDate]);
          if (filters.status === 'rejected_or_recollection') query.whereIn(statusColumn, ['rejected', 'recollection_required']);
          else if (filters.status && filters.status !== 'all') query.where(statusColumn, filters.status);
          if (filters.search?.trim()) {
               const search = `%${filters.search.trim()}%`;
               query.where((builder: any) => builder.where('sample.sample_uid', 'like', search).orWhere('sample.billingid', 'like', search).orWhere('patient.fullpatientid', 'like', search).orWhereRaw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) LIKE ?", [search]));
          }
     }

     private reportPaging(filters: PhysicalSampleReportFilters): { page: number; count: number; offset: number } {
          const page = Math.max(1, Number(filters.page) || 1);
          const count = Math.min(100, Math.max(1, Number(filters.count) || 10));
          return { page, count, offset: (page - 1) * count };
     }

     private async reconcileCommunicationStatuses(connection: any, communicationIds: number[]): Promise<void> {
          if (!communicationIds.length) return;
          const attempts = await connection('physical_sample_delivery_attempts').whereIn('communication_id', communicationIds);
          const emailIds = attempts.map((attempt: any) => Number(attempt.email_queue_id)).filter(Boolean);
          const smsIds = attempts.map((attempt: any) => Number(attempt.sms_recipient_id)).filter(Boolean);
          const emails = emailIds.length ? await connection('email_queue').whereIn('id', emailIds) : [];
          const smsRecipients = smsIds.length ? await connection('primesmsjobrecipients').whereIn('recid', smsIds) : [];
          const emailById = new Map(emails.map((item: any) => [Number(item.id), item]));
          const smsById = new Map(smsRecipients.map((item: any) => [Number(item.recid), item]));

          for (const attempt of attempts) {
               let status = attempt.status;
               let failureReason = attempt.failure_reason;
               let providerMessageId = attempt.provider_message_id;
               if (attempt.email_queue_id) {
                    const email: any = emailById.get(Number(attempt.email_queue_id));
                    status = email?.status === 'sent' ? 'sent' : ['failed', 'cancelled'].includes(String(email?.status)) ? 'failed' : 'queued';
                    failureReason = email?.failure_reason || failureReason;
                    providerMessageId = email?.provider_message_id || providerMessageId;
               } else if (attempt.sms_recipient_id) {
                    const sms: any = smsById.get(Number(attempt.sms_recipient_id));
                    status = sms?.deliverystatus === 'sent' ? 'sent' : sms?.deliverystatus === 'failed' ? 'failed' : 'queued';
                    failureReason = sms?.errorcode || failureReason;
                    providerMessageId = sms?.messageid || providerMessageId;
               }
               if (status !== attempt.status || failureReason !== attempt.failure_reason || providerMessageId !== attempt.provider_message_id) {
                    await connection('physical_sample_delivery_attempts').where({ id: attempt.id }).update({ status, failure_reason: failureReason || null, provider_message_id: providerMessageId || null });
                    Object.assign(attempt, { status, failure_reason: failureReason || null, provider_message_id: providerMessageId || null });
               }
          }

          for (const communicationId of communicationIds) {
               const statuses = attempts.filter((attempt: any) => Number(attempt.communication_id) === communicationId).map((attempt: any) => attempt.status);
               if (!statuses.length) continue;
               const status = statuses.every((value: string) => value === 'sent') ? 'sent' : statuses.every((value: string) => value === 'failed') ? 'failed' : statuses.some((value: string) => value === 'failed') ? 'partial' : 'queued';
               await connection('physical_sample_communications').where({ id: communicationId }).update({ status, updated_at: new Date() });
          }
     }

     private async synchronizeCollectedAscensions(trx: any, ascensionIds: number[], collectedAt: Date, actorEmployeeId: number): Promise<void> {
          for (const ascensionId of ascensionIds) {
               const outstanding = await trx('test_ascension_samples as link')
                    .join('physical_samples as sample', 'sample.id', 'link.sample_id')
                    .where('link.ascension_id', ascensionId)
                    .where('link.is_required', true)
                    .whereNotIn('sample.status', ['collected', 'received', 'accepted'])
                    .whereNotExists(function (this: Knex.QueryBuilder) {
                         this.select(trx.raw('1')).from('physical_samples as replacement')
                              .join('test_ascension_samples as replacement_link', 'replacement_link.sample_id', 'replacement.id')
                              .whereRaw('replacement.replaces_sample_id = sample.id')
                              .whereRaw('replacement_link.ascension_id = link.ascension_id')
                              .where('replacement_link.is_required', true);
                    })
                    .count('* as count')
                    .first();
               if (Number(outstanding?.count || 0) === 0) {
                    await trx('test_ascension').where({ id: ascensionId }).whereNull('collectionEndDate').update({ collectionEndDate: collectedAt, sampleCollectedBy: actorEmployeeId });
               }
          }
     }
}
