import knex from 'knex';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ connection: vi.fn(), audit: vi.fn() }));
vi.mock('../../database/KnexConnections', () => ({ default: mocks.connection }));
vi.mock('../samples/PhysicalSampleService', () => ({ PhysicalSampleService: class { auditDetail = mocks.audit; } }));
vi.mock('./PatientPortalAccountService', () => ({ PatientPortalError: class extends Error {
     constructor(message: string, readonly statusCode = 400, readonly code = 'PORTAL_ERROR') { super(message); }
} }));

import { PatientPortalSampleService } from './PatientPortalSampleService';

const sql = knex({ client: 'mysql2' });
const queries: any[] = [];
let ownsSample = true;
const original = { id: 1, patientid: 21, billingid: 31, sample_uid: 'ORIGINAL', status: 'rejected',
     rejection_reason: 'Insufficient volume', sample_type_name: 'Blood', collected_by: 9, notes: 'Internal note', version: 2 };
const replacement = { ...original, id: 2, sample_uid: 'REPLACEMENT', replaces_sample_id: 1, status: 'accepted' };

beforeEach(() => {
     vi.clearAllMocks(); queries.length = 0; ownsSample = true;
     mocks.connection.mockImplementation(async () => (table: string) => {
          const decorate = (builder: any): any => {
          const clone = builder.clone.bind(builder);
          builder.clone = () => decorate(clone());
          builder.then = (resolve: any, reject: any) => {
               const compiled = builder.toSQL(); queries.push(compiled);
               const data = /count\(/i.test(compiled.sql) ? { total: 2 }
                    : builder._method === 'first' ? ownsSample ? { id: 1 } : undefined : [original, replacement];
               return Promise.resolve(data).then(resolve, reject);
          };
          return builder;
          };
          return decorate(sql(table));
     });
     mocks.audit.mockResolvedValue({ ...original, lineage: [original, replacement, { ...original, id: 3, patientid: 999 }],
          events: [
               { id: 7, sample_id: 1, sample_uid: 'ORIGINAL', event_type: 'rejected', reason: 'Insufficient volume', actor_employeeid: 9, metadata: 'private' },
               { id: 8, sample_id: 2, sample_uid: 'REPLACEMENT', event_type: 'collected', metadata: 'private' },
               { id: 9, sample_id: 3, event_type: 'rejected', reason: 'Other patient' },
               { id: 10, sample_id: 1, event_type: 'disposed', reason: 'Internal disposal record' },
          ], communications: [{ sample_id: 1, sample_uid: 'ORIGINAL', message: 'Please return for recollection', status: 'sent',
               requested_by: 9, attempts: [{ recipient: 'private@example.test', error: 'Provider detail' }] }] });
});

it('lists only the authenticated patient within the selected tenant, with bounded pagination and a safe projection', async () => {
     const result = await new PatientPortalSampleService(4).list(21, 2);
     expect(mocks.connection).toHaveBeenCalledWith(4);
     expect(queries.every(query => query.sql.includes('`patientid` = ?') && query.bindings.includes(21))).toBe(true);
     expect(queries[1].bindings).toEqual([21, 25, 25]);
     expect(result).toMatchObject({ page: 2, total: 2, items: [{ sampleUid: 'ORIGINAL', rejectionReason: 'Insufficient volume' }, { replacesSampleId: 1 }] });
     expect(result.items[0].replacement).toMatchObject({ sampleUid: 'REPLACEMENT', status: 'accepted' });
     expect(queries[2].sql).toContain('`replaces_sample_id` in (?, ?)');
     expect(JSON.stringify(result)).not.toMatch(/collected_by|Internal note|version/);
});

it('rejects foreign sample IDs before accessing their audit or communication history', async () => {
     ownsSample = false;
     await expect(new PatientPortalSampleService(4).history(21, 99)).rejects.toMatchObject({ statusCode: 404 });
     expect(queries[0].bindings).toEqual([21, 99, 1]);
     expect(mocks.audit).not.toHaveBeenCalled();
});

it('retains the original rejection and replacement chain while stripping staff, provider and unrelated patient data', async () => {
     const result = await new PatientPortalSampleService(4).history(21, 1);
     expect(mocks.audit).toHaveBeenCalledWith(1);
     expect(result.lineage.map(sample => sample.sampleUid)).toEqual(['ORIGINAL', 'REPLACEMENT']);
     expect(result.events.map((event: any) => event.type)).toEqual(['rejected', 'collected']);
     expect(result.events[0].reason).toBe('Insufficient volume');
     expect(result.communications[0].message).toBe('Please return for recollection');
     expect(JSON.stringify(result)).not.toMatch(/actor_employeeid|requested_by|metadata|Other patient|provider|private|Internal note|Internal disposal/i);
});

it.each([0, -1, 1.5, NaN])('rejects invalid patient and sample identifiers before reading records: %s', async id => {
     await expect(new PatientPortalSampleService(4).list(id)).rejects.toThrow();
     await expect(new PatientPortalSampleService(4).history(21, id)).rejects.toThrow();
     expect(mocks.connection).not.toHaveBeenCalled();
});
