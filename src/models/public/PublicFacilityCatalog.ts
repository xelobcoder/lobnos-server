import KnexConnection from '../../database/KnexConnections';
import { configuration } from '../../hooks/configuration';
import { TenancyRepository } from '../Tenancy/tenancyRepo';
import { PublicFacilityRegistry } from './PublicFacilityRegistry';

export interface PublicFacility {
     slug: string;
     name: string;
     region: string;
     locality: string;
     description: string;
     currency: string;
     website?: string;
     facilityLoginUrl?: string;
     patientPortalUrl?: string;
}

export interface PublishedFacility extends PublicFacility {
     tenantId: number;
     currency: string;
     published: boolean;
     catalogPublished: boolean;
     panelIds?: number[];
}

export interface PublicCatalogItem {
     id: number;
     name: string;
     description: string | null;
     price: number;
     currency: string;
}

export class PublicCatalogError extends Error {
     constructor(message: string, public readonly statusCode: number) {
          super(message);
     }
}

const object = (value: unknown): value is Record<string, unknown> =>
     typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, max: number, required = true): string {
     if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
          throw new Error('Invalid public facility configuration');
     }
     return value.trim();
}

function destination(value: unknown): string | undefined {
     if (value === undefined) return undefined;
     const raw = text(value, 2048);
     const url = new URL(raw);
     const loopbackHttp = process.env.PUBLIC_FACILITY_ALLOW_LOOPBACK_HTTP === 'true' &&
          url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
     if ((url.protocol !== 'https:' && !loopbackHttp) || url.username || url.password || url.search || url.hash) {
          throw new Error('Public facility destinations must be credential-free HTTPS URLs without query parameters');
     }
     return url.toString();
}

export function parsePublicFacilities(raw: string): PublishedFacility[] {
     if (raw.length > 500_000) throw new Error('Public facility configuration exceeds the size limit');
     const records: unknown = JSON.parse(raw);
     if (!Array.isArray(records) || records.length > 200) throw new Error('Invalid public facility configuration');
     const seen = new Set<string>();
     return records.map(record => {
          if (!object(record)) throw new Error('Invalid public facility configuration');
          const slug = text(record.slug, 80);
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(slug)) throw new Error('Public facility slugs must be unique');
          seen.add(slug);
          if (typeof record.tenantId !== 'number' || !Number.isSafeInteger(record.tenantId) || record.tenantId <= 0 ||
               typeof record.published !== 'boolean' || typeof record.catalogPublished !== 'boolean') {
               throw new Error('Public facility approval and tenant configuration are required');
          }
          const currency = text(record.currency, 3);
          if (!/^[A-Z]{3}$/.test(currency)) throw new Error('A three-letter catalog currency is required');
          if (!configuration.isMultiTenant && record.tenantId !== configuration.defaultTenantId) {
               throw new Error('Public facility tenant does not match this single-tenant installation');
          }
          const panelIds = record.panelIds === undefined ? [] : record.panelIds;
          if (!Array.isArray(panelIds) || panelIds.length > 1000 || new Set(panelIds).size !== panelIds.length ||
               panelIds.some(id => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0)) {
               throw new Error('Public panel IDs must be unique positive tariff identifiers');
          }
          return {
               slug, tenantId: record.tenantId, currency,
               published: record.published, catalogPublished: record.catalogPublished,
               panelIds,
               name: text(record.name, 160),
               region: text(record.region, 120),
               locality: text(record.locality, 160),
               description: text(record.description, 3000, false),
               website: destination(record.website),
               facilityLoginUrl: destination(record.facilityLoginUrl),
               patientPortalUrl: destination(record.patientPortalUrl),
          };
     });
}

function publicFields(facility: PublishedFacility): PublicFacility {
     return {
          slug: facility.slug, name: facility.name, region: facility.region,
          locality: facility.locality, description: facility.description,
          currency: facility.currency,
          website: facility.website, facilityLoginUrl: facility.facilityLoginUrl,
          patientPortalUrl: facility.patientPortalUrl,
     };
}

function catalogItem(row: Record<string, unknown>, currency: string): PublicCatalogItem {
     const id = Number(row.id);
     const rawPrice = row.price;
     if (!Number.isSafeInteger(id) || id <= 0 || !['string', 'number'].includes(typeof rawPrice) ||
          String(rawPrice).trim() === '') throw new Error('Invalid public catalog record');
     const price = Number(rawPrice);
     if (!Number.isFinite(price) || price < 0 || typeof row.name !== 'string' || !row.name.trim() ||
          (row.description !== null && row.description !== undefined && typeof row.description !== 'string')) {
          throw new Error('Invalid public catalog record');
     }
     return {
          id, name: row.name.trim(),
          description: typeof row.description === 'string' ? row.description : null,
          price, currency,
     };
}

export class PublicFacilityCatalog {
     private readonly registry = new TenancyRepository();
     private readonly profiles = new PublicFacilityRegistry();

     async list(): Promise<{ facilities: PublicFacility[] }> {
          const published = (await this.profiles.all()).filter(facility => facility.published);
          const facilities: PublicFacility[] = [];
          for (const facility of published) {
               if (await this.registry.validateTenantStanding(facility.tenantId) && await this.profiles.publicationAllowed(facility)) {
                    facilities.push(publicFields(facility));
               }
          }
          return { facilities };
     }

     async catalog(slug: string) {
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
               throw new PublicCatalogError('Laboratory not found', 404);
          }
          const facility = (await this.profiles.all()).find(item => item.slug === slug && item.published && item.catalogPublished);
          if (!facility || !await this.registry.validateTenantStanding(facility.tenantId) || !await this.profiles.publicationAllowed(facility)) {
               throw new PublicCatalogError('Laboratory catalog not published', 404);
          }
          const connection = await KnexConnection(facility.tenantId);
          // These are the same base tariff records used for general/cash lab billing.
          // Restrict to configured tests, without exposing testdetails or billing/customer records.
          const panelIds = new Set(facility.panelIds || []);
          const hasCopyVisibility = await connection.schema.hasColumn('test_panels', 'copy_requires_publication');
          const tests = await connection('test_panels as panel')
               .whereExists(connection('testdetails as details').select(connection.raw('1')).whereRaw('details.testid = panel.id'))
               .select('panel.id', 'panel.name', 'panel.description', 'panel.price', ...(hasCopyVisibility ? ['panel.copy_requires_publication'] : []))
               .orderBy('panel.name');
          const visibleTests = hasCopyVisibility ? tests.filter(row => !Number(row.copy_requires_publication) || panelIds.has(Number(row.id))) : tests;
          const services = await connection('additionalservices')
               .select('keyid as id', 'serviceName as name', 'servicePrice as price')
               .orderBy('serviceName');
          const items = visibleTests.map(row => catalogItem(row, facility.currency));
          return {
               facility: publicFields(facility),
               tests: items.filter(item => !panelIds.has(item.id)),
               panels: items.filter(item => panelIds.has(item.id)),
               services: services.map(row => catalogItem(row, facility.currency)),
               currency: facility.currency,
               pricingContext: 'General / cash list prices. Packages, insurance, discounts, taxes and other adjustments may change the final bill. Confirm preparation instructions and the final price with the laboratory.',
               updatedAt: new Date().toISOString(),
          };
     }
}
