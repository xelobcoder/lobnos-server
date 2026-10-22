import { createHash } from 'crypto';
import { Knex } from 'knex';
import KnexConnection from '../../database/KnexConnections';
import { PublicFacilityRegistry } from '../public/PublicFacilityRegistry';
import { TenancyRepository } from '../Tenancy/tenancyRepo';
import { TenantRegistry } from '../Tenancy/TenantRegistry';
import { resolvePublicTenant } from '../../middleware/resolveLoginTenant';
import { QUEUE_COUNTERS, QUEUE_EVENTS, QUEUE_SETTINGS, QUEUE_TICKETS } from './WalkInQueueBootstrapper';

export class WalkInQueueError extends Error {
     constructor(message: string, public readonly statusCode = 400) { super(message); }
}
export const QUEUE_STATUSES = ['waiting', 'called', 'serving', 'completed', 'cancelled'] as const;
type QueueStatus = typeof QUEUE_STATUSES[number];
type Row = Record<string, any>;
const transitions: Record<QueueStatus, readonly QueueStatus[]> = {
     waiting: ['called', 'serving', 'cancelled'], called: ['waiting', 'serving', 'cancelled'],
     serving: ['waiting', 'called', 'completed', 'cancelled'], completed: [], cancelled: [],
};

function object(input: unknown, fields: readonly string[]): Row {
     if (!input || typeof input !== 'object' || Array.isArray(input)) throw new WalkInQueueError('Invalid queue request');
     const body = input as Row;
     if (Object.keys(body).some(key => !fields.includes(key))) throw new WalkInQueueError('Unexpected queue request fields');
     return body;
}
function text(input: unknown, max: number, label: string): string {
     if (typeof input !== 'string' || !input.trim() || input.length > max || /[\u0000-\u001f\u007f]/.test(input)) {
          throw new WalkInQueueError(`A valid ${label} is required`);
     }
     return input.trim();
}
function positive(input: unknown, label: string): number {
     const value = Number(input);
     if (!Number.isSafeInteger(value) || value <= 0) throw new WalkInQueueError(`Invalid ${label}`);
     return value;
}
export function queueDate(value?: unknown): string {
     const date = value === undefined ? new Date().toISOString().slice(0, 10) : value;
     if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
          throw new WalkInQueueError('Invalid queue date');
     }
     // Facility deployments use Africa/Accra, whose calendar date matches UTC year-round.
     return date;
}
function iso(value: unknown): string | null {
     if (!value) return null;
     const date = value instanceof Date ? value : new Date(String(value));
     return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function settings(row: Row) {
     return { publicEnabled: Number(row.public_enabled) === 1, displayEnabled: Number(row.display_enabled) === 1,
          ticketPrefix: String(row.ticket_prefix), version: Number(row.version) };
}
function ticket(row: Row, staff = false): Row {
     const value: Row = { ticketNumber: row.ticket_number, queueDate: row.queue_date instanceof Date ? row.queue_date.toISOString().slice(0, 10) : String(row.queue_date).slice(0, 10),
          status: row.status, counter: row.counter || null, createdAt: iso(row.created_at),
          testsTotal: Number(row.testsTotal || 0), testsCompleted: Number(row.testsCompleted || 0), testsValidated: Number(row.testsValidated || 0) };
     if (staff) Object.assign(value, { id: Number(row.id), name: row.name, phone: row.phone,
          patientid: row.patientid ? Number(row.patientid) : null, billingid: row.billingid ? Number(row.billingid) : null,
          version: Number(row.version), notes: row.notes || null, updatedAt: iso(row.updated_at) });
     return value;
}

/** Resolve public URLs through the same publication and standing checks as the public directory. */
export async function resolveQueueFacility(slug: unknown) {
     if (typeof slug !== 'string' || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new WalkInQueueError('Facility not found', 404);
     // The canonical kiosk URL is independent of catalog publication. This namespace cannot
     // collide with a directory slug that happens to look like another facility's login code.
     if (slug.startsWith('facility-')) {
          const tenant = await resolvePublicTenant(slug.slice('facility-'.length));
          if (!tenant) throw new WalkInQueueError('Facility not found', 404);
          return { tenantId: tenant.tenantId, slug, name: tenant.name };
     }
     const registry = new PublicFacilityRegistry();
     const facility = (await registry.all()).find(row => row.slug === slug && row.published);
     if (facility) {
          if (!await new TenancyRepository().validateTenantStanding(facility.tenantId) || !await registry.publicationAllowed(facility)) throw new WalkInQueueError('Facility not found', 404);
          return { tenantId: facility.tenantId, slug: facility.slug, name: facility.name };
     }
     const tenant = await resolvePublicTenant(slug);
     if (!tenant) throw new WalkInQueueError('Facility not found', 404);
     return { tenantId: tenant.tenantId, slug, name: tenant.name };
}

export class WalkInQueueService {
     constructor(private readonly tenantId: number) {
          positive(tenantId, 'facility');
     }

     private async configured(db: Knex | Knex.Transaction, lock = false) {
          let query = db(QUEUE_SETTINGS).where({ id: 1 });
          if (lock) query = query.forUpdate();
          const row = await query.first();
          if (!row) throw new WalkInQueueError('The queue is not ready. Contact the facility administrator.', 503);
          return row;
     }

     private async facility() {
          const tenant = await new TenantRegistry().getTenant(this.tenantId);
          if (!tenant?.isActive) return null;
          const verified = await resolvePublicTenant(tenant.platformId);
          if (!verified || Number(verified.tenantId) !== this.tenantId) return null;
          return { slug: `facility-${tenant.platformId.toLowerCase()}`, name: tenant.name };
     }

     async getSettings() {
          const db = await KnexConnection(this.tenantId);
          return { settings: settings(await this.configured(db)), facility: await this.facility() };
     }

     async updateSettings(input: unknown, employeeid: number) {
          const body = object(input, ['expectedVersion', 'publicEnabled', 'displayEnabled', 'ticketPrefix']);
          const expectedVersion = positive(body.expectedVersion, 'settings version');
          if (typeof body.publicEnabled !== 'boolean' || typeof body.displayEnabled !== 'boolean' ||
               typeof body.ticketPrefix !== 'string' || !/^[A-Z]{1,6}$/.test(body.ticketPrefix)) {
               throw new WalkInQueueError('Queue settings require explicit enable flags and a prefix of 1–6 uppercase letters');
          }
          const db = await KnexConnection(this.tenantId);
          await db.transaction(async trx => {
               const current = await this.configured(trx, true);
               if (Number(current.version) !== expectedVersion) throw new WalkInQueueError('Queue settings changed. Reload and try again.', 409);
               await trx(QUEUE_SETTINGS).where({ id: 1, version: expectedVersion }).update({ public_enabled: body.publicEnabled,
                    display_enabled: body.displayEnabled, ticket_prefix: body.ticketPrefix, version: expectedVersion + 1, updated_at: trx.fn.now() });
               await trx(QUEUE_EVENTS).insert({ actor_employeeid: positive(employeeid, 'employee'), action: 'settings_updated',
                    details_json: JSON.stringify({ publicEnabled: body.publicEnabled, displayEnabled: body.displayEnabled, ticketPrefix: body.ticketPrefix }) });
          });
          return this.getSettings();
     }

     async publicConfig(facility: { slug: string; name: string }) {
          const db = await KnexConnection(this.tenantId);
          return { facility, settings: settings(await this.configured(db)), date: queueDate() };
     }

     async join(input: unknown): Promise<{ ticket: Row }> {
          const body = object(input, ['name', 'phone', 'idempotencyKey']);
          const name = text(body.name, 160, 'name');
          const rawPhone = text(body.phone, 30, 'phone number');
          const phone = rawPhone.replace(/[\s().-]/g, '');
          if (!/^\+?[0-9]{7,15}$/.test(phone)) throw new WalkInQueueError('Enter a valid phone number');
          const key = text(body.idempotencyKey, 100, 'retry key');
          if (!/^[a-zA-Z0-9_-]{10,100}$/.test(key)) throw new WalkInQueueError('Invalid retry key');
          const hash = createHash('sha256').update(JSON.stringify({ name, phone })).digest('hex');
          const date = queueDate();
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const config = await this.configured(trx, true);
               if (!Number(config.public_enabled)) throw new WalkInQueueError('Walk-in check-in is currently closed. Please speak to reception.', 403);
               const previous = await trx(QUEUE_TICKETS).where({ queue_date: date, idempotency_key: key }).first();
               if (previous) {
                    if (previous.request_hash !== hash) throw new WalkInQueueError('This retry key was already used for a different check-in', 409);
                    return { ticket: { ...ticket(previous), id: Number(previous.id), version: Number(previous.version) } };
               }
               // A browser refresh must not create another active ticket for the same contact.
               const duplicate = await trx(QUEUE_TICKETS).where({ queue_date: date, phone, name })
                    .whereIn('status', ['waiting', 'called', 'serving']).first();
               if (duplicate) throw new WalkInQueueError('An active check-in already exists for this name and phone number. Please speak to reception.', 409);
               await trx(QUEUE_COUNTERS).insert({ queue_date: date, last_number: 0 }).onConflict('queue_date').ignore();
               const counter = await trx(QUEUE_COUNTERS).where({ queue_date: date }).forUpdate().first();
               const sequence = Number(counter.last_number) + 1;
               if (sequence > 2000) throw new WalkInQueueError('Online check-in has reached today’s capacity. Please speak to reception.', 429);
               await trx(QUEUE_COUNTERS).where({ queue_date: date }).update({ last_number: sequence });
               const values = { queue_date: date, sequence, ticket_number: `${config.ticket_prefix}-${String(sequence).padStart(3, '0')}`,
                    name, phone, status: 'waiting', idempotency_key: key, request_hash: hash, version: 1, created_at: trx.fn.now(), updated_at: trx.fn.now() };
               const [id] = await trx(QUEUE_TICKETS).insert(values);
               await trx(QUEUE_EVENTS).insert({ ticket_id: id, actor_employeeid: null, action: 'checked_in', details_json: JSON.stringify({ ticketNumber: values.ticket_number }) });
               const row = await trx(QUEUE_TICKETS).where({ id }).first();
               return { ticket: { ...ticket(row), id: Number(row.id), version: Number(row.version) } };
          });
     }

     private async progress(db: Knex | Knex.Transaction, rows: Row[]): Promise<Row[]> {
          const ids = [...new Set(rows.map(row => Number(row.billingid)).filter(id => id > 0))];
          if (!ids.length) return rows;
          // Aggregate distinct accessions before merging: approval rows can be duplicated in legacy data.
          const tests = await db('test_ascension as ta').leftJoin('dbotestresultapproval as approval', 'approval.ascensionid', 'ta.id')
               .join('billing as bill', 'bill.billingid', 'ta.billingid')
               .leftJoin('dboservices as service', 'service.serviceid', 'ta.serviceid')
               .whereIn('ta.billingid', ids).whereRaw('(service.isDeleted = 0 OR service.isDeleted IS NULL)')
               .whereRaw('(bill.status IS NULL OR bill.status <> ?)', ['voided'])
               .whereRaw('(service.status IS NULL OR service.status NOT IN (?, ?, ?))', ['cancelled', 'voided', 'refunded'])
               .whereRaw('(service.paymentstatus IS NULL OR service.paymentstatus <> ?)', ['refunded'])
               .select('ta.id', 'ta.billingid', 'ta.resultEntryEnd', 'approval.isapproved');
          const counts = new Map<number, Map<number, { completed: boolean; validated: boolean }>>();
          for (const test of tests) {
               const billing = Number(test.billingid);
               if (!counts.has(billing)) counts.set(billing, new Map());
               const current = counts.get(billing)!.get(Number(test.id)) || { completed: false, validated: false };
               current.completed ||= !!test.resultEntryEnd;
               current.validated ||= !!test.resultEntryEnd && Number(test.isapproved) === 1;
               counts.get(billing)!.set(Number(test.id), current);
          }
          return rows.map(row => {
               const values = [...(counts.get(Number(row.billingid))?.values() || [])];
               return { ...row, testsTotal: values.length, testsCompleted: values.filter(value => value.completed).length,
                    testsValidated: values.filter(value => value.validated).length };
          });
     }

     async list(dateInput?: unknown, staff = true, facility?: { slug: string; name: string }) {
          const date = queueDate(dateInput);
          const db = await KnexConnection(this.tenantId);
          if (!staff && !Number((await this.configured(db)).display_enabled)) throw new WalkInQueueError('The public queue display is currently disabled', 403);
          const rows = await db(QUEUE_TICKETS).where({ queue_date: date }).orderBy('sequence', 'asc').limit(2000);
          const complete = await this.progress(db, rows);
          const summary = { total: rows.length, waiting: 0, called: 0, serving: 0, completed: 0, cancelled: 0 };
          for (const row of rows) if (QUEUE_STATUSES.includes(row.status)) summary[row.status as QueueStatus] += 1;
          return { facility: facility || await this.facility(), date, tickets: complete.map(row => ticket(row, staff)), summary, updatedAt: new Date().toISOString() };
     }

     async update(idInput: unknown, input: unknown, employeeid: number) {
          const id = positive(idInput, 'ticket');
          const body = object(input, ['expectedVersion', 'status', 'counter', 'patientid', 'billingid', 'note']);
          const expectedVersion = positive(body.expectedVersion, 'ticket version');
          if (Object.keys(body).length === 1) throw new WalkInQueueError('Choose a queue change');
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               const current = await trx(QUEUE_TICKETS).where({ id }).forUpdate().first();
               if (!current) throw new WalkInQueueError('Queue ticket not found', 404);
               if (Number(current.version) !== expectedVersion) throw new WalkInQueueError('This ticket changed. Reload and try again.', 409);
               if (['completed', 'cancelled'].includes(current.status)) throw new WalkInQueueError('This queue ticket is closed', 409);
               const changes: Row = { version: expectedVersion + 1, updated_at: trx.fn.now() };
               if (body.status !== undefined) {
                    if (!QUEUE_STATUSES.includes(body.status) || body.status !== current.status && !transitions[current.status as QueueStatus]?.includes(body.status)) {
                         throw new WalkInQueueError('Invalid queue status transition', 409);
                    }
                    changes.status = body.status;
               }
               if (body.counter !== undefined) changes.counter = body.counter === null || body.counter === '' ? null : text(body.counter, 80, 'counter');
               if (body.note !== undefined) changes.notes = body.note === null || body.note === '' ? null : text(body.note, 2000, 'note');
               let patientid = body.patientid === undefined ? current.patientid : body.patientid === null ? null : positive(body.patientid, 'patient');
               const billingid = body.billingid === undefined ? current.billingid : body.billingid === null ? null : positive(body.billingid, 'billing');
               if (billingid) {
                    const bill = await trx('billing').where({ billingid }).forUpdate().first('patientid', 'status');
                    if (!bill) throw new WalkInQueueError('Billing record not found in this facility', 404);
                    if (String(bill.status || '').toLowerCase() === 'voided' && (body.billingid !== undefined || changes.status === 'completed')) {
                         throw new WalkInQueueError('This bill is voided. Link an active bill or cancel this queue ticket.', 409);
                    }
                    if (body.patientid === undefined && body.billingid !== undefined) patientid = Number(bill.patientid);
                    if (Number(bill.patientid) !== Number(patientid)) throw new WalkInQueueError('The billing record does not belong to the selected patient', 409);
               }
               if (patientid && !await trx('new_patients').where({ patientid }).first('patientid')) throw new WalkInQueueError('Patient not found in this facility', 404);
               changes.patientid = patientid || null;
               changes.billingid = billingid || null;
               if (changes.status === 'completed' && billingid) {
                    const [progress] = await this.progress(trx, [{ ...current, ...changes }]);
                    if (progress.testsCompleted < progress.testsTotal) throw new WalkInQueueError('Some tests are still pending. Keep this ticket open to track progress.', 409);
               }
               await trx(QUEUE_TICKETS).where({ id, version: expectedVersion }).update(changes);
               await trx(QUEUE_EVENTS).insert({ ticket_id: id, actor_employeeid: positive(employeeid, 'employee'), action: 'ticket_updated',
                    details_json: JSON.stringify({ from: current.status, to: changes.status || current.status,
                         counter: changes.counter === undefined ? current.counter : changes.counter,
                         patientid: changes.patientid, billingid: changes.billingid, version: expectedVersion + 1,
                         noteChanged: body.note !== undefined }) });
               const [updated] = await this.progress(trx, [await trx(QUEUE_TICKETS).where({ id }).first()]);
               return { ticket: ticket(updated, true) };
          });
     }
}
