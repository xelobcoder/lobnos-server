import { createHash, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import type { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { roleAllowed } from '../../middleware/roles';

export class SpecimenLifecycleError extends Error {
     constructor(message: string, readonly statusCode = 400) { super(message); }
}

export interface LifecycleMutation {
     expectedVersion: number;
     idempotencyKey?: string;
     [key: string]: unknown;
}

const states = ['available', 'stored', 'retrieved', 'disposed'];
const storableStatuses = ['collected', 'received', 'accepted'];
const retrievableStatuses = [...storableStatuses, 'rejected', 'recollection_required'];
const scientificRoles = ['admin', 'manager', 'scientist'];
const collectionRoles = [...scientificRoles, 'phelobotomist', 'phlebotomist'];

export function specimenLifecycleCapabilities(role: unknown, sample: any) {
     const state = sample.storage_state || 'available';
     const live = state !== 'disposed';
     const accepted = sample.status === 'accepted';
     const scientific = roleAllowed(role, scientificRoles);
     const collector = roleAllowed(role, collectionRoles);
     return {
          canAliquot: scientific && live && accepted && state !== 'stored' && !!sample.unit && Number(sample.remaining_quantity ?? sample.quantity ?? 0) > 0,
          canStore: collector && live && storableStatuses.includes(sample.status),
          canRetrieve: collector && state === 'stored' && !!sample.storage_position_id && retrievableStatuses.includes(sample.status),
          canSetRetention: scientific && live && ['accepted', 'rejected'].includes(sample.status),
          canDispose: scientific && live && ['accepted', 'rejected'].includes(sample.status),
          canManageLocations: roleAllowed(role, ['admin', 'manager']),
          canOverrideRetention: roleAllowed(role, ['admin', 'manager']),
     };
}

function id(value: unknown, label: string): number {
     if ((typeof value !== 'number' && typeof value !== 'string') || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
          throw new SpecimenLifecycleError(`A valid ${label} is required`);
     }
     return Number(value);
}

function text(value: unknown, label: string, maximum: number, required = true): string | null {
     if (value === undefined || value === null || value === '') {
          if (required) throw new SpecimenLifecycleError(`${label} is required`);
          return null;
     }
     if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) {
          throw new SpecimenLifecycleError(`${label} must contain 1 to ${maximum} characters`);
     }
     return value.trim();
}

function metadata(value: unknown): Record<string, any> {
     if (!value) return {};
     if (typeof value === 'string') { try { return JSON.parse(value); } catch { return {}; } }
     return value as Record<string, any>;
}

function quantity(value: unknown): Decimal {
     if ((typeof value !== 'number' && typeof value !== 'string') || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) {
          throw new SpecimenLifecycleError('Quantity must be a positive number with at most two decimal places');
     }
     const amount = new Decimal(value);
     if (!amount.isFinite() || amount.lte(0) || amount.gt('99999999.99')) throw new SpecimenLifecycleError('Quantity is outside the supported range');
     return amount;
}

export class SpecimenLifecycleService {
     constructor(private readonly tenantId: number) { id(tenantId, 'tenant ID'); }

     async worklist(filters: Record<string, any> = {}): Promise<any> {
          const db = await KnexConnection(this.tenantId);
          const page = filters.page === undefined ? 1 : id(filters.page, 'page');
          const count = Math.min(filters.count === undefined ? 25 : id(filters.count, 'page size'), 100);
          const base = db('physical_samples as sample')
               .join('new_patients as patient', 'patient.patientid', 'sample.patientid')
               .leftJoin('specimen_storage_positions as location', 'location.id', 'sample.storage_position_id')
               .leftJoin('physical_samples as parent', 'parent.id', 'sample.parent_sample_id')
               .whereIn('sample.status', retrievableStatuses);
          if (filters.state) {
               if (!states.includes(filters.state)) throw new SpecimenLifecycleError('Invalid storage state');
               base.where('sample.storage_state', filters.state);
          }
          if (filters.retention) {
               if (filters.retention !== 'due') throw new SpecimenLifecycleError('Invalid retention filter');
               base.whereNotNull('sample.retention_until').where('sample.retention_until', '<=', new Date()).whereNot('sample.storage_state', 'disposed');
          }
          if (filters.search) {
               const search = text(filters.search, 'Search', 100)!;
               base.where(function (this: Knex.QueryBuilder) {
                    this.where('sample.barcode', 'like', `%${search}%`).orWhere('sample.sample_uid', 'like', `%${search}%`).orWhere('patient.fullpatientid', 'like', `%${search}%`)
                         .orWhereRaw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) LIKE ?", [`%${search}%`]);
                    if (/^[1-9]\d*$/.test(search) && Number.isSafeInteger(Number(search))) {
                         this.orWhere('sample.id', Number(search)).orWhere('sample.billingid', Number(search));
                    }
               });
          }
          const totalRow: any = await base.clone().count('sample.id as total').first();
          const total = Number(totalRow?.total || 0);
          const items = await base.select('sample.*', 'location.freezer', 'location.rack', 'location.position', 'parent.barcode as parent_barcode', 'patient.fullpatientid',
               db.raw("CONCAT_WS(' ', patient.firstname, patient.middlename, patient.lastname) AS patient_name"),
               db.raw('COALESCE(sample.remaining_quantity, sample.quantity) AS remaining_quantity'),
               db.raw('(SELECT COUNT(*) FROM physical_samples child WHERE child.parent_sample_id = sample.id) AS aliquot_count'))
               .orderBy('sample.created_at', 'desc').orderBy('sample.id', 'desc').limit(count).offset((page - 1) * count);
          return { items, pagination: { page, count, total, totalPages: Math.ceil(total / count) } };
     }

     async positions(): Promise<any[]> {
          const db = await KnexConnection(this.tenantId);
          return db('specimen_storage_positions as location')
               .leftJoin('physical_samples as sample', 'sample.storage_position_id', 'location.id')
               .select('location.*', 'sample.id as sample_id', 'sample.barcode as sample_barcode')
               .orderBy('location.freezer').orderBy('location.rack').orderBy('location.position');
     }

     async createPosition(input: any, actorEmployeeId: number): Promise<any> {
          id(actorEmployeeId, 'employee ID');
          const freezer = text(input?.freezer, 'Freezer', 100)!;
          const rack = text(input?.rack, 'Rack', 100)!;
          const position = text(input?.position, 'Position', 100)!;
          const notes = text(input?.notes, 'Notes', 2000, false);
          const suppliedTemperature = input?.temperatureC;
          const temperature = suppliedTemperature === undefined || suppliedTemperature === null || suppliedTemperature === '' ? null : Number(suppliedTemperature);
          if (temperature !== null && (typeof suppliedTemperature === 'boolean' || !Number.isFinite(temperature) || temperature < -273.15 || temperature > 1000)) {
               throw new SpecimenLifecycleError('Enter a valid storage temperature in Celsius');
          }
          const db = await KnexConnection(this.tenantId);
          try {
               const [positionId] = await db('specimen_storage_positions').insert({
                    freezer, rack, position, notes, temperature_c: temperature, is_active: true, created_by: actorEmployeeId,
                    created_at: new Date(), updated_at: new Date(),
               });
               return { id: Number(positionId), freezer, rack, position, notes, temperature_c: temperature, is_active: true, sample_id: null };
          } catch (error: any) {
               if (error.code === 'ER_DUP_ENTRY') throw new SpecimenLifecycleError('That freezer, rack and position already exist', 409);
               throw error;
          }
     }

     async detail(sampleId: number, role?: unknown): Promise<any> {
          id(sampleId, 'sample ID');
          const db = await KnexConnection(this.tenantId);
          const sample = await db('physical_samples').where({ id: sampleId }).first();
          if (!sample) throw new SpecimenLifecycleError('Physical sample not found', 404);
          sample.remaining_quantity = sample.remaining_quantity ?? sample.quantity;
          sample.storage_state = sample.storage_state || 'available';
          const parent = sample.parent_sample_id ? await db('physical_samples').where({ id: sample.parent_sample_id }).first() : null;
          const aliquots = await db('physical_samples').where({ parent_sample_id: sampleId }).orderBy('id');
          const storagePosition = sample.storage_position_id ? await db('specimen_storage_positions').where({ id: sample.storage_position_id }).first() : null;
          const events = await db('physical_sample_events as event').leftJoin('roles as actor', 'actor.employeeid', 'event.actor_employeeid')
               .where('event.sample_id', sampleId).select('event.*', 'actor.username as actor_name').orderBy('event.id', 'desc');
          return { sample, parent: parent || null, aliquots, storagePosition: storagePosition || null,
               events: events.map((event: any) => ({ ...event, metadata: metadata(event.metadata) })),
               capabilities: specimenLifecycleCapabilities(role, sample) };
     }

     async aliquot(sampleId: number, input: LifecycleMutation, actorEmployeeId: number): Promise<any> {
          const amount = quantity(input?.quantity);
          const notes = text(input?.notes, 'Notes', 2000, false);
          await this.mutate(sampleId, input, actorEmployeeId, 'aliquot_created', async (trx, sample, now) => {
               this.requireAccepted(sample);
               if (sample.storage_state === 'stored') throw new SpecimenLifecycleError('Retrieve the specimen before creating an aliquot', 409);
               if (!sample.unit) throw new SpecimenLifecycleError('The parent specimen needs a recorded quantity unit before aliquoting');
               const remaining = quantity(sample.remaining_quantity ?? sample.quantity);
               if (amount.gt(remaining)) throw new SpecimenLifecycleError('Aliquot quantity exceeds the remaining parent quantity', 409);
               const barcode = `A-${randomUUID().toUpperCase()}`;
               const [childId] = await trx('physical_samples').insert({
                    sample_uid: barcode, barcode, parent_sample_id: sampleId, patientid: sample.patientid, billingid: sample.billingid,
                    sample_type_id: sample.sample_type_id, sample_type_name: sample.sample_type_name,
                    container_type_id: sample.container_type_id, container_type_name: sample.container_type_name,
                    quantity: amount.toFixed(2), remaining_quantity: amount.toFixed(2), unit: sample.unit,
                    status: 'accepted', storage_state: 'available', collection_source: sample.collection_source || 'onsite',
                    external_facility: sample.external_facility || null, collected_at: sample.collected_at, collected_by: sample.collected_by,
                    received_at: sample.received_at, received_by: sample.received_by, accepted_at: now, accepted_by: actorEmployeeId,
                    retention_until: sample.retention_until || null, notes, version: 1, created_at: now, updated_at: now,
               });
               const links = await trx('test_ascension_samples').where({ sample_id: sampleId });
               if (links.length) await trx('test_ascension_samples').insert(links.map((link: any) => ({
                    sample_id: childId, ascension_id: link.ascension_id, requirement_key: link.requirement_key, is_required: false, created_at: now,
               })));
               await trx('physical_sample_events').insert({
                    sample_id: childId, event_type: 'created_as_aliquot', from_status: null, to_status: 'accepted', actor_employeeid: actorEmployeeId,
                    reason: notes, sample_version: 1, metadata: JSON.stringify({ parent_sample_id: sampleId, parent_barcode: sample.barcode, quantity: amount.toFixed(2), unit: sample.unit }), created_at: now,
               });
               return { changes: { remaining_quantity: remaining.minus(amount).toFixed(2) }, reason: notes,
                    metadata: { aliquot_id: Number(childId), aliquot_barcode: barcode, quantity: amount.toFixed(2), unit: sample.unit, remaining_quantity: remaining.minus(amount).toFixed(2) } };
          });
          return this.detail(sampleId);
     }

     async store(sampleId: number, input: LifecycleMutation, actorEmployeeId: number): Promise<any> {
          const positionId = id(input?.positionId, 'storage position ID');
          await this.mutate(sampleId, input, actorEmployeeId, 'stored', async (trx, sample) => {
               // Custody is independent of validation: bypassed facilities keep real material
               // collected/received without fabricating an acceptance event.
               if (!storableStatuses.includes(sample.status)) throw new SpecimenLifecycleError('Only a collected, received or accepted specimen can be stored', 409);
               const position = await trx('specimen_storage_positions').where({ id: positionId }).forUpdate().first();
               if (!position || !Number(position.is_active)) throw new SpecimenLifecycleError('Active storage position not found', 404);
               const occupant = await trx('physical_samples').where({ storage_position_id: positionId }).first('id');
               if (occupant) throw new SpecimenLifecycleError(Number(occupant.id) === sampleId ? 'Specimen is already in this position' : 'Storage position is occupied', 409);
               return { changes: { storage_state: 'stored', storage_position_id: positionId },
                    metadata: { from_position_id: sample.storage_position_id || null, position_id: positionId, freezer: position.freezer, rack: position.rack, position: position.position } };
          });
          return this.detail(sampleId);
     }

     async retrieve(sampleId: number, input: LifecycleMutation, actorEmployeeId: number): Promise<any> {
          const reason = text(input?.reason, 'Retrieval reason', 2000)!;
          await this.mutate(sampleId, input, actorEmployeeId, 'retrieved', async (trx, sample) => {
               // Rejection after storage does not remove the physical container from custody.
               if (!retrievableStatuses.includes(sample.status) || sample.storage_state !== 'stored' || !sample.storage_position_id) {
                    throw new SpecimenLifecycleError('Only a stored specimen can be retrieved', 409);
               }
               const position = await trx('specimen_storage_positions').where({ id: sample.storage_position_id }).forUpdate().first();
               return { changes: { storage_state: 'retrieved', storage_position_id: null }, reason,
                    metadata: { position_id: sample.storage_position_id, freezer: position?.freezer, rack: position?.rack, position: position?.position } };
          });
          return this.detail(sampleId);
     }

     async setRetention(sampleId: number, input: LifecycleMutation, actorEmployeeId: number, canShortenRetention = false): Promise<any> {
          const reason = text(input?.reason, 'Retention reason', 2000)!;
          const hasDays = input?.retentionDays !== undefined && input.retentionDays !== null;
          const hasDate = input?.retentionUntil !== undefined && input.retentionUntil !== null;
          if (hasDays === hasDate) throw new SpecimenLifecycleError('Provide either retention days or a retention date');
          let until: Date;
          if (hasDays) {
               const days = id(input.retentionDays, 'retention period');
               if (days > 36500) throw new SpecimenLifecycleError('Retention period cannot exceed 36500 days');
               until = new Date(Date.now() + days * 86_400_000);
          } else {
               if (typeof input.retentionUntil !== 'string' || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(input.retentionUntil)) {
                    throw new SpecimenLifecycleError('Retention date must include a time and timezone');
               }
               const day = input.retentionUntil.slice(0, 10);
               const calendarDate = new Date(`${day}T00:00:00Z`);
               if (!Number.isFinite(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== day) {
                    throw new SpecimenLifecycleError('Retention date must be a valid calendar date');
               }
               until = new Date(input.retentionUntil);
          }
          if (!Number.isFinite(until.getTime())) throw new SpecimenLifecycleError('Retention date must be valid');
          await this.mutate(sampleId, input, actorEmployeeId, 'retention_updated', async (_trx, sample) => {
               if (!['accepted', 'rejected'].includes(sample.status)) throw new SpecimenLifecycleError('Only accepted or rejected specimens can have retention set', 409);
               // Check after idempotency: a successful old request remains replayable after its deadline.
               if (until.getTime() <= Date.now()) throw new SpecimenLifecycleError('Retention date must be in the future');
               const shortened = sample.retention_until && until.getTime() < new Date(sample.retention_until).getTime();
               if (shortened && !canShortenRetention) throw new SpecimenLifecycleError('Only an administrator or manager may shorten an existing retention period', 403);
               return { changes: { retention_until: until }, reason,
                    metadata: { previous_retention_until: sample.retention_until, retention_until: until.toISOString(), retention_days: hasDays ? Number(input.retentionDays) : null, retention_shortened: !!shortened } };
          });
          return this.detail(sampleId);
     }

     async dispose(sampleId: number, input: LifecycleMutation, actorEmployeeId: number, canOverrideRetention = false): Promise<any> {
          const method = text(input?.method, 'Disposal method', 120)!;
          const reason = text(input?.reason, 'Disposal reason', 2000)!;
          const witnessId = id(input?.witnessEmployeeId, 'witness employee ID');
          if (witnessId === actorEmployeeId) throw new SpecimenLifecycleError('Disposal must be witnessed by a different employee');
          if (input.overrideRetention !== undefined && typeof input.overrideRetention !== 'boolean') throw new SpecimenLifecycleError('Retention override must be true or false');
          await this.mutate(sampleId, input, actorEmployeeId, 'disposed', async (trx, sample, now) => {
               if (!['accepted', 'rejected'].includes(sample.status)) throw new SpecimenLifecycleError('Only accepted or rejected specimens can be disposed', 409);
               const witness = await trx('roles').where({ employeeid: witnessId }).first('employeeid', 'username', 'role', 'activation');
               if (!witness || Number(witness.activation) !== 1 || !roleAllowed(witness.role, scientificRoles)) {
                    throw new SpecimenLifecycleError('Witness must be an active scientist, manager or administrator in this facility');
               }
               const early = sample.retention_until && new Date(sample.retention_until).getTime() > now.getTime();
               if (early && !(canOverrideRetention && input.overrideRetention === true)) {
                    throw new SpecimenLifecycleError('Retention period has not expired; an administrator or manager must explicitly authorize early disposal', 409);
               }
               if (sample.storage_position_id) await trx('specimen_storage_positions').where({ id: sample.storage_position_id }).forUpdate().first();
               return { changes: { storage_state: 'disposed', storage_position_id: null, disposed_at: now, disposed_by: actorEmployeeId,
                    disposal_method: method, disposal_reason: reason, disposal_witness_employeeid: witnessId }, reason,
                    metadata: { method, witness_employeeid: witnessId, witness_name: witness.username, previous_position_id: sample.storage_position_id,
                         retention_until: sample.retention_until, retention_overridden: !!early, remaining_quantity: sample.remaining_quantity ?? sample.quantity, unit: sample.unit } };
          });
          return this.detail(sampleId);
     }

     private requireAccepted(sample: any): void {
          if (sample.status !== 'accepted') throw new SpecimenLifecycleError('Only an accepted specimen can be aliquoted', 409);
     }

     private async mutate(sampleId: number, input: LifecycleMutation, actorEmployeeId: number, eventType: string,
          operation: (trx: any, sample: any, now: Date) => Promise<{ changes: Record<string, any>; reason?: string | null; metadata?: Record<string, any> }>): Promise<void> {
          id(sampleId, 'sample ID');
          id(actorEmployeeId, 'employee ID');
          const expectedVersion = id(input?.expectedVersion, 'sample version');
          const key = text(input?.idempotencyKey, 'Request identifier', 100, false);
          const fingerprintInput: Record<string, unknown> = {};
          for (const field of Object.keys(input || {}).sort()) {
               if (!['expectedVersion', 'idempotencyKey'].includes(field)) fingerprintInput[field] = input[field];
          }
          const fingerprint = createHash('sha256').update(JSON.stringify(fingerprintInput)).digest('hex');
          const db = await KnexConnection(this.tenantId);
          await db.transaction(async trx => {
               const sample = await trx('physical_samples').where({ id: sampleId }).forUpdate().first();
               if (!sample) throw new SpecimenLifecycleError('Physical sample not found', 404);
               if (key) {
                    const existing = await trx('physical_sample_events').where({ idempotency_key: key }).first();
                    if (existing) {
                         if (Number(existing.sample_id) !== sampleId || existing.event_type !== eventType || metadata(existing.metadata).request_fingerprint !== fingerprint) {
                              throw new SpecimenLifecycleError('Request identifier was already used for a different operation', 409);
                         }
                         return;
                    }
               }
               if (sample.storage_state === 'disposed') throw new SpecimenLifecycleError('Disposed specimens cannot be changed', 409);
               if (Number(sample.version) !== expectedVersion) throw new SpecimenLifecycleError('Specimen was changed by another user; reload and try again', 409);
               const now = new Date();
               const result = await operation(trx, sample, now);
               const nextVersion = Number(sample.version) + 1;
               await trx('physical_samples').where({ id: sampleId }).update({ ...result.changes, version: nextVersion, updated_at: now });
               await trx('physical_sample_events').insert({
                    sample_id: sampleId, event_type: eventType, from_status: sample.status, to_status: sample.status,
                    actor_employeeid: actorEmployeeId, reason: result.reason || null, sample_version: nextVersion,
                    idempotency_key: key, metadata: JSON.stringify({ ...result.metadata, request_fingerprint: fingerprint }), created_at: now,
               });
          });
     }
}
