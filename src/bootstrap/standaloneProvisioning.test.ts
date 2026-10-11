import { describe, it, expect, vi } from 'vitest';
import { createHash } from 'crypto';
import { loadFacilityStructureExports } from '../models/Tenancy/FacilityStructureExports';
import { loadFacilityCatalogSeeds } from '../models/Tenancy/FacilityCatalogSeeds';
import { verifyLocalPipelineAssets } from './standalonePipeline';
import { provisionLocalDatabases, validateProvisionStructure, LOCAL_DATABASE, LOCAL_CONTROL_DATABASE,
     LocalProvisionRequest } from './standaloneProvisioning';

const structure = loadFacilityStructureExports();
const state: LocalProvisionRequest['state'] = {
     version: 1, installationId: 'a'.repeat(32), organizationName: 'Example laboratory',
     host: '127.0.0.1', port: '2309', account: 'primelab',
     accountPassword: 'b'.repeat(43), tenantId: '123456', organizationId: 'LOCAL123456', facilityCode: 'EXAMPL',
     loginPassword: 'c'.repeat(43), jwtSecret: 'd'.repeat(43), windowKey: 'e'.repeat(43),
};
const request: LocalProvisionRequest = { state };
function harness(options: { owned?: boolean; foreign?: boolean; fail?: string; version?: string; busy?: boolean; windows?: boolean } = {}) {
     const queries: Array<{ sql: string; values: any[] }> = [];
     const marker = { owner_id: state.installationId, version: 1, account_name: state.account,
          secret_binding: createHash('sha256').update(state.accountPassword).digest('hex'),
          tenant_id: state.tenantId, organization_name: state.organizationName };
     const connection = {
          query: vi.fn(async (sql: string, values: any[] = []) => {
               queries.push({ sql, values });
               if (options.fail && sql.includes(options.fail)) throw new Error('unsafe driver details');
               if (sql.includes('VERSION()')) return [[{ version: options.version || '8.0.40' }]];
               if (sql.includes('@@lower_case_table_names')) return [[{ lowerCaseNames: options.windows ? 1 : 0 }]];
               if (sql.includes('GET_LOCK')) return [[{ acquired: options.busy ? 0 : 1 }]];
               if (sql.includes('INFORMATION_SCHEMA.SCHEMATA')) return [options.owned || options.foreign ? [{ SCHEMA_NAME: options.windows ? values[0].toLowerCase() : values[0] }] : []];
               if (sql.startsWith('SELECT *') && sql.includes('pls_local_installation')) {
                    if (options.foreign) throw new Error('not owned');
                    return [[marker]];
               }
               if (sql.includes('mysql.user')) return [options.owned ? [{ Host: 'localhost' }] : []];
               if (sql.includes('INFORMATION_SCHEMA.TABLES')) return [options.owned ? structure.tables.map(table => ({ TABLE_NAME: options.windows ? table.name.toLowerCase() : table.name })) : []];
               if (sql.includes('INFORMATION_SCHEMA.TRIGGERS') || sql.includes('INFORMATION_SCHEMA.ROUTINES')) return [options.owned ? [{}] : []];
               if (sql.startsWith('SELECT *') && sql.includes('prime_tenants')) return [options.owned ? [{
                    id: state.organizationId, tenant_number: state.tenantId, database_name: LOCAL_DATABASE,
                    company_name: state.organizationName, facility_code: state.facilityCode, status: 'active',
               }] : []];
               return [[]];
          }),
          end: vi.fn(async () => {}),
     };
     const connect = vi.fn(async () => connection);
     const initialize = vi.fn(async () => {});
     return { queries, connection, dependencies: { connect, initialize, structure } };
}
describe('standalone provisioning (mocked MySQL only)', () => {
     it('validates every authoritative object, all catalogs and pipeline prerequisites offline', () => {
          expect(() => validateProvisionStructure(structure)).not.toThrow();
          expect(() => verifyLocalPipelineAssets()).not.toThrow();
          expect(loadFacilityCatalogSeeds()).toHaveLength(9);
          expect(structure.tables.every(table => /ENGINE=InnoDB\b/.test(table.ddl))).toBe(true);
     });
     it('refuses incomplete/externally dependent assets before connecting', async () => {
          const h = harness();
          await expect(provisionLocalDatabases(request, { ...h.dependencies, structure: { tables: [], objects: [] } })).rejects.toThrow('prerequisite');
          const altered = { ...structure, tables: structure.tables.map((table, index) => index ? table :
               { ...table, ddl: table.ddl + ' REFERENCES `another_facility`.`patient`' }) };
          await expect(provisionLocalDatabases(request, { ...h.dependencies, structure: altered })).rejects.toThrow('administrator review');
          expect(h.dependencies.connect).not.toHaveBeenCalled();
     });
     it('creates scoped databases/account, uses bound secrets and initializes before reporting ready', async () => {
          const h = harness();
          await expect(provisionLocalDatabases(request, h.dependencies)).resolves.toEqual({ ready: true });
          expect(h.queries.filter(query => query.sql.startsWith('CREATE DATABASE'))).toHaveLength(2);
          expect(h.queries.filter(query => query.sql.startsWith('CREATE USER'))).toHaveLength(1);
          expect(h.queries.filter(query => query.sql.startsWith('GRANT')).map(query => query.sql))
               .toEqual(expect.arrayContaining([expect.stringContaining(`ON \`${LOCAL_DATABASE}\`.*`), expect.stringContaining(`ON \`${LOCAL_CONTROL_DATABASE}\`.*`)]));
          expect(h.queries.every(query => !query.sql.includes(state.accountPassword))).toBe(true);
          expect(h.dependencies.initialize).toHaveBeenCalledOnce();
          expect(h.queries.some(query => /DROP DATABASE|ALTER USER|GRANT .* ON \*\.\*/.test(query.sql))).toBe(false);
          expect(h.connection.end).toHaveBeenCalledTimes(2);
     });
     it('does not recreate tables, reset accounts or replace an owned registry on retry', async () => {
          const h = harness({ owned: true });
          await provisionLocalDatabases(request, h.dependencies);
          expect(h.queries.some(query => /^(CREATE DATABASE|CREATE USER|INSERT INTO .*prime_tenants|CREATE TABLE `(?!primelabmaster_control))/.test(query.sql))).toBe(false);
     });
     it('retries Windows-normalized database/table names without recreating existing tables', async () => {
          const h = harness({ owned: true, windows: true });
          await provisionLocalDatabases(request, h.dependencies);
          expect(h.queries.some(query => /^(CREATE DATABASE|CREATE USER|CREATE TABLE `(?!primelabmaster_control))/.test(query.sql))).toBe(false);
     });
     it.each([{ foreign: true }, { busy: true }, { version: '5.7.44' }, { version: '10.11.1-MariaDB' }])('refuses unsafe existing/server state without mutations: %j', async options => {
          const h = harness(options);
          await expect(provisionLocalDatabases(request, h.dependencies)).rejects.toThrow();
          expect(h.queries.some(query => /^(CREATE|INSERT|GRANT|ALTER|DROP)/.test(query.sql))).toBe(false);
          expect(h.dependencies.initialize).not.toHaveBeenCalled();
     });
     it('reports DDL and initialization failures explicitly without driver detail or false success', async () => {
          const h = harness({ fail: 'CREATE USER' });
          await expect(provisionLocalDatabases(request, h.dependencies)).rejects.toThrow('application account');
          const retry = harness();
          retry.dependencies.initialize.mockRejectedValue(new Error('unsafe driver details'));
          await expect(provisionLocalDatabases(request, retry.dependencies)).rejects.toThrow('reference seeds and runtime readiness');
          expect(retry.connection.end).toHaveBeenCalledTimes(2);
     });
     it('rejects remote endpoints and injected identifiers without a connection', async () => {
          const h = harness();
          await expect(provisionLocalDatabases({ ...request, state: { ...state, host: 'remote.example' } }, h.dependencies)).rejects.toThrow('loopback');
          await expect(provisionLocalDatabases({ ...request, state: { ...state, account: 'other;DROP USER' } }, h.dependencies)).rejects.toThrow();
          expect(h.dependencies.connect).not.toHaveBeenCalled();
     });
});
