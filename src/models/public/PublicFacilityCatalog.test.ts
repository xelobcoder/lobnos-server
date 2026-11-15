import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'http';

const mocks = vi.hoisted(() => ({
     standing: vi.fn(), connection: vi.fn(), log: vi.fn(),
}));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('./PublicFacilityRegistry', () => ({
     PublicFacilityRegistry: class {
          all = async () => parsePublicFacilities();
          publicationAllowed = async () => true;
     },
}));
vi.mock('../Tenancy/tenancyRepo', () => ({
     TenancyRepository: class { validateTenantStanding = mocks.standing; },
}));
vi.mock('../../hooks/logger', () => ({ default: { error: mocks.log } }));

import { configuration } from '../../hooks/configuration';
import { parsePublicFacilities, PublicFacilityCatalog } from './PublicFacilityCatalog';
import router from '../../controllers/public/facilities';

const facility = {
     slug: 'test-laboratory', tenantId: 3, name: 'Synthetic laboratory',
     region: 'Test region', locality: 'Test locality', description: 'Synthetic public description',
     currency: 'GHS', published: true, catalogPublished: true,
     facilityLoginUrl: 'https://lab.example/authentications/login',
     patientPortalUrl: 'https://lab.example/patientportal',
};
const originalConfiguration = { ...configuration };

function database(tests: Record<string, unknown>[] = [{ id: 10, name: 'Synthetic test', description: 'Public explanation', price: '120.50' }],
     services: Record<string, unknown>[] = [{ id: 5, name: 'Synthetic service', price: '30.00' }]) {
     const testQuery = {
          whereExists: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue(tests),
     };
     const serviceQuery = { select: vi.fn().mockReturnThis(), orderBy: vi.fn().mockResolvedValue(services) };
     const detailsQuery = { select: vi.fn().mockReturnThis(), whereRaw: vi.fn().mockReturnThis() };
     const db = Object.assign(vi.fn((table: string) => {
          if (table === 'test_panels as panel') return testQuery;
          if (table === 'additionalservices') return serviceQuery;
          if (table === 'testdetails as details') return detailsQuery;
          throw new Error('Unexpected public database table');
     }), { raw: vi.fn(), schema: { hasColumn: vi.fn().mockResolvedValue(false) } });
     mocks.connection.mockResolvedValue(db);
     return { db, testQuery, serviceQuery };
}

beforeEach(() => {
     vi.clearAllMocks();
     configuration.isMultiTenant = true;
     configuration.defaultTenantId = 3;
     vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([facility]));
     mocks.standing.mockResolvedValue(true);
});
afterEach(() => {
     vi.unstubAllEnvs();
     Object.assign(configuration, originalConfiguration);
});

describe('public facility opt-in registry', () => {
     it('publishes nothing by default', () => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', '');
          expect(parsePublicFacilities()).toEqual([]);
     });
     it('allows local portal HTTP only with explicit loopback permission, never remote HTTP', () => {
          const local = { ...facility, facilityLoginUrl: 'http://localhost:2377/authentications/login' };
          vi.stubEnv('PUBLIC_FACILITY_ALLOW_LOOPBACK_HTTP', 'false');
          expect(() => parsePublicFacilities(JSON.stringify([local]))).toThrow();
          vi.stubEnv('PUBLIC_FACILITY_ALLOW_LOOPBACK_HTTP', 'true');
          expect(parsePublicFacilities(JSON.stringify([local]))[0].facilityLoginUrl).toBe(local.facilityLoginUrl);
          for (const facilityLoginUrl of ['http://remote.example/login', 'http://localhost.example/login',
               'http://localhost:2377/login?token=private', 'http://localhost:2377/login#private']) {
               expect(() => parsePublicFacilities(JSON.stringify([{ ...facility, facilityLoginUrl }]))).toThrow();
          }
     });
     it.each([
          { tenantId: '../3' }, { tenantId: 0 }, { published: undefined },
          { catalogPublished: undefined }, { currency: 'ghs' }, { slug: '../private' },
          { patientPortalUrl: 'http://lab.example' }, { patientPortalUrl: 'https://user:password@lab.example' },
          { patientPortalUrl: 'https://lab.example?patientid=1' }, { patientPortalUrl: 'https://lab.example#token' },
     ])('rejects unsafe configuration %j', changes => {
          expect(() => parsePublicFacilities(JSON.stringify([{ ...facility, ...changes }]))).toThrow();
     });
     it('rejects duplicate slugs and mismatching single-tenant aliases', () => {
          expect(() => parsePublicFacilities(JSON.stringify([facility, facility]))).toThrow('unique');
          configuration.isMultiTenant = false;
          expect(() => parsePublicFacilities(JSON.stringify([{ ...facility, tenantId: 4 }]))).toThrow('single-tenant');
     });
     it('publishes explicit fields only, without tenant identifiers or private input fields', async () => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([{ ...facility, secret: 'not public', email: 'not-approved@example.test' }]));
          const result = await new PublicFacilityCatalog().list();
          expect(result.facilities).toHaveLength(1);
          expect(result.facilities[0]).not.toHaveProperty('tenantId');
          expect(result.facilities[0]).not.toHaveProperty('secret');
          expect(result.facilities[0]).not.toHaveProperty('email');
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('does not expose unapproved or inactive facilities', async () => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([{ ...facility, published: false }]));
          expect(await new PublicFacilityCatalog().list()).toEqual({ facilities: [] });
          expect(mocks.standing).not.toHaveBeenCalled();
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([facility]));
          mocks.standing.mockResolvedValue(false);
          expect(await new PublicFacilityCatalog().list()).toEqual({ facilities: [] });
     });
});

describe('public cash tariff catalog', () => {
     it('splits explicitly classified panels using the same unique live tariff IDs and prices', async () => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([{ ...facility, panelIds: [12] }]));
          database([
               { id: 10, name: 'Synthetic test', description: null, price: '5.00' },
               { id: 12, name: 'Synthetic panel', description: 'Public panel explanation', price: '22.50' },
          ]);
          const result = await new PublicFacilityCatalog().catalog(facility.slug);
          expect(result.tests.map(item => item.id)).toEqual([10]);
          expect(result.panels).toEqual([{ id: 12, name: 'Synthetic panel', description: 'Public panel explanation', price: 22.5, currency: 'GHS' }]);
          expect(result.facility).not.toHaveProperty('panelIds');
     });
     it('publishes copied panels only after explicit selection', async () => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([{ ...facility, panelIds: [12] }]));
          const { db } = database([
               { id: 10, name: 'Regular test', price: 5 },
               { id: 11, name: 'Hidden copy', price: 10, copy_requires_publication: 1 },
               { id: 12, name: 'Approved copy', price: 15, copy_requires_publication: 1 },
          ]);
          db.schema.hasColumn.mockResolvedValue(true);
          const result = await new PublicFacilityCatalog().catalog(facility.slug);
          expect(result.tests.map(item => item.id)).toEqual([10]);
          expect(result.panels.map(item => item.id)).toEqual([12]);
     });
     it('reads approved tenant cash tariffs and descriptions, omitting internal fields and missing descriptions', async () => {
          const { db, testQuery } = database();
          const result = await new PublicFacilityCatalog().catalog(facility.slug);
          expect(mocks.connection).toHaveBeenCalledWith(3);
          expect(testQuery.select).toHaveBeenCalledWith('panel.id', 'panel.name', 'panel.description', 'panel.price');
          expect(result.tests).toEqual([{ id: 10, name: 'Synthetic test', description: 'Public explanation', price: 120.5, currency: 'GHS' }]);
          expect(result.services[0].description).toBeNull();
          expect(result.pricingContext).toMatch(/General \/ cash list prices/);
          expect(JSON.stringify(result)).not.toContain('tenantId');
          expect(db.mock.calls.map(([table]) => table)).not.toContain('billing');
          expect(db.mock.calls.map(([table]) => table)).not.toContain('new_patients');
     });
     it.each([{ published: false }, { catalogPublished: false }])('requires separate catalog approval %j', changes => {
          vi.stubEnv('PUBLIC_FACILITY_DIRECTORY_JSON', JSON.stringify([{ ...facility, ...changes }]));
          return expect(new PublicFacilityCatalog().catalog(facility.slug)).rejects.toMatchObject({ statusCode: 404 });
     });
     it('does not connect to unknown, malformed or inactive tenant catalogs', async () => {
          await expect(new PublicFacilityCatalog().catalog('unknown')).rejects.toMatchObject({ statusCode: 404 });
          await expect(new PublicFacilityCatalog().catalog('../3')).rejects.toMatchObject({ statusCode: 404 });
          mocks.standing.mockResolvedValue(false);
          await expect(new PublicFacilityCatalog().catalog(facility.slug)).rejects.toMatchObject({ statusCode: 404 });
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it.each([null, '', '-1', 'not-a-price', Infinity])('does not silently turn invalid prices into zero (%s)', async price => {
          database([{ id: 10, name: 'Synthetic test', description: null, price }]);
          await expect(new PublicFacilityCatalog().catalog(facility.slug)).rejects.toThrow('Invalid public catalog');
     });
     it('accepts explicitly free tests and preserves a missing description as null', async () => {
          database([{ id: 10, name: 'Synthetic free test', description: null, price: '0' }]);
          expect((await new PublicFacilityCatalog().catalog(facility.slug)).tests[0].price).toBe(0);
     });
});

describe('public HTTP integration', () => {
     let server: Server;
     let base: string;
     beforeEach(async () => {
          const app = express();
          app.use(router);
          app.use((_req, res) => res.status(418).json({ message: 'Private middleware reached' }));
          server = await new Promise<Server>(resolve => {
               const running = app.listen(0, '127.0.0.1', () => resolve(running));
          });
          const address = server.address();
          if (!address || typeof address === 'string') throw new Error('Test server unavailable');
          base = `http://127.0.0.1:${address.port}`;
     });
     afterEach(async () => {
          if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
     });
     it('serves discovery and catalogs without tenant middleware or credentials', async () => {
          database();
          const list = await fetch(`${base}/api/v1/public/facilities`);
          expect(list.status).toBe(200);
          expect((await list.json()).facilities).toHaveLength(1);
          const catalog = await fetch(`${base}/api/v1/public/facilities/test-laboratory/catalog`);
          expect(catalog.status).toBe(200);
          expect(catalog.headers.get('cache-control')).toBe('no-store');
          expect((await catalog.json()).tests[0].price).toBe(120.5);
     });
     it('rejects tenant overrides and terminates unknown public routes before private middleware', async () => {
          expect((await fetch(`${base}/api/v1/public/facilities/test-laboratory/catalog?tenantId=4`)).status).toBe(400);
          expect((await fetch(`${base}/api/v1/public/facilities/test-laboratory/private`)).status).toBe(404);
          expect(mocks.connection).not.toHaveBeenCalled();
     });
     it('logs configuration/database failures without exposing SQL or success-shaped empty data', async () => {
          mocks.connection.mockRejectedValue(new Error('SELECT secret FROM private_table'));
          const result = await fetch(`${base}/api/v1/public/facilities/test-laboratory/catalog`);
          expect(result.status).toBe(503);
          expect(await result.text()).not.toContain('private_table');
          expect(mocks.log).toHaveBeenCalledWith('Public facility directory/catalog unavailable');
     });
});
