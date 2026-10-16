import bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Decimal from 'decimal.js';
import { systemConfigConnection as db } from '../database/connection';
import { PublicCatalogError, PublicFacilityCatalog } from '../models/public/PublicFacilityCatalog';
import { PublicFacilityRegistry } from '../models/public/PublicFacilityRegistry';
import { FacilityError, validateFacilityInput } from '../models/Tenancy/FacilityInput';
import type { FacilityActor } from '../models/Tenancy/FacilityProvisioningService';
import { TENANTS_TABLE } from '../models/Tenancy/TenantRegistry';
import { roleAllowed } from '../middleware/roles';

const SESSION_TTL_HOURS = 12;
const STAFF_TOKEN_BYTES = 32;

export type BookingStatus = 'requested' | 'accepted' | 'rejected' | 'scheduled' | 'collected' | 'processing' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'verified' | 'rejected' | 'refund_pending' | 'refunded';

export class MarketplaceError extends Error {
     constructor(message: string, public readonly statusCode: number) {
          super(message);
          this.name = 'MarketplaceError';
     }
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null && !Array.isArray(value);
const cleanText = (value: unknown, field: string, max: number, required = true): string | null => {
     if (value === undefined || value === null) {
          if (required) throw new MarketplaceError(`Invalid ${field}`, 400);
          return null;
     }
     if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) {
          throw new MarketplaceError(`Invalid ${field}`, 400);
     }
     const result = value.trim();
     return result || null;
};
const positiveId = (value: unknown, field: string): number => {
     const id = typeof value === 'number' ? value : Number(value);
     if (!Number.isSafeInteger(id) || id <= 0) throw new MarketplaceError(`Invalid ${field}`, 400);
     return id;
};
const money = (value: unknown, field: string): number => {
     let amount: Decimal;
     try {
          if (!(typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))) throw new Error();
          amount = new Decimal(value);
     } catch {
          throw new MarketplaceError(`Invalid ${field}`, 400);
     }
     if (!amount.isFinite() || amount.isNegative() || amount.decimalPlaces() > 2 ||
          amount.greaterThan('9999999999.99')) {
          throw new MarketplaceError(`Invalid ${field}`, 400);
     }
     return amount.toNumber();
};
const passwordValue = (value: unknown, minimum = 12): string => {
     if (typeof value !== 'string' || value.trim().length === 0 || value.length < minimum ||
          Buffer.byteLength(value, 'utf8') > 72) {
          throw new MarketplaceError(`Password must be at least ${minimum} characters and no more than 72 UTF-8 bytes`, 400);
     }
     return value;
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedMethods = new Set(['in_facility', 'home']);
const jsonArray = (value: unknown, field: string, allowed?: Set<string>): string[] => {
     if (!Array.isArray(value) || value.length === 0 || value.length > 2 ||
          value.some(item => typeof item !== 'string' || !item.trim() || (allowed && !allowed.has(item)))) {
          throw new MarketplaceError(`Invalid ${field}`, 400);
     }
     const result = [...new Set(value.map(item => String(item).trim()))];
     if (result.length !== value.length) throw new MarketplaceError(`Invalid ${field}`, 400);
     return result;
};
const openingHours = (value: unknown): string => {
     if (value === undefined) return JSON.stringify({});
     if (!isRecord(value) || Object.keys(value).length > 7 || Object.keys(value).some(day =>
          !['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].includes(day.toLowerCase()) ||
          typeof value[day] !== 'string' || value[day].trim().length > 80)) {
          throw new MarketplaceError('Invalid opening hours', 400);
     }
     return JSON.stringify(Object.fromEntries(Object.entries(value).map(([day, hours]) => [day.toLowerCase(), (hours as string).trim()])));
};
const staffView = (staff: any) => ({ id: Number(staff.id), email: staff.email, role: staff.role });
const bookingStatusView = (row: any) => ({
     bookingId: row.id,
     status: row.status,
     paymentStatus: row.payment_status || 'unpaid',
     totalAmount: Number(row.total_amount),
     currency: row.currency,
     collectionMethod: row.collection_method,
     scheduledAt: row.scheduled_at || null,
     scheduleInstructions: row.schedule_instructions || null,
     items: row.items || [],
});

function validateSlug(slug: unknown): string {
     if (typeof slug !== 'string' || slug.length > 80 || !slugPattern.test(slug)) throw new MarketplaceError('Laboratory not found', 404);
     return slug;
}

export class MarketplaceService {
     async listPlatformEnquiries(formTypeInput?: unknown, pageInput?: unknown) {
          const formType = formTypeInput === undefined ? 'all' : formTypeInput;
          if (!['all', 'demo', 'contact'].includes(String(formType)) || typeof formType !== 'string') {
               throw new MarketplaceError('Invalid enquiry type filter', 400);
          }
          if (pageInput !== undefined && (typeof pageInput !== 'string' || !/^[1-9]\d*$/.test(pageInput))) {
               throw new MarketplaceError('Invalid enquiry page', 400);
          }
          const page = pageInput === undefined ? 1 : Number(pageInput);
          if (!Number.isSafeInteger(page) || page > 100_000) throw new MarketplaceError('Invalid enquiry page', 400);
          const pageSize = 50;
          const query = db('platform_enquiries').select(
               'id', 'form_type', 'full_name', 'work_email', 'phone', 'organization', 'country',
               'facility_type', 'facilities_count', 'interests_json', 'subject', 'message',
               'status', 'submitted_at', 'received_at',
          );
          if (formType !== 'all') query.where({ form_type: formType });
          const rows = await query.orderBy('received_at', 'desc').orderBy('id', 'desc')
               .offset((page - 1) * pageSize).limit(pageSize + 1);
          return {
               page,
               hasMore: rows.length > pageSize,
               enquiries: rows.slice(0, pageSize).map(row => {
                    const interests: unknown = JSON.parse(row.interests_json);
                    if (!Array.isArray(interests) || interests.some(item => typeof item !== 'string')) {
                         throw new Error('Invalid stored enquiry interests');
                    }
                    return {
                         id: Number(row.id), formType: row.form_type, fullName: row.full_name,
                         workEmail: row.work_email, phone: row.phone, organization: row.organization,
                         country: row.country, facilityType: row.facility_type, facilitiesCount: row.facilities_count,
                         interests, subject: row.subject, message: row.message, status: row.status,
                         submittedAt: row.submitted_at, receivedAt: row.received_at,
                    };
               }),
          };
     }

     async submitPlatformEnquiry(input: unknown) {
          if (!isRecord(input)) throw new MarketplaceError('Invalid enquiry', 400);
          const formType = input.formType;
          if (formType !== 'demo' && formType !== 'contact') throw new MarketplaceError('Invalid enquiry type', 400);
          const fullName = cleanText(input.fullName, 'full name', 120)!;
          if (fullName.length < 2) throw new MarketplaceError('Invalid full name', 400);
          const workEmail = cleanText(input.workEmail, 'work email', 254)!.toLowerCase();
          if (!emailPattern.test(workEmail)) throw new MarketplaceError('Invalid work email', 400);
          const message = cleanText(input.message, 'message', 4000)!;
          if (message.length < 10) throw new MarketplaceError('Invalid message', 400);
          const interests = input.interests === undefined ? [] : input.interests;
          if (!Array.isArray(interests) || interests.length > 12 ||
               interests.some(item => typeof item !== 'string' || item.trim().length > 80)) {
               throw new MarketplaceError('Invalid interests', 400);
          }
          const submittedAt = new Date(input.submittedAt);
          if (typeof input.submittedAt !== 'string' || !Number.isFinite(submittedAt.getTime()) ||
               Math.abs(Date.now() - submittedAt.getTime()) > 24 * 60 * 60 * 1000) {
               throw new MarketplaceError('Invalid submission time', 400);
          }
          if (input.source !== 'pls-corporate-website') throw new MarketplaceError('Invalid enquiry source', 400);
          const optional = (value: unknown, field: string, maximum: number) =>
               value === undefined ? '' : cleanText(value, field, maximum, false) || '';
          const [id] = await db('platform_enquiries').insert({
               form_type: formType,
               full_name: fullName,
               work_email: workEmail,
               phone: optional(input.phone, 'phone', 40),
               organization: optional(input.organization, 'organization', 160),
               country: optional(input.country, 'country', 80),
               facility_type: optional(input.facilityType, 'facility type', 100),
               facilities_count: optional(input.facilitiesCount, 'facilities count', 40),
               interests_json: JSON.stringify(interests.map(item => item.trim())),
               subject: optional(input.subject, 'subject', 160),
               message,
               source: input.source,
               submitted_at: submittedAt,
               status: 'new',
          });
          return { enquiryId: Number(id), accepted: true };
     }

     async listFacilities(search?: unknown) {
          if (search !== undefined && (typeof search !== 'string' || search.length > 120)) throw new MarketplaceError('Invalid search', 400);
          const needle = typeof search === 'string' ? search.trim() : '';
          const query = db('marketplace_facilities').where({ status: 'approved' })
               .select('slug', 'name', 'region', 'locality', 'address', 'phone', 'contact_email',
                    'description', 'opening_hours', 'payment_instructions', 'currency', 'integration_state');
          if (needle) query.andWhere(function () {
               this.where('name', 'like', `%${needle}%`).orWhere('region', 'like', `%${needle}%`)
                    .orWhere('locality', 'like', `%${needle}%`).orWhere('description', 'like', `%${needle}%`)
                    .orWhereExists(function (this: any) {
                         this.select(db.raw('1')).from('marketplace_catalog_items as item')
                              .whereColumn('item.facility_id', 'marketplace_facilities.id')
                              .where({ 'item.active': true, 'item.available': true })
                              .andWhere(function (this: any) {
                                   this.where('item.name', 'like', `%${needle}%`).orWhere('item.description', 'like', `%${needle}%`);
                              });
                    });
          });
          let rows = await query.orderBy('name').limit(200);
          if (needle) {
               const linkedRows = await db('marketplace_facilities').where({ status: 'approved', integration_state: 'linked' })
                    .select('slug', 'name', 'region', 'locality', 'address', 'phone', 'contact_email', 'description',
                         'opening_hours', 'payment_instructions', 'currency', 'integration_state')
                    .orderBy('name').limit(200);
               const alreadyIncluded = new Set(rows.map((row: any) => row.slug));
               const matchingLinked: any[] = [];
               for (let index = 0; index < linkedRows.length; index += 5) {
                    const batch = linkedRows.slice(index, index + 5);
                    const matches = await Promise.all(batch.map(async (row: any) => {
                         if (alreadyIncluded.has(row.slug)) return null;
                         try {
                              const catalog = await new PublicFacilityCatalog().catalog(row.slug);
                              return [...catalog.tests, ...(catalog.panels || [])].some((item: any) =>
                                   `${item.name} ${item.description || ''}`.toLowerCase().includes(needle.toLowerCase())) ? row : null;
                         } catch (error) {
                              if ((error instanceof MarketplaceError || error instanceof PublicCatalogError) && error.statusCode < 500) return null;
                              throw error;
                         }
                    }));
                    matchingLinked.push(...matches.filter(Boolean));
               }
               rows = [...rows, ...matchingLinked].slice(0, 200);
          }
          const publicProfiles = (await new PublicFacilityCatalog().list()).facilities;
          const bySlug = new Map(publicProfiles.map(profile => [profile.slug, profile]));
          const registeredSlugs = new Set(rows.map((row: any) => row.slug));
          const coreProfiles = [];
          for (const profile of publicProfiles) {
               if (registeredSlugs.has(profile.slug)) continue;
               const searchText = `${profile.name} ${profile.region} ${profile.locality} ${profile.description}`.toLowerCase();
               if (needle && !searchText.includes(needle.toLowerCase())) {
                    try {
                         const catalog = await new PublicFacilityCatalog().catalog(profile.slug);
                         if (![...catalog.tests, ...catalog.panels].some(item =>
                              `${item.name} ${item.description || ''}`.toLowerCase().includes(needle.toLowerCase()))) continue;
                    } catch (error) {
                         if (error instanceof PublicCatalogError && error.statusCode === 404) continue;
                         throw error;
                    }
               }
               coreProfiles.push({
                    ...profile, address: '', phone: '', contactEmail: '', openingHours: {},
                    paymentInstructions: null, currency: profile.currency,
                    facilityType: 'pls-integrated', bookingSupported: false,
               });
          }
          return {
               facilities: [...rows.filter((row: any) => row.integration_state === 'independent' ||
                    row.integration_state === 'linked' && bySlug.has(row.slug)).map((row: any) => ({
                    slug: row.slug, name: row.name, region: row.region, locality: row.locality,
                    address: row.address, phone: row.phone, contactEmail: row.contact_email,
                    description: row.description, openingHours: JSON.parse(row.opening_hours || '{}'),
                    paymentInstructions: row.payment_instructions, currency: row.currency,
                    facilityType: row.integration_state === 'linked' ? 'pls-integrated' : 'independent',
                    ...(row.integration_state === 'linked' ? bySlug.get(row.slug) : {}),
                    bookingSupported: true,
               })), ...coreProfiles].sort((left, right) => left.name.localeCompare(right.name)).slice(0, 200),
          };
     }

     async publicCatalog(slugInput: unknown) {
          const slug = validateSlug(slugInput);
          const facility = await db('marketplace_facilities').where({ slug, status: 'approved' }).first();
          if (!facility) {
               const live = await new PublicFacilityCatalog().catalog(slug);
               return {
                    facility: { ...live.facility, address: '', phone: '', contactEmail: '', openingHours: {},
                         paymentInstructions: null, currency: live.currency, facilityType: 'pls-integrated', bookingSupported: false },
                    currency: live.currency,
                    tests: [
                         ...live.tests.map(item => ({ ...item, type: 'test', sampleRequirements: [], collectionMethods: ['in_facility'], available: true, turnaroundHours: null })),
                         ...live.panels.map(item => ({ ...item, type: 'panel', sampleRequirements: [], collectionMethods: ['in_facility'], available: true, turnaroundHours: null })),
                    ],
                    source: 'pls-live',
               };
          }
          if (!['independent', 'linked'].includes(facility.integration_state)) throw new MarketplaceError('Laboratory is not available', 409);
          if (facility.integration_state === 'linked') {
               // Catalog comes from the core PLS source; marketplace never shadows its prices.
               const live = await new PublicFacilityCatalog().catalog(slug);
               return {
                    facility: { ...this.publicFacility(facility), ...live.facility, currency: live.currency },
                    currency: live.currency,
                    tests: [
                         ...live.tests.map((item: any) => ({ id: item.id, type: 'test', name: item.name, description: item.description, price: item.price, sampleRequirements: [], collectionMethods: ['in_facility'], available: true, turnaroundHours: null })),
                         ...(live.panels || []).map((item: any) => ({ id: item.id, type: 'panel', name: item.name, description: item.description, price: item.price, sampleRequirements: [], collectionMethods: ['in_facility'], available: true, turnaroundHours: null })),
                    ],
                    source: 'pls-live',
               };
          }
          const rows = await db('marketplace_catalog_items').where({ facility_id: facility.id, active: true, available: true })
               .select('id', 'item_type', 'name', 'description', 'price', 'sample_requirements', 'collection_methods', 'available', 'turnaround_hours')
               .orderBy('name');
          return {
               facility: this.publicFacility(facility),
               currency: facility.currency,
               tests: rows.map((row: any) => ({
                    id: Number(row.id), type: row.item_type, name: row.name, description: row.description,
                    price: Number(row.price), sampleRequirements: JSON.parse(row.sample_requirements),
                    collectionMethods: JSON.parse(row.collection_methods), available: Boolean(row.available),
                    turnaroundHours: row.turnaround_hours === null ? null : Number(row.turnaround_hours),
               })),
               source: 'marketplace',
          };
     }

     async register(input: unknown) {
          if (!isRecord(input)) throw new MarketplaceError('Invalid registration', 400);
          const name = cleanText(input.name, 'name', 160)!;
          const slug = cleanText(input.slug, 'slug', 80)!;
          if (!slugPattern.test(slug)) throw new MarketplaceError('Invalid slug', 400);
          const region = cleanText(input.region, 'region', 120)!;
          const locality = cleanText(input.locality, 'locality', 160)!;
          const address = cleanText(input.address, 'address', 500)!;
          const phone = cleanText(input.phone, 'phone', 40)!;
          const contactEmail = cleanText(input.contactEmail, 'contactEmail', 254)!.toLowerCase();
          if (!emailPattern.test(contactEmail)) throw new MarketplaceError('Invalid contactEmail', 400);
          const description = cleanText(input.description, 'description', 3000)!;
          const hours = openingHours(input.openingHours);
          const instructions = cleanText(input.paymentInstructions, 'payment instructions', 1000, false);
          const currency = cleanText(input.currency, 'currency', 3)!;
          if (!/^[A-Z]{3}$/.test(currency)) throw new MarketplaceError('Invalid currency', 400);
          const email = cleanText(input.adminEmail, 'adminEmail', 254)!.toLowerCase();
          if (!emailPattern.test(email)) throw new MarketplaceError('Invalid adminEmail', 400);
          const password = passwordValue(input.adminPassword);
          const passwordHash = await bcrypt.hash(password, 12);
          try {
               await db.transaction(async trx => {
                    const [facilityId] = await trx('marketplace_facilities').insert({
                         slug, name, region, locality, address, phone, contact_email: contactEmail,
                         description, opening_hours: hours, payment_instructions: instructions,
                         currency, status: 'pending', integration_state: 'independent',
                    });
                    const [staffId] = await trx('marketplace_staff').insert({
                         facility_id: facilityId, email, password_hash: passwordHash, role: 'admin', active: true,
                    });
                    await trx('marketplace_audit').insert({
                         facility_id: facilityId, event_type: 'facility_registered', actor_type: 'public',
                         actor_id: String(staffId), details_json: JSON.stringify({ status: 'pending' }),
                    });
                    return;
               });
               return { facility: { slug, status: 'pending_approval' } };
          } catch (error: any) {
               if (error?.code === 'ER_DUP_ENTRY') throw new MarketplaceError('Facility slug or administrator email already exists', 409);
               throw error;
          }
     }

     async createBooking(input: unknown) {
          if (!isRecord(input)) throw new MarketplaceError('Invalid booking request', 400);
          const slug = validateSlug(input.facilitySlug);
          const idempotencyKey = cleanText(input.idempotencyKey, 'idempotency key', 60)!;
          if (!/^[A-Za-z0-9_-]{43}$/.test(idempotencyKey)) {
               throw new MarketplaceError('A 256-bit base64url idempotency key is required', 400);
          }
          const trackingTokenHash = hash(idempotencyKey);
          if (!Array.isArray(input.itemIds) || input.itemIds.length < 1 || input.itemIds.length > 20) throw new MarketplaceError('Select between 1 and 20 catalog items', 400);
          const itemIds = input.itemIds.map(item => positiveId(item, 'catalog item id'));
          if (new Set(itemIds).size !== itemIds.length) throw new MarketplaceError('Duplicate catalog items are not allowed', 400);
          if (!isRecord(input.patient)) throw new MarketplaceError('Invalid patient details', 400);
          const patientName = cleanText(input.patient.name, 'patient name', 200)!;
          const patientPhone = cleanText(input.patient.phone, 'patient phone', 40)!;
          const patientEmail = cleanText(input.patient.email, 'patient email', 254, false);
          if (patientEmail && !emailPattern.test(patientEmail)) throw new MarketplaceError('Invalid patient email', 400);
          if (typeof input.collectionMethod !== 'string' || !allowedMethods.has(input.collectionMethod)) throw new MarketplaceError('Invalid collection method', 400);
          const address = cleanText(input.collectionAddress, 'collection address', 500, input.collectionMethod === 'home');

          const existingByKey = await db('marketplace_bookings').where({ tracking_token_hash: trackingTokenHash }).first();
          if (existingByKey) {
               return this.idempotentBookingResult(existingByKey, {
                    slug, patientName, patientPhone, patientEmail, address, collectionMethod: input.collectionMethod, itemIds, idempotencyKey,
               });
          }
          const facility = await db('marketplace_facilities').where({ slug, status: 'approved' }).first();
          if (!facility) throw new MarketplaceError('Laboratory not found', 404);
          if (!['independent', 'linked'].includes(facility.integration_state)) throw new MarketplaceError('Laboratory is not available', 409);

          let items: Array<{ id: number; type: string; name: string; price: number; currency: string; catalogItemId: number | null; coreItemId: number | null }>;
          let currency = facility.currency;
          if (facility.integration_state === 'linked') {
               const live = await new PublicFacilityCatalog().catalog(slug);
               currency = live.currency;
               const indexed = new Map<number, any>();
               for (const row of live.tests) indexed.set(Number(row.id), { ...row, type: 'test' });
               for (const row of live.panels || []) indexed.set(Number(row.id), { ...row, type: 'panel' });
               items = itemIds.map(id => {
                    const item = indexed.get(id);
                    if (!item) throw new MarketplaceError('A selected catalog item is no longer available', 409);
                    if (input.collectionMethod !== 'in_facility') throw new MarketplaceError('This PLS catalog does not publish support for the requested collection method', 409);
                    return { id, type: item.type, name: item.name, price: money(item.price, 'catalog price'), currency, catalogItemId: null, coreItemId: id };
               });
          } else {
               const rows = await db('marketplace_catalog_items').where({ facility_id: facility.id, active: true, available: true }).whereIn('id', itemIds);
               const indexed = new Map(rows.map((row: any) => [Number(row.id), row]));
               if (indexed.size !== itemIds.length) throw new MarketplaceError('A selected catalog item is no longer available', 409);
               items = itemIds.map(id => {
                    const item: any = indexed.get(id);
                    const methods = JSON.parse(item.collection_methods);
                    if (!methods.includes(input.collectionMethod)) throw new MarketplaceError('A selected item does not support the chosen collection method', 409);
                    return { id, type: item.item_type, name: item.name, price: money(item.price, 'catalog price'), currency, catalogItemId: id, coreItemId: null };
               });
          }
          const total = new Decimal(items.reduce((sum, item) => sum + Math.round(item.price * 100), 0))
               .dividedBy(100).toFixed(2);
          if (Number(total) > 9_999_999_999.99) throw new MarketplaceError('Booking total exceeds the supported limit', 400);
          const trackingToken = idempotencyKey;
          const id = randomUUID();
          try {
               await db.transaction(async trx => {
               const current = await trx('marketplace_facilities').where({ id: facility.id }).forUpdate().first('status', 'integration_state', 'linked_tenant_id');
               if (!current || current.status !== 'approved' || current.integration_state !== facility.integration_state ||
                    current.linked_tenant_id !== facility.linked_tenant_id) {
                    throw new MarketplaceError('Facility availability changed; reload the catalog and retry', 409);
               }
               await trx('marketplace_bookings').insert({
                    id, facility_id: facility.id, tracking_token_hash: trackingTokenHash,
                    patient_name: patientName, patient_phone: patientPhone, patient_email: patientEmail,
                    collection_address: address, collection_method: input.collectionMethod,
                    status: 'requested', total_amount: total, currency,
               });
               await trx('marketplace_booking_items').insert(items.map(item => ({
                    booking_id: id, catalog_item_id: item.catalogItemId, core_item_id: item.coreItemId,
                    item_type: item.type, name_snapshot: item.name, unit_price_snapshot: item.price, currency,
               })));
               await trx('marketplace_audit').insert({
                    facility_id: facility.id, booking_id: id, event_type: 'booking_requested',
                    actor_type: 'patient', actor_id: hash(patientPhone).slice(0, 24),
                    details_json: JSON.stringify({ itemCount: items.length, totalAmount: total, currency }),
               });
               });
          } catch (error: any) {
               // The unique token hash is also the idempotency key. A concurrent
               // retry resolves to the original booking, never a duplicate order.
               if (error?.code === 'ER_DUP_ENTRY') {
                    const duplicate = await db('marketplace_bookings').where({ tracking_token_hash: trackingTokenHash }).first();
                    if (duplicate) return this.idempotentBookingResult(duplicate, {
                         slug, patientName, patientPhone, patientEmail, address,
                         collectionMethod: input.collectionMethod, itemIds, idempotencyKey,
                    });
               }
               throw error;
          }
          return {
               bookingId: id, trackingToken, status: 'requested', totalAmount: Number(total), currency,
               paymentInstructions: facility.payment_instructions,
          };
     }

     private async idempotentBookingResult(existing: any, input: {
          slug: string; patientName: string; patientPhone: string; patientEmail: string | null;
          address: string | null; collectionMethod: string; itemIds: number[]; idempotencyKey: string;
     }) {
          const facility = await db('marketplace_facilities').where({ id: existing.facility_id, status: 'approved' }).first();
          if (!facility || facility.slug !== input.slug || existing.patient_name !== input.patientName ||
               existing.patient_phone !== input.patientPhone || (existing.patient_email || null) !== input.patientEmail ||
               (existing.collection_address || null) !== input.address || existing.collection_method !== input.collectionMethod) {
               throw new MarketplaceError('Idempotency key was already used for a different booking request', 409);
          }
          const snapshots = await db('marketplace_booking_items').where({ booking_id: existing.id })
               .select('catalog_item_id', 'core_item_id');
          const savedIds = snapshots.map((row: any) => Number(row.catalog_item_id ?? row.core_item_id)).sort((a: number, b: number) => a - b);
          const submittedIds = [...input.itemIds].sort((a, b) => a - b);
          if (savedIds.length !== submittedIds.length || savedIds.some((id: number, index: number) => id !== submittedIds[index])) {
               throw new MarketplaceError('Idempotency key was already used for a different booking request', 409);
          }
          return {
               bookingId: existing.id, trackingToken: input.idempotencyKey, status: existing.status,
               totalAmount: Number(existing.total_amount), currency: existing.currency,
               paymentInstructions: facility.payment_instructions,
          };
     }

     async trackBooking(input: unknown) {
          if (!isRecord(input) || typeof input.trackingToken !== 'string' ||
               !/^[A-Za-z0-9_-]{40,60}$/.test(input.trackingToken)) throw new MarketplaceError('Invalid tracking credential', 401);
          const booking = await db('marketplace_bookings').where({ tracking_token_hash: hash(input.trackingToken) }).first();
          if (!booking) throw new MarketplaceError('Booking not found', 404);
          const items = await db('marketplace_booking_items').where({ booking_id: booking.id })
               .select('item_type as type', 'name_snapshot as name', 'unit_price_snapshot as price', 'currency');
          const status = await this.paymentStatus(booking.id);
          const refund = status === 'verified' && booking.status === 'cancelled'
               ? await db('marketplace_refunds').where({ booking_id: booking.id }).first('id') : null;
          return bookingStatusView({
               ...booking,
               payment_status: refund ? 'refunded' : status === 'verified' && booking.status === 'cancelled' ? 'refund_pending' : status,
               items: items.map((item: any) => ({ ...item, price: Number(item.price) })),
          });
     }

     async login(input: unknown) {
          if (!isRecord(input)) throw new MarketplaceError('Invalid credentials', 400);
          const slug = validateSlug(input.facilitySlug);
          const email = cleanText(input.email, 'email', 254)!.toLowerCase();
          const password = passwordValue(input.password, 1);
          const facility = await db('marketplace_facilities').where({ slug, status: 'approved' }).first();
          if (!facility || facility.integration_state !== 'independent') throw new MarketplaceError('Invalid credentials', 401);
          const staff = await db('marketplace_staff').where({ facility_id: facility.id, email, active: true }).first();
          if (!staff || !(await bcrypt.compare(password, staff.password_hash))) throw new MarketplaceError('Invalid credentials', 401);
          const accessToken = randomBytes(STAFF_TOKEN_BYTES).toString('base64url');
          const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
          await db('marketplace_sessions').insert({ staff_id: staff.id, token_hash: hash(accessToken), expires_at: expiresAt });
          return { accessToken, tokenType: 'Bearer', expiresAt: expiresAt.toISOString(), facility: { slug, name: facility.name }, staff: staffView(staff) };
     }

     async authenticateStaff(token: unknown): Promise<{ staff: any; facility: any }> {
          if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new MarketplaceError('Staff session required', 401);
          const row = await db('marketplace_sessions as s')
               .join('marketplace_staff as u', 'u.id', 's.staff_id')
               .join('marketplace_facilities as f', 'f.id', 'u.facility_id')
               .where('s.token_hash', hash(token)).whereNull('s.revoked_at').where('s.expires_at', '>', new Date())
               .where('u.active', true).where('f.status', 'approved').where('f.integration_state', 'independent')
               .first('s.id as session_id', 'u.id as staff_id', 'u.email', 'u.role', 'u.facility_id', 'f.slug', 'f.name', 'f.integration_state');
          if (!row) throw new MarketplaceError('Invalid or expired staff session', 401);
          return {
               staff: { id: Number(row.staff_id), email: row.email, role: row.role, facilityId: Number(row.facility_id), sessionId: Number(row.session_id) },
               facility: { id: Number(row.facility_id), slug: row.slug, name: row.name, integrationState: row.integration_state },
          };
     }

     async revokeStaffSession(staff: any) {
          await db('marketplace_sessions').where({ id: staff.sessionId }).update({ revoked_at: new Date() });
          return { revoked: true };
     }

     async updateFacilityProfile(staff: any, facility: any, input: unknown) {
          if (staff.role !== 'admin') throw new MarketplaceError('Only a facility administrator may update the public profile', 403);
          if (!isRecord(input)) throw new MarketplaceError('Invalid facility profile', 400);
          const fields: Record<string, unknown> = {};
          if (input.name !== undefined) fields.name = cleanText(input.name, 'name', 160);
          if (input.region !== undefined) fields.region = cleanText(input.region, 'region', 120);
          if (input.locality !== undefined) fields.locality = cleanText(input.locality, 'locality', 160);
          if (input.address !== undefined) fields.address = cleanText(input.address, 'address', 500);
          if (input.phone !== undefined) fields.phone = cleanText(input.phone, 'phone', 40);
          if (input.contactEmail !== undefined) {
               const email = cleanText(input.contactEmail, 'contactEmail', 254)!.toLowerCase();
               if (!emailPattern.test(email)) throw new MarketplaceError('Invalid contactEmail', 400);
               fields.contact_email = email;
          }
          if (input.description !== undefined) fields.description = cleanText(input.description, 'description', 3000);
          if (input.openingHours !== undefined) fields.opening_hours = openingHours(input.openingHours);
          if (input.paymentInstructions !== undefined) fields.payment_instructions = cleanText(input.paymentInstructions, 'payment instructions', 1000, false);
          if (!Object.keys(fields).length) throw new MarketplaceError('No editable profile fields supplied', 400);
          fields.updated_at = new Date();
          await db.transaction(async trx => {
               const updatedCount = await trx('marketplace_facilities').where({ id: facility.id, status: 'approved' }).update(fields);
               if (!updatedCount) throw new MarketplaceError('Approved facility not found', 404);
               await trx('marketplace_audit').insert({
                    facility_id: facility.id, event_type: 'facility_profile_updated', actor_type: 'staff', actor_id: staff.email,
                    details_json: JSON.stringify({ changedFields: Object.keys(fields).filter(key => key !== 'updated_at') }),
               });
          });
          const updated = await db('marketplace_facilities').where({ id: facility.id }).first();
          return this.publicFacility(updated);
     }

     async listStaffUsers(staff: any) {
          if (staff.role !== 'admin') throw new MarketplaceError('Only a facility administrator may manage staff', 403);
          const rows = await db('marketplace_staff').where({ facility_id: staff.facilityId })
               .select('id', 'email', 'role', 'active', 'created_at').orderBy('created_at', 'asc');
          return { staff: rows.map((row: any) => ({
               id: Number(row.id), email: row.email, role: row.role, active: Boolean(row.active), createdAt: row.created_at,
          })) };
     }

     async createStaffUser(staff: any, input: unknown) {
          if (staff.role !== 'admin') throw new MarketplaceError('Only a facility administrator may manage staff', 403);
          if (!isRecord(input)) throw new MarketplaceError('Invalid staff account', 400);
          const email = cleanText(input.email, 'email', 254)!.toLowerCase();
          const password = passwordValue(input.password);
          if (!emailPattern.test(email)) throw new MarketplaceError('Invalid email', 400);
          if (input.role !== undefined && input.role !== 'staff') throw new MarketplaceError('Only facility administrators may create administrator accounts', 403);
          const passwordHash = await bcrypt.hash(password, 12);
          try {
               return await db.transaction(async trx => {
                    const [id] = await trx('marketplace_staff').insert({
                         facility_id: staff.facilityId, email, password_hash: passwordHash, role: 'staff', active: true,
                    });
                    await trx('marketplace_audit').insert({
                         facility_id: staff.facilityId, event_type: 'staff_account_created', actor_type: 'staff',
                         actor_id: staff.email, details_json: JSON.stringify({ staffId: Number(id), email }),
                    });
                    return { staff: { id: Number(id), email, role: 'staff', active: true } };
               });
          } catch (error: any) {
               if (error?.code === 'ER_DUP_ENTRY') throw new MarketplaceError('Staff email already exists for this facility', 409);
               throw error;
          }
     }

     async setStaffUserActive(staff: any, staffIdInput: unknown, activeInput: unknown) {
          if (staff.role !== 'admin') throw new MarketplaceError('Only a facility administrator may manage staff', 403);
          const staffId = positiveId(staffIdInput, 'staff id');
          if (typeof activeInput !== 'boolean') throw new MarketplaceError('active must be a boolean', 400);
          if (staffId === staff.id) throw new MarketplaceError('Use a different administrator account to deactivate this session owner', 409);
          return db.transaction(async trx => {
               const target = await trx('marketplace_staff').where({ id: staffId, facility_id: staff.facilityId }).forUpdate().first();
               if (!target || target.role !== 'staff') throw new MarketplaceError('Staff account not found', 404);
               await trx('marketplace_staff').where({ id: staffId, facility_id: staff.facilityId }).update({ active: activeInput });
               if (!activeInput) await trx('marketplace_sessions').where({ staff_id: staffId }).whereNull('revoked_at').update({ revoked_at: new Date() });
               await trx('marketplace_audit').insert({
                    facility_id: staff.facilityId, event_type: activeInput ? 'staff_account_activated' : 'staff_account_deactivated',
                    actor_type: 'staff', actor_id: staff.email,
                    details_json: JSON.stringify({ staffId, updatedAt: new Date().toISOString() }),
               });
               return { staffId, active: activeInput };
          });
     }

     async addCatalogItem(facility: any, input: unknown) {
          if (facility.staffRole !== 'admin') throw new MarketplaceError('Only a facility administrator may manage the catalog', 403);
          if (facility.integrationState === 'linked') throw new MarketplaceError('PLS-integrated catalogs are read-only here', 409);
          const values = this.catalogInput(input);
          const id = await db.transaction(async trx => {
               const current = await trx('marketplace_facilities').where({ id: facility.id }).forUpdate().first('status', 'integration_state');
               if (!current || current.status !== 'approved' || current.integration_state !== 'independent') {
                    throw new MarketplaceError('Facility catalog is not editable', 409);
               }
               const [createdId] = await trx('marketplace_catalog_items').insert({ facility_id: facility.id, ...values });
               await trx('marketplace_catalog_price_history').insert({
                    facility_id: facility.id, catalog_item_id: createdId,
                    previous_price: null, new_price: values.price, actor_type: 'staff',
                    actor_id: String(facility.staffId || 'staff'),
               });
               await trx('marketplace_audit').insert({
                    facility_id: facility.id, event_type: 'catalog_item_created', actor_type: 'staff',
                    actor_id: String(facility.staffId || 'staff'), details_json: JSON.stringify({ itemId: Number(createdId) }),
               });
               return Number(createdId);
          });
          return { id, ...this.catalogPublic(values) };
     }

     async updateCatalogItem(facility: any, itemId: unknown, input: unknown) {
          if (facility.staffRole !== 'admin') throw new MarketplaceError('Only a facility administrator may manage the catalog', 403);
          if (facility.integrationState === 'linked') throw new MarketplaceError('PLS-integrated catalogs are read-only here', 409);
          const id = positiveId(itemId, 'catalog item id');
          const values = this.catalogInput(input);
          await db.transaction(async trx => {
               const current = await trx('marketplace_facilities').where({ id: facility.id }).forUpdate().first('status', 'integration_state');
               if (!current || current.status !== 'approved' || current.integration_state !== 'independent') {
                    throw new MarketplaceError('Facility catalog is not editable', 409);
               }
               const previous = await trx('marketplace_catalog_items')
                    .where({ id, facility_id: facility.id, active: true }).forUpdate().first('price');
               if (!previous) throw new MarketplaceError('Catalog item not found', 404);
               const updated = await trx('marketplace_catalog_items').where({ id, facility_id: facility.id, active: true }).update({ ...values, updated_at: new Date() });
               if (!updated) throw new MarketplaceError('Catalog item not found', 404);
               if (Math.round(Number(previous.price) * 100) !== Math.round(Number(values.price) * 100)) {
                    await trx('marketplace_catalog_price_history').insert({
                         facility_id: facility.id, catalog_item_id: id,
                         previous_price: Number(previous.price).toFixed(2), new_price: values.price,
                         actor_type: 'staff', actor_id: String(facility.staffId || 'staff'),
                    });
               }
               await trx('marketplace_audit').insert({
                    facility_id: facility.id, event_type: 'catalog_item_updated', actor_type: 'staff',
                    actor_id: String(facility.staffId || 'staff'), details_json: JSON.stringify({ itemId: id }),
               });
          });
          return { id, ...this.catalogPublic(values) };
     }

     private catalogInput(input: unknown) {
          if (!isRecord(input) || !['test', 'panel'].includes(input.type)) throw new MarketplaceError('Invalid catalog item', 400);
          const methods = jsonArray(input.collectionMethods, 'collection methods', allowedMethods);
          const sampleRequirements = input.sampleRequirements;
          if (!Array.isArray(sampleRequirements) || sampleRequirements.length > 10 ||
               sampleRequirements.some(item => typeof item !== 'string' || !item.trim() || item.length > 300)) {
               throw new MarketplaceError('Invalid sample requirements', 400);
          }
          if (input.available !== undefined && typeof input.available !== 'boolean') throw new MarketplaceError('Invalid availability', 400);
          return {
               item_type: input.type,
               name: cleanText(input.name, 'name', 160)!,
               description: cleanText(input.description, 'description', 3000)!,
               price: money(input.price, 'price').toFixed(2),
               sample_requirements: JSON.stringify([...new Set(sampleRequirements.map((item: string) => item.trim()))]),
               collection_methods: JSON.stringify(methods),
               available: input.available === undefined ? true : input.available === true,
               turnaround_hours: input.turnaroundHours === undefined || input.turnaroundHours === null
                    ? null : positiveId(input.turnaroundHours, 'turnaround hours'),
               active: true,
               updated_at: new Date(),
          };
     }

     private catalogPublic(values: any) {
          return {
               type: values.item_type, name: values.name, description: values.description, price: Number(values.price),
               sampleRequirements: JSON.parse(values.sample_requirements), collectionMethods: JSON.parse(values.collection_methods),
               available: Boolean(values.available), turnaroundHours: values.turnaround_hours,
          };
     }

     private publicFacility(row: any) {
          return {
               slug: row.slug, name: row.name, region: row.region, locality: row.locality,
               address: row.address, phone: row.phone, contactEmail: row.contact_email,
               description: row.description, openingHours: JSON.parse(row.opening_hours || '{}'),
               paymentInstructions: row.payment_instructions, currency: row.currency,
               facilityType: row.integration_state === 'linked' ? 'pls-integrated' : 'independent',
          };
     }

     async listBookings(facility: any) {
          const bookingQuery = db('marketplace_bookings as b')
               .where('b.facility_id', facility.id)
               .select('b.id', 'b.status', 'b.patient_name', 'b.patient_phone', 'b.patient_email', 'b.collection_address',
                    'b.collection_method', 'b.total_amount', 'b.currency', 'b.branch_id', 'b.scheduled_at',
                    'b.schedule_instructions', 'b.created_at');
          if (facility.tenantId && facility.branchId) {
               if (roleAllowed(facility.role, ['admin', 'manager'])) {
                    bookingQuery.andWhere(function (this: any) {
                         this.whereNull('b.branch_id').orWhere('b.branch_id', facility.branchId);
                    });
               } else {
                    bookingQuery.andWhere('b.branch_id', facility.branchId);
               }
          }
          const bookings = await bookingQuery.orderBy('b.created_at', 'desc').limit(200);
          const ids = bookings.map((booking: any) => booking.id);
          const items = ids.length ? await db('marketplace_booking_items').whereIn('booking_id', ids)
               .select('booking_id', 'name_snapshot as name', 'unit_price_snapshot as price', 'currency') : [];
          const claims = ids.length ? await db('marketplace_payment_claims').whereIn('booking_id', ids)
               .select('id', 'booking_id', 'reference', 'claimed_amount', 'status', 'decision_reason', 'created_at') : [];
          const refunds = ids.length ? await db('marketplace_refunds').whereIn('booking_id', ids).select('booking_id', 'id') : [];
          const canViewPaymentReferences = roleAllowed(facility.role, ['admin', 'manager']);
          const itemsByBooking = new Map<string, any[]>();
          for (const item of items as any[]) {
               const group = itemsByBooking.get(item.booking_id) || [];
               group.push({ name: item.name, price: Number(item.price), currency: item.currency });
               itemsByBooking.set(item.booking_id, group);
          }
          return {
               bookings: bookings.map((booking: any) => ({
                    bookingId: booking.id, status: booking.status, patient: {
                         name: booking.patient_name, phone: booking.patient_phone, email: booking.patient_email,
                    },
                    collectionMethod: booking.collection_method, collectionAddress: booking.collection_address,
                    branchId: booking.branch_id === null ? null : Number(booking.branch_id),
                    scheduledAt: booking.scheduled_at, scheduleInstructions: booking.schedule_instructions,
                    totalAmount: Number(booking.total_amount), currency: booking.currency, createdAt: booking.created_at,
                    paymentStatus: this.paymentStatusFrom(claims.filter((claim: any) => claim.booking_id === booking.id),
                         booking.status, refunds.some((refund: any) => refund.booking_id === booking.id)),
                    items: itemsByBooking.get(booking.id) || [],
                    paymentClaims: claims.filter((claim: any) => claim.booking_id === booking.id).map((claim: any) => ({
                         id: Number(claim.id), ...(canViewPaymentReferences ? { reference: claim.reference } : {}),
                         amount: Number(claim.claimed_amount),
                         status: claim.status, decisionReason: claim.decision_reason, createdAt: claim.created_at,
                    })),
               })),
          };
     }

     async listCatalog(facility: any) {
          if (facility.integrationState === 'linked') return (await this.publicCatalog(facility.slug));
          const rows = await db('marketplace_catalog_items').where({ facility_id: facility.id, active: true }).orderBy('name');
          return { items: rows.map((row: any) => ({
               id: Number(row.id), type: row.item_type, name: row.name, description: row.description,
               price: Number(row.price), sampleRequirements: JSON.parse(row.sample_requirements),
               collectionMethods: JSON.parse(row.collection_methods), available: Boolean(row.available),
               turnaroundHours: row.turnaround_hours === null ? null : Number(row.turnaround_hours),
          })) };
     }

     async submitPatientPaymentClaim(input: unknown) {
          if (!isRecord(input) || typeof input.trackingToken !== 'string' ||
               !/^[A-Za-z0-9_-]{40,60}$/.test(input.trackingToken)) throw new MarketplaceError('Invalid tracking credential', 401);
          const booking = await db('marketplace_bookings').where({ tracking_token_hash: hash(input.trackingToken) }).first('id', 'facility_id');
          if (!booking) throw new MarketplaceError('Booking not found', 404);
          return this.createPaymentClaim(Number(booking.facility_id), booking.id, input, 'patient', hash(input.trackingToken).slice(0, 24), null);
     }

     private async createPaymentClaim(facilityId: number, bookingId: string, input: unknown, actorType: string, actorId: string, staffId: number | null) {
          const id = this.bookingId(bookingId);
          if (!isRecord(input)) throw new MarketplaceError('Invalid payment claim', 400);
          const reference = cleanText(input.reference, 'payment reference', 120)!;
          if (/[\r\n]/.test(reference)) throw new MarketplaceError('Invalid payment reference', 400);
          const amount = money(input.amount, 'claimed amount');
          return db.transaction(async trx => {
               const booking = await trx('marketplace_bookings').where({ id, facility_id: facilityId }).forUpdate().first();
               if (!booking) throw new MarketplaceError('Booking not found', 404);
               if (['cancelled', 'rejected', 'completed'].includes(booking.status)) throw new MarketplaceError('Payment claim is not allowed for this booking', 409);
               try {
                    const [claimId] = await trx('marketplace_payment_claims').insert({
                         booking_id: id, reference, reference_hash: hash(reference.toLowerCase()),
                         claimed_amount: amount.toFixed(2), status: 'pending',
                    });
                    await trx('marketplace_audit').insert({
                         facility_id: facilityId, booking_id: id, event_type: 'payment_claim_submitted',
                         actor_type: actorType, actor_id: actorId,
                         details_json: JSON.stringify({ claimId: Number(claimId), amount: amount.toFixed(2) }),
                    });
                    await trx('marketplace_bookings').where({ id }).update({ updated_at: new Date() });
                    return { claimId: Number(claimId), status: 'pending_verification' };
               } catch (error: any) {
                    if (error?.code === 'ER_DUP_ENTRY') throw new MarketplaceError('This payment reference has already been submitted', 409);
                    throw error;
               }
          });
     }

     async decidePayment(staff: any, bookingId: unknown, claimIdInput: unknown, input: unknown) {
          const id = this.bookingId(bookingId);
          const claimId = positiveId(claimIdInput, 'claim id');
          if (!isRecord(input) || !['verified', 'rejected'].includes(input.decision)) throw new MarketplaceError('Invalid payment decision', 400);
          const reason = cleanText(input.reason, 'decision reason', 500)!;
          return db.transaction(async trx => {
               const booking = await trx('marketplace_bookings').where({ id, facility_id: staff.facilityId }).forUpdate().first();
               const claim = await trx('marketplace_payment_claims').where({ id: claimId, booking_id: id }).forUpdate().first();
               if (!booking || !claim) throw new MarketplaceError('Booking or payment claim not found', 404);
               if (staff.tenantId && staff.branchId && booking.branch_id !== null &&
                    Number(booking.branch_id) !== staff.branchId) {
                    throw new MarketplaceError('PLS staff may review payments only for bookings assigned to their branch', 403);
               }
               if (claim.status !== 'pending') throw new MarketplaceError('Payment claim has already been decided', 409);
               if (input.decision === 'verified') {
                    if (['cancelled', 'rejected'].includes(booking.status)) throw new MarketplaceError('Payment cannot be verified for a cancelled or rejected booking', 409);
                    if (Math.round(Number(claim.claimed_amount) * 100) !== Math.round(Number(booking.total_amount) * 100)) {
                         throw new MarketplaceError('Claimed amount does not match the catalog-priced booking total', 409);
                    }
                    const prior = await trx('marketplace_payment_claims').where({ booking_id: id, status: 'verified' }).first('id');
                    if (prior) throw new MarketplaceError('A payment has already been verified for this booking', 409);
               }
               const decisionAt = new Date();
               await trx('marketplace_payment_claims').where({ id: claimId }).update({
                    status: input.decision, decision_staff_id: staff.id, decision_actor: staff.email,
                    decision_reason: reason, decided_at: decisionAt,
               });
               await trx('marketplace_audit').insert({
                    facility_id: staff.facilityId, booking_id: id, event_type: `payment_${input.decision}`,
                    actor_type: 'staff', actor_id: staff.email,
                    details_json: JSON.stringify({ claimId, amount: Number(claim.claimed_amount), decidedAt: decisionAt.toISOString(), reason }),
               });
               return { claimId, status: input.decision, decidedAt: decisionAt.toISOString() };
          });
     }

     async decideBooking(staff: any, bookingId: unknown, input: unknown) {
          const id = this.bookingId(bookingId);
          if (!isRecord(input) || !['accept', 'reject', 'schedule', 'collect', 'process', 'complete', 'cancel'].includes(input.action)) {
               throw new MarketplaceError('Invalid booking action', 400);
          }
          const reason = cleanText(input.reason, 'reason', 500)!;
          let scheduledAt: Date | null = null;
          let branchId: number | null = null;
          let scheduleInstructions: string | null = null;
          if (input.action === 'schedule') {
               const scheduledText = cleanText(input.scheduledAt, 'scheduledAt', 40)!;
               if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledText)) {
                    throw new MarketplaceError('scheduledAt must include an explicit timezone', 400);
               }
               scheduledAt = new Date(scheduledText);
               if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
                    throw new MarketplaceError('scheduledAt must be a valid future timestamp', 400);
               }
               scheduleInstructions = cleanText(input.scheduleInstructions, 'scheduleInstructions', 1000, false);
               if (staff.tenantId) {
                    branchId = positiveId(input.branchId, 'branch id');
                    if (staff.branchId && branchId !== staff.branchId) throw new MarketplaceError('PLS staff may schedule only at their assigned branch', 403);
                    const connection = await (await import('../database/KnexConnections')).default(staff.tenantId);
                    const branch = await connection('branch').where({ branchid: branchId }).first('branchid');
                    if (!branch) throw new MarketplaceError('Branch does not exist in the linked PLS tenant', 409);
               } else if (input.branchId !== undefined) {
                    throw new MarketplaceError('Independent facilities do not use PLS branch identifiers', 400);
               }
          } else if (input.scheduledAt !== undefined || input.branchId !== undefined || input.scheduleInstructions !== undefined) {
               throw new MarketplaceError('Scheduling fields are only accepted for the schedule action', 400);
          }
          return db.transaction(async trx => {
               const booking = await trx('marketplace_bookings').where({ id, facility_id: staff.facilityId }).forUpdate().first();
               if (!booking) throw new MarketplaceError('Booking not found', 404);
               const verified = await trx('marketplace_payment_claims').where({ booking_id: id, status: 'verified' }).first('id');
               const transitions: Record<string, BookingStatus[]> = {
                    accept: ['requested'], reject: ['requested', 'accepted'], schedule: ['accepted'],
                    collect: ['scheduled'], process: ['collected'], complete: ['processing'],
                    cancel: ['requested', 'accepted', 'scheduled'],
               };
               const next: Record<string, BookingStatus> = {
                    accept: 'accepted', reject: 'rejected', schedule: 'scheduled', collect: 'collected',
                    process: 'processing', complete: 'completed', cancel: 'cancelled',
               };
               if (!transitions[input.action].includes(booking.status)) throw new MarketplaceError('Booking cannot make that status transition', 409);
               if (staff.tenantId && staff.branchId && input.action !== 'schedule' &&
                    Number(booking.branch_id || 0) !== staff.branchId) {
                    const managerCanReviewUnassigned = roleAllowed(staff.role, ['admin', 'manager']) &&
                         booking.branch_id == null && ['accept', 'reject', 'cancel'].includes(input.action);
                    if (!managerCanReviewUnassigned) {
                         throw new MarketplaceError('PLS staff may act only on bookings assigned to their branch', 403);
                    }
               }
               if (input.action === 'reject' && verified) throw new MarketplaceError('A paid booking must be cancelled and explicitly refunded, not rejected', 409);
               if (['schedule', 'collect', 'process', 'complete'].includes(input.action) && !verified) {
                    throw new MarketplaceError('Payment must be manually verified before scheduling or fulfillment', 409);
               }
               if (input.action === 'cancel' && ['collected', 'processing', 'completed'].includes(booking.status)) {
                    throw new MarketplaceError('A booking cannot be cancelled after collection', 409);
               }
               const newStatus = next[input.action];
               if (['reject', 'cancel'].includes(input.action) && !verified) {
                    await trx('marketplace_payment_claims').where({ booking_id: id, status: 'pending' }).update({
                         status: 'rejected', decision_staff_id: staff.id, decision_actor: staff.email,
                         decision_reason: `Booking ${newStatus}: ${reason}`, decided_at: new Date(),
                    });
               }
               const update: Record<string, unknown> = { status: newStatus, updated_at: new Date() };
               if (input.action === 'schedule') {
                    update.branch_id = branchId;
                    update.scheduled_at = scheduledAt;
                    update.schedule_instructions = scheduleInstructions;
               }
               await trx('marketplace_bookings').where({ id }).update(update);
               await trx('marketplace_audit').insert({
                    facility_id: staff.facilityId, booking_id: id, event_type: `booking_${input.action}`,
                    actor_type: 'staff', actor_id: staff.email,
                    details_json: JSON.stringify({
                         from: booking.status, to: newStatus, reason, amount: Number(booking.total_amount),
                         scheduledAt: scheduledAt?.toISOString() || null, branchId, decidedAt: new Date().toISOString(),
                    }),
               });
               return {
                    bookingId: id, status: newStatus,
                    scheduledAt: scheduledAt?.toISOString() || booking.scheduled_at || null,
                    scheduleInstructions: scheduleInstructions ?? booking.schedule_instructions ?? null,
                    paymentStatus: input.action === 'cancel' && verified ? 'refund_pending' : await this.paymentStatus(id, trx),
               };
          });
     }

     async recordRefund(staff: any, bookingId: unknown, input: unknown) {
          const id = this.bookingId(bookingId);
          if (!isRecord(input)) throw new MarketplaceError('Invalid refund record', 400);
          const externalReference = cleanText(input.externalReference, 'external refund reference', 120)!;
          const reason = cleanText(input.reason, 'reason', 500)!;
          const amount = money(input.amount, 'refund amount');
          return db.transaction(async trx => {
               const booking = await trx('marketplace_bookings').where({ id, facility_id: staff.facilityId }).forUpdate().first();
               if (!booking) throw new MarketplaceError('Booking not found', 404);
               if (staff.tenantId && staff.branchId && booking.branch_id !== null &&
                    Number(booking.branch_id) !== staff.branchId) {
                    throw new MarketplaceError('PLS staff may refund only bookings assigned to their branch', 403);
               }
               const verified = await trx('marketplace_payment_claims').where({ booking_id: id, status: 'verified' }).first('id');
               const existing = await trx('marketplace_refunds').where({ booking_id: id }).first('id');
               if (!verified || !existing && booking.status !== 'cancelled') throw new MarketplaceError('Only a cancelled booking with verified payment can be refunded', 409);
               if (existing) throw new MarketplaceError('A refund has already been recorded', 409);
               if (Math.round(amount * 100) !== Math.round(Number(booking.total_amount) * 100)) {
                    throw new MarketplaceError('Only a full refund matching the verified booking amount is supported', 409);
               }
               try {
                    const [refundId] = await trx('marketplace_refunds').insert({
                         booking_id: id, external_reference: externalReference,
                         reference_hash: hash(externalReference.toLowerCase()), amount: amount.toFixed(2), staff_id: staff.id,
                    });
                    await trx('marketplace_audit').insert({
                         facility_id: staff.facilityId, booking_id: id, event_type: 'payment_refunded',
                         actor_type: 'staff', actor_id: staff.email,
                         details_json: JSON.stringify({ refundId: Number(refundId), amount, externalReference, reason, decidedAt: new Date().toISOString() }),
                    });
                    return { bookingId: id, paymentStatus: 'refunded', refundId: Number(refundId) };
               } catch (error: any) {
                    if (error?.code === 'ER_DUP_ENTRY') throw new MarketplaceError('This refund reference has already been recorded', 409);
                    throw error;
               }
          });
     }

     async approveFacility(facilityIdInput: unknown, actor: { employeeId: number }) {
          const facilityId = positiveId(facilityIdInput, 'facility id');
          return db.transaction(async trx => {
               const facility = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
               if (!facility) throw new MarketplaceError('Facility not found', 404);
               if (facility.status !== 'pending') throw new MarketplaceError('Facility is not awaiting approval', 409);
               await trx('marketplace_facilities').where({ id: facilityId }).update({ status: 'approved', updated_at: new Date() });
               await trx('marketplace_audit').insert({
                    facility_id: facilityId, event_type: 'facility_approved', actor_type: 'platform',
                    actor_id: String(actor.employeeId), details_json: JSON.stringify({ previousStatus: facility.status }),
               });
               return { facilityId, slug: facility.slug, status: 'approved' };
          });
     }

     async listPlatformFacilities(statusInput: unknown) {
          const status = statusInput === undefined ? 'pending' : statusInput;
          if (typeof status !== 'string' || !['pending', 'approved', 'suspended'].includes(status)) {
               throw new MarketplaceError('Invalid facility status filter', 400);
          }
          const rows = await db('marketplace_facilities').where({ status })
               .select('id', 'slug', 'name', 'region', 'locality', 'address', 'phone', 'contact_email',
                    'description', 'opening_hours', 'payment_instructions', 'currency',
                    'integration_state', 'linked_tenant_id', 'created_at')
               .orderBy('created_at', 'asc').limit(200);
          return {
               facilities: rows.map((row: any) => ({
                    id: Number(row.id), ...this.publicFacility(row), status,
                    contactEmail: row.contact_email, linkedTenantId: row.linked_tenant_id === null ? null : Number(row.linked_tenant_id),
                    integrationState: row.integration_state,
                    contact_email: row.contact_email, integration_state: row.integration_state,
                    linked_tenant_id: row.linked_tenant_id === null ? null : Number(row.linked_tenant_id),
                    created_at: row.created_at, opening_hours: row.opening_hours, payment_instructions: row.payment_instructions,
                    createdAt: row.created_at,
               })),
          };
     }

     async provisionFacility(facilityIdInput: unknown, input: unknown, actor: FacilityActor) {
          const facilityId = positiveId(facilityIdInput, 'facility id');
          if (!isRecord(input) || input.identityConfirmed !== true) {
               throw new MarketplaceError('Explicit facility identity confirmation is required', 400);
          }
          let validated;
          try { validated = validateFacilityInput(input); }
          catch (error) {
               if (error instanceof FacilityError) throw new MarketplaceError(error.message, error.statusCode);
               throw error;
          }
          // A durable claim prevents simultaneous provision/link requests. Never retry failed DDL automatically.
          const application = await db.transaction(async trx => {
               const facility = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
               if (!facility) throw new MarketplaceError('Facility not found', 404);
               if (facility.status !== 'approved' || facility.integration_state !== 'independent' || facility.linked_tenant_id !== null) {
                    throw new MarketplaceError('Only an approved, unlinked independent application may be provisioned', 409);
               }
               const catalog = await trx('marketplace_catalog_items').where({ facility_id: facilityId }).first('id');
               const history = await trx('marketplace_bookings').where({ facility_id: facilityId }).first('id');
               if (catalog || history) throw new MarketplaceError('Existing catalog or booking history requires reviewed mappings through the existing tenant/link workflow', 409);
               const profiles = await new PublicFacilityRegistry().all(trx);
               if (profiles.some(profile => profile.slug === facility.slug)) {
                    throw new MarketplaceError('This application slug already has a public tenant profile; review and link the existing tenant instead', 409);
               }
               await trx('marketplace_facilities').where({ id: facilityId }).update({ integration_state: 'provisioning', updated_at: new Date() });
               await trx('marketplace_audit').insert({
                    facility_id: facilityId, event_type: 'facility_provisioning_started', actor_type: 'platform',
                    actor_id: String(actor.employeeId), details_json: JSON.stringify({ identityConfirmed: true }),
               });
               return facility;
          });
          try {
               const { FacilityProvisioningService } = await import('../models/Tenancy/FacilityProvisioningService');
               const provisioned = await new FacilityProvisioningService().provision(validated, actor, async (trx, tenant) => {
                    const current = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
                    if (!current || current.status !== 'approved' || current.integration_state !== 'provisioning' ||
                         await trx('marketplace_catalog_items').where({ facility_id: facilityId }).first('id') ||
                         await trx('marketplace_bookings').where({ facility_id: facilityId }).first('id')) {
                         throw new MarketplaceError('Application changed during provisioning', 409);
                    }
                    await trx('marketplace_facilities').where({ id: facilityId }).update({
                         integration_state: 'linked', linked_tenant_id: tenant.tenantId, updated_at: new Date(),
                    });
                    await trx('marketplace_audit').insert({
                         facility_id: facilityId, event_type: 'facility_provisioned_and_linked', actor_type: 'platform',
                         actor_id: String(actor.employeeId), details_json: JSON.stringify({ tenantId: tenant.tenantId, identityConfirmed: true }),
                    });
               });
               return { facilityId, slug: application.slug, integrationState: 'linked', ...provisioned };
          } catch (error) {
               let failedTenant;
               try {
                    failedTenant = await db(TENANTS_TABLE).where({
                         email: validated.email, company_name: validated.companyName, status: 'failed',
                    }).first('tenant_number');
               } catch {
                    console.error('[marketplace] Failed to resolve the tenant reservation after provisioning failure');
               }
               await db.transaction(async trx => {
                    await trx('marketplace_facilities').where({ id: facilityId, integration_state: 'provisioning' })
                         .update({
                              integration_state: 'provision_failed',
                              linked_tenant_id: failedTenant ? Number(failedTenant.tenant_number) : null,
                              updated_at: new Date(),
                         });
                    await trx('marketplace_audit').insert({
                         facility_id: facilityId, event_type: 'facility_provisioning_failed', actor_type: 'platform',
                         actor_id: String(actor.employeeId), details_json: JSON.stringify({
                              operatorReviewRequired: true,
                              ...(failedTenant ? { tenantId: Number(failedTenant.tenant_number) } : {}),
                         }),
                    });
               }).catch(() => {
                    console.error('[marketplace] Failed to record provisioning failure; operator review required');
               });
               if (error instanceof FacilityError) throw new MarketplaceError(error.message, error.statusCode);
               throw error;
          }
     }

     async retryFacilityProvisioning(facilityIdInput: unknown, input: unknown, actor: FacilityActor) {
          const facilityId = positiveId(facilityIdInput, 'facility id');
          if (!isRecord(input)) throw new MarketplaceError('Facility details are required', 400);
          let validated;
          try { validated = validateFacilityInput(input); }
          catch (error) {
               if (error instanceof FacilityError) throw new MarketplaceError(error.message, error.statusCode);
               throw error;
          }
          const claim = await db.transaction(async trx => {
               const facility = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
               if (!facility) throw new MarketplaceError('Facility not found', 404);
               if (facility.status !== 'approved' || facility.integration_state !== 'provision_failed') {
                    throw new MarketplaceError('Only an approved application with failed provisioning may be retried', 409);
               }
               const expectedAdminEmail = String(facility.admin_email || facility.contact_email || '').trim().toLowerCase();
               const applicationCurrency = String(facility.currency || '').trim().toUpperCase();
               if (String(facility.contact_email || '').trim().toLowerCase() !== validated.email ||
                    String(facility.name || '').trim() !== validated.companyName ||
                    String(facility.phone || '').trim() !== validated.phone ||
                    String(facility.address || '').trim() !== validated.address ||
                    expectedAdminEmail !== validated.adminEmail ||
                    (applicationCurrency && !validated.planCode && validated.moduleConfiguration?.currency !== applicationCurrency)) {
                    throw new MarketplaceError('Retry details must match the approved website application', 409);
               }
               if (await trx('marketplace_catalog_items').where({ facility_id: facilityId }).first('id') ||
                    await trx('marketplace_bookings').where({ facility_id: facilityId }).first('id')) {
                    throw new MarketplaceError('Existing catalog or booking history requires reviewed mappings through the existing tenant/link workflow', 409);
               }
               let tenant;
               if (facility.linked_tenant_id !== null) {
                    tenant = await trx(TENANTS_TABLE).where({
                         tenant_number: facility.linked_tenant_id, status: 'failed',
                         email: validated.email, company_name: validated.companyName,
                    }).first('tenant_number');
                    if (!tenant) throw new MarketplaceError('The failed tenant reservation no longer matches this application', 409);
               } else {
                    tenant = await trx(TENANTS_TABLE).where({
                         email: validated.email, company_name: validated.companyName,
                    }).first('tenant_number', 'status');
                    if (tenant && tenant.status !== 'failed') {
                         throw new MarketplaceError(`The matching tenant is ${tenant.status}; review it before retrying`, 409);
                    }
               }
               const tenantId = tenant ? Number(tenant.tenant_number) : null;
               await trx('marketplace_facilities').where({ id: facilityId, integration_state: 'provision_failed' }).update({
                    integration_state: 'provisioning', linked_tenant_id: tenantId, updated_at: new Date(),
               });
               await trx('marketplace_audit').insert({
                    facility_id: facilityId, event_type: 'facility_provisioning_retry_started', actor_type: 'platform',
                    actor_id: String(actor.employeeId), details_json: JSON.stringify({
                         approvedApplicationMatched: true, ...(tenantId ? { tenantId } : {}),
                    }),
               });
               return { slug: facility.slug, tenantId };
          });
          try {
               const { FacilityProvisioningService } = await import('../models/Tenancy/FacilityProvisioningService');
               const service = new FacilityProvisioningService();
               const activate = async (trx: any, tenant: any) => {
                    const current = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
                    if (!current || current.status !== 'approved' || current.integration_state !== 'provisioning' ||
                         (current.linked_tenant_id !== null && Number(current.linked_tenant_id) !== tenant.tenantId)) {
                         throw new MarketplaceError('Application changed during provisioning retry', 409);
                    }
                    await trx('marketplace_facilities').where({ id: facilityId }).update({
                         integration_state: 'linked', linked_tenant_id: tenant.tenantId, updated_at: new Date(),
                    });
                    await trx('marketplace_audit').insert({
                         facility_id: facilityId, event_type: 'facility_provisioning_retry_linked', actor_type: 'platform',
                         actor_id: String(actor.employeeId), details_json: JSON.stringify({
                              tenantId: tenant.tenantId, approvedApplicationMatched: true,
                         }),
                    });
               };
               const provisioned = claim.tenantId === null
                    ? await service.provision(validated, actor, activate)
                    : await service.retry(claim.tenantId, validated, actor, activate);
               return { facilityId, slug: claim.slug, integrationState: 'linked', ...provisioned };
          } catch (error) {
               await db.transaction(async trx => {
                    await trx('marketplace_facilities').where({ id: facilityId, integration_state: 'provisioning' })
                         .update({ integration_state: 'provision_failed', updated_at: new Date() });
                    await trx('marketplace_audit').insert({
                         facility_id: facilityId, event_type: 'facility_provisioning_retry_failed', actor_type: 'platform',
                         actor_id: String(actor.employeeId), details_json: JSON.stringify({
                              operatorReviewRequired: true, ...(claim.tenantId ? { tenantId: claim.tenantId } : {}),
                         }),
                    });
               }).catch(() => {
                    console.error('[marketplace] Failed to record provisioning retry failure; operator review required');
               });
               if (error instanceof FacilityError) throw new MarketplaceError(error.message, error.statusCode);
               throw error;
          }
     }

     async suspendFacility(facilityIdInput: unknown, reasonInput: unknown, actor: { employeeId: number }) {
          const facilityId = positiveId(facilityIdInput, 'facility id');
          const reason = cleanText(reasonInput, 'reason', 500)!;
          return db.transaction(async trx => {
               const facility = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
               if (!facility) throw new MarketplaceError('Facility not found', 404);
               if (facility.status !== 'approved') throw new MarketplaceError('Only an approved facility can be suspended', 409);
               await trx('marketplace_facilities').where({ id: facilityId }).update({ status: 'suspended', updated_at: new Date() });
               await trx('marketplace_audit').insert({
                    facility_id: facilityId, event_type: 'facility_suspended', actor_type: 'platform',
                    actor_id: String(actor.employeeId), details_json: JSON.stringify({ reason, suspendedAt: new Date().toISOString() }),
               });
               return { facilityId, slug: facility.slug, status: 'suspended' };
          });
     }

     async linkTenant(facilityIdInput: unknown, tenantIdInput: unknown, identityConfirmed: unknown, mappingsInput: unknown, actor: { employeeId: number }) {
          const facilityId = positiveId(facilityIdInput, 'facility id');
          const tenantId = positiveId(tenantIdInput, 'tenant id');
          if (identityConfirmed !== true) throw new MarketplaceError('Explicit facility identity confirmation is required', 400);
          const facility = await db('marketplace_facilities').where({ id: facilityId, status: 'approved' }).first();
          if (!facility || facility.integration_state !== 'independent') throw new MarketplaceError('Only an approved independent facility can be linked', 409);
          const { TenantRegistry } = await import('../models/Tenancy/TenantRegistry');
          const registry = new TenantRegistry();
          const tenant = await registry.requireTenant(tenantId);
          if (!tenant.isActive) throw new MarketplaceError('PLS tenant is not active', 409);
          const configured = (await new PublicFacilityRegistry().all()).find(item => item.slug === facility.slug && item.tenantId === tenantId && item.published && item.catalogPublished);
          if (!configured) throw new MarketplaceError('A matching published PLS public catalog must be configured before linking', 409);
          const live = await new PublicFacilityCatalog().catalog(facility.slug);
          const coreItems = new Map<number, string>();
          for (const item of live.tests) coreItems.set(Number(item.id), 'test');
          for (const item of live.panels || []) coreItems.set(Number(item.id), 'panel');
          // Map every independent catalog row, including retired entries referenced
          // by older bookings, so historical snapshots remain reconcilable.
          const oldItems = await db('marketplace_catalog_items').where({ facility_id: facilityId }).select('id', 'item_type');
          if (!Array.isArray(mappingsInput) || mappingsInput.length !== oldItems.length) {
               throw new MarketplaceError('Provide an explicit PLS catalog mapping for every active marketplace catalog item', 400);
          }

               const mappings = new Map<number, { coreItemId: number; coreItemType: string }>();
          for (const candidate of mappingsInput) {
               if (!isRecord(candidate)) throw new MarketplaceError('Invalid catalog mapping', 400);
               const marketplaceItemId = positiveId(candidate.marketplaceItemId, 'marketplace item id');
               const coreItemId = positiveId(candidate.coreItemId, 'PLS catalog item id');
               const coreItemType = candidate.coreItemType;
               if (!['test', 'panel'].includes(coreItemType) || coreItems.get(coreItemId) !== coreItemType ||
                    mappings.has(marketplaceItemId)) throw new MarketplaceError('Invalid or duplicate PLS catalog mapping', 400);
               mappings.set(marketplaceItemId, { coreItemId, coreItemType });
          }
          for (const oldItem of oldItems) {
               if (!mappings.has(Number(oldItem.id))) throw new MarketplaceError('A marketplace catalog item has no explicit PLS mapping', 400);
          }
          return db.transaction(async trx => {
               const current = await trx('marketplace_facilities').where({ id: facilityId }).forUpdate().first();
               if (!current || current.status !== 'approved' || current.integration_state !== 'independent') {
                    throw new MarketplaceError('Facility integration state changed; refresh and retry', 409);
               }
               const currentItems = await trx('marketplace_catalog_items').where({ facility_id: facilityId }).select('id');
               if (currentItems.length !== mappings.size || currentItems.some((item: any) => !mappings.has(Number(item.id)))) {
                    throw new MarketplaceError('Catalog changed during integration preparation; reload mappings and retry', 409);
               }
               await trx('marketplace_facilities').where({ id: facilityId }).update({
                    integration_state: 'linked', linked_tenant_id: tenantId, updated_at: new Date(),
               });
               if (mappings.size) {
                    await trx('marketplace_catalog_mappings').insert([...mappings.entries()].map(([marketplaceItemId, mapping]) => ({
                         facility_id: facilityId, marketplace_item_id: marketplaceItemId,
                         core_item_id: mapping.coreItemId, core_item_type: mapping.coreItemType,
                    })));
                    for (const [marketplaceItemId, mapping] of mappings.entries()) {
                         await trx('marketplace_booking_items').where({ catalog_item_id: marketplaceItemId })
                              .update({ core_item_id: mapping.coreItemId });
                    }
               }
               await trx('marketplace_audit').insert({
                    facility_id: facilityId, event_type: 'facility_linked_to_pls', actor_type: 'platform',
                    actor_id: String(actor.employeeId),
                    details_json: JSON.stringify({ tenantId, identityConfirmed: true, activeCoreCatalogItems: coreItems.size, mappedMarketplaceItems: mappings.size }),
               });
               return {
                    facilityId, slug: facility.slug, integrationState: 'linked', tenantId,
                    catalogSource: 'live-pls', historicalBookingsPreserved: true,
                    note: 'Historical marketplace bookings and catalog snapshots are retained; no patient, billing, sample, or laboratory orders were created.',
               };
          });
     }

     async linkExistingCoreRecords(staff: any, bookingIdInput: unknown, input: unknown) {
          const bookingId = this.bookingId(bookingIdInput);
          if (!isRecord(input)) throw new MarketplaceError('Invalid existing-record linkage', 400);
          const patientId = positiveId(input.patientId, 'patient id');
          const billingId = positiveId(input.billingId, 'billing id');
          const sampleId = input.sampleId === undefined || input.sampleId === null ? null : positiveId(input.sampleId, 'sample id');
          const tenantId = positiveId(staff.tenantId, 'tenant id');
          const employeeId = positiveId(staff.employeeId, 'employee id');
          const linkable = await db('marketplace_bookings as b')
               .join('marketplace_facilities as f', 'f.id', 'b.facility_id')
               .where({ 'b.id': bookingId, 'f.status': 'approved', 'f.integration_state': 'linked', 'f.linked_tenant_id': tenantId })
               .first('b.id', 'b.facility_id', 'b.status', 'b.total_amount', 'b.branch_id', 'f.linked_tenant_id');
          if (!linkable) throw new MarketplaceError('Booking is not linked to this PLS facility', 404);
          if (linkable.status !== 'scheduled') throw new MarketplaceError('Only scheduled bookings may be linked to existing PLS records', 409);
          const verifiedPayment = await db('marketplace_payment_claims').where({ booking_id: bookingId, status: 'verified' }).first('id');
          if (!verifiedPayment) {
               throw new MarketplaceError('Manual payment verification is required before core linkage', 409);
          }

          const connection = await (await import('../database/KnexConnections')).default(tenantId);
          const patient = await connection('new_patients').where({ patientid: patientId }).first('patientid');
          if (!patient) throw new MarketplaceError('Patient record does not exist in the linked PLS tenant', 404);
          const billing = await connection('billing').where({ billingid: billingId })
               .first('billingid', 'patientid', 'branchid', 'status');
          if (!billing || Number(billing.patientid) !== patientId) {
               throw new MarketplaceError('Billing record does not belong to the selected patient', 409);
          }
          if (['voided', 'corrected', 'written-off'].includes(String(billing.status || '').toLowerCase())) {
               throw new MarketplaceError('Voided or superseded billing cannot be linked', 409);
          }
          const branchId = positiveId(billing.branchid, 'billing branch');
          const branch = await connection('branch').where({ branchid: branchId }).first('branchid');
          if (!branch) throw new MarketplaceError('Billing branch does not exist in the linked PLS tenant', 409);
          if (linkable.branch_id !== null && Number(linkable.branch_id) !== branchId) {
               throw new MarketplaceError('Billing branch does not match the scheduled marketplace booking branch', 409);
          }
          if (staff.branchId && branchId !== staff.branchId) throw new MarketplaceError('PLS staff may link only billings from their assigned branch', 403);

          const items = await db('marketplace_booking_items').where({ booking_id: bookingId }).select('core_item_id', 'item_type');
          const expectedTestIds = items.filter((item: any) => item.core_item_id !== null && ['test', 'panel'].includes(item.item_type))
               .map((item: any) => Number(item.core_item_id));
          if (expectedTestIds.length !== items.length || expectedTestIds.length === 0) {
               throw new MarketplaceError('Booking does not contain fully mapped PLS test items', 409);
          }
          const billTests = await connection('test_ascension').where({ billingid: billingId }).select('testid');
          const billedTestIds = new Set(billTests.map((row: any) => Number(row.testid)));
          if (expectedTestIds.some(id => !billedTestIds.has(id))) {
               throw new MarketplaceError('PLS billing does not contain every test in the accepted booking', 409);
          }

          if (sampleId !== null) {
               const sample = await connection('physical_samples').where({ id: sampleId }).first('id', 'patientid', 'billingid');
               if (!sample || Number(sample.patientid) !== patientId || Number(sample.billingid) !== billingId) {
                    throw new MarketplaceError('Sample does not belong to the selected patient and billing', 409);
               }
          }
          return db.transaction(async trx => {
               const locked = await trx('marketplace_bookings as b').join('marketplace_facilities as f', 'f.id', 'b.facility_id')
                    .where({ 'b.id': bookingId, 'f.linked_tenant_id': tenantId, 'f.integration_state': 'linked' })
                    .forUpdate().first('b.status');
               if (!locked || !['accepted', 'scheduled'].includes(locked.status)) {
                    throw new MarketplaceError('Booking state changed; refresh and retry', 409);
               }
               const existing = await trx('marketplace_core_booking_links').where({ booking_id: bookingId }).first();
               if (existing) {
                    if (Number(existing.tenant_id) === tenantId && Number(existing.patient_id) === patientId &&
                         Number(existing.billing_id) === billingId && Number(existing.physical_sample_id || 0) === Number(sampleId || 0)) {
                         return { bookingId, patientId, billingId, branchId: Number(existing.branch_id), sampleId: existing.physical_sample_id, alreadyLinked: true };
                    }
                    throw new MarketplaceError('Booking is already linked to different PLS records', 409);
               }
               try {
                    await trx('marketplace_core_booking_links').insert({
                         booking_id: bookingId, tenant_id: tenantId, patient_id: patientId, billing_id: billingId,
                         branch_id: branchId, physical_sample_id: sampleId, linked_by_employee_id: employeeId,
                    });
               } catch (error: any) {
                    if (error?.code === 'ER_DUP_ENTRY') throw new MarketplaceError('Billing is already linked to a marketplace booking', 409);
                    throw error;
               }
               await trx('marketplace_audit').insert({
                    facility_id: Number(linkable.facility_id), booking_id: bookingId, event_type: 'existing_core_records_linked',
                    actor_type: 'pls_staff', actor_id: String(employeeId),
                    details_json: JSON.stringify({ tenantId, patientId, billingId, branchId, sampleId, linkedAt: new Date().toISOString() }),
               });
               return { bookingId, patientId, billingId, branchId, sampleId, alreadyLinked: false };
          });
     }

     private bookingId(value: unknown): string {
          if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) throw new MarketplaceError('Invalid booking reference', 400);
          return value;
     }

     private async paymentStatus(bookingId: string, connection: any = db): Promise<PaymentStatus> {
          const claims = await connection('marketplace_payment_claims').where({ booking_id: bookingId }).orderBy('created_at', 'desc');
          return this.paymentStatusFrom(claims);
     }

     private paymentStatusFrom(claims: any[], bookingStatus?: string, refunded = false): PaymentStatus {
          if (refunded) return 'refunded';
          if (bookingStatus === 'cancelled' && claims.some(claim => claim.status === 'verified')) return 'refund_pending';
          if (claims.some(claim => claim.status === 'verified')) return 'verified';
          if (claims.length && claims.some(claim => claim.status === 'pending')) return 'pending_verification';
          if (claims.length && claims.every(claim => claim.status === 'rejected')) return 'rejected';
          return 'unpaid';
     }

}
