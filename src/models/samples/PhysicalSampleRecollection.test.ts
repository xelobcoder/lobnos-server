import { describe, expect, it, vi } from 'vitest';
import knex from 'knex';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
import KnexConnection from '../../database/KnexConnections';
import { PhysicalSampleService, physicalSampleLineage } from './PhysicalSampleService';

describe('recollection chain history', () => {
     const rows = [{ id: 10, status: 'rejected' }, { id: 11, replaces_sample_id: 10, status: 'rejected' }, { id: 12, replaces_sample_id: 11, status: 'accepted' }, { id: 20, status: 'accepted' }, { id: 21, parent_sample_id: 10, status: 'accepted' }];
     it.each([10, 11, 12])('includes the original and every replacement when opened from sample %s', id => {
          expect(physicalSampleLineage([...rows].reverse(), id).map(item => item.id)).toEqual([10, 11, 12]);
     });
     it('keeps unrelated containers and aliquots outside the recollection chain', () => {
          expect(physicalSampleLineage(rows, 20).map(item => item.id)).toEqual([20]);
          expect(physicalSampleLineage(rows, 21).map(item => item.id)).toEqual([21]);
     });
     it('terminates safely for damaged cyclic historical links', () => {
          expect(physicalSampleLineage([{ id: 1, replaces_sample_id: 2 }, { id: 2, replaces_sample_id: 1 }], 1)).toHaveLength(2);
     });
     it('returns the full chain audit with delivery outcomes, scoped to the same patient and billing', async () => {
          const calls: any[] = [];
          const data: Record<string, any[]> = {
               physical_samples: rows,
               'physical_sample_events as event': [{ id: 1, sample_id: 10, event_type: 'rejected' }, { id: 2, sample_id: 12, event_type: 'collected' }],
               'physical_sample_reviews as review': [],
               physical_sample_communications: [{ id: 4, sample_id: 10, requested_channels: '["sms","email"]', status: 'partial' }],
               physical_sample_delivery_attempts: [{ id: 5, communication_id: 4, channel: 'sms', status: 'sent' }, { id: 6, communication_id: 4, channel: 'email', status: 'failed' }],
          };
          const connection: any = vi.fn((table: string) => {
               const query: any = {};
               for (const method of ['where', 'whereIn', 'leftJoin', 'select', 'orderBy']) query[method] = vi.fn((...args: any[]) => { calls.push({ table, method, args }); return query; });
               query.then = (resolve: any, reject: any) => Promise.resolve(data[table] || []).then(resolve, reject);
               return query;
          });
          vi.mocked(KnexConnection).mockResolvedValue(connection);
          const service = new PhysicalSampleService(9);
          vi.spyOn(service, 'detail').mockResolvedValue({ id: 12, patientid: 7, billingid: 3, sample_uid: 'S-12' });
          const reconciliation = vi.spyOn(service as any, 'reconcileCommunicationStatuses').mockResolvedValue(undefined);
          const audit = await service.auditDetail(12);
          expect(calls).toContainEqual({ table: 'physical_samples', method: 'where', args: [{ billingid: 3, patientid: 7 }] });
          expect(calls).toContainEqual({ table: 'physical_sample_events as event', method: 'whereIn', args: ['event.sample_id', [10, 11, 12]] });
          expect(audit.lineage.map((sample: any) => sample.id)).toEqual([10, 11, 12]);
          expect(audit.events.map((event: any) => event.event_type)).toEqual(['rejected', 'collected']);
          expect(audit.communications[0]).toMatchObject({ requested_channels: '["sms","email"]', status: 'partial', attempts: [{ channel: 'sms', status: 'sent' }, { channel: 'email', status: 'failed' }] });
          expect(reconciliation).toHaveBeenCalledWith(connection, [4]);
     });
});

function recollectionDatabase(status = 'rejected', linked = true) {
     const samples: any[] = [{ id: 10, sample_uid: 'ORIGINAL', patientid: 4, billingid: 3, status, version: 2, rejected_at: '2026-01-01', rejection_reason: 'Haemolysed', quantity: 2, unit: 'mL' }];
     const links: any[] = linked ? [{ sample_id: 10, ascension_id: 101, requirement_key: '1:2:ml', is_required: true }] : [];
     const writes: any[] = [];
     const locks = vi.fn();
     const trx: any = vi.fn((table: string) => {
          const predicates: any[] = [];
          const source = () => table === 'physical_samples' ? samples : table === 'test_ascension_samples' ? links : [];
          const matching = () => source().filter(row => predicates.every(predicate => Object.entries(predicate).every(([key, value]) => row[key] === value)));
          const query: any = {
               where: vi.fn((predicate: any) => { predicates.push(predicate); return query; }),
               orderBy: vi.fn(() => query), whereIn: vi.fn(() => query),
               forUpdate: vi.fn(() => { locks(table); return query; }),
               first: vi.fn(async () => { const rows = matching(); return rows[rows.length - 1]; }),
               insert: vi.fn(async (data: any) => {
                    writes.push({ table, data });
                    if (table === 'physical_samples') { const id = samples.length + 10; samples.push({ id, ...data }); return [id]; }
                    if (table === 'test_ascension_samples') links.push(...data);
                    return [writes.length];
               }),
               update: vi.fn(async (data: any) => { writes.push({ table, data }); return 1; }),
               then: (resolve: any, reject: any) => Promise.resolve(matching()).then(resolve, reject),
          };
          return query;
     });
     vi.mocked(KnexConnection).mockResolvedValue({ transaction: async (callback: any) => callback(trx) } as any);
     const service = new PhysicalSampleService(9);
     vi.spyOn(service, 'detail').mockImplementation(async id => ({ ...samples.find(row => row.id === id), tests: [{ ascensionId: 101 }] }));
     return { service, samples, links, writes, locks };
}

describe('recollection creates a real replacement', () => {
     it('preserves the rejected sample, starts a new container and resets validation without accepting or collecting it', async () => {
          const db = recollectionDatabase();
          const sample = await db.service.recollect(10, 7);
          expect(sample).toMatchObject({ status: 'collection_started', replaces_sample_id: 10, collection_started_by: 7, patientid: 4, billingid: 3 });
          expect(sample.collected_at).toBeUndefined();
          expect(sample.accepted_at).toBeUndefined();
          expect(db.samples[0]).toMatchObject({ status: 'rejected', rejection_reason: 'Haemolysed', rejected_at: '2026-01-01' });
          expect(db.links.filter(link => link.sample_id === sample.id)).toMatchObject([{ ascension_id: 101, is_required: true }]);
          expect(db.writes.find(write => write.table === 'samplestatus').data).toMatchObject({ approvalstatus: 0, samplevalidatedon: null, validatedby: null, isRedraw: 1 });
          expect(db.writes.filter(write => write.table === 'physical_sample_events').map(write => write.data.event_type)).toEqual(['recollection_started', 'replacement_started']);
     });
     it('resumes the same replacement on repeated clicks and serializes starts using the rejected row lock', async () => {
          const db = recollectionDatabase();
          const first = await db.service.recollect(10, 7);
          const writeCount = db.writes.length;
          const second = await db.service.recollect(10, 8);
          expect(second.id).toBe(first.id);
          expect(db.writes).toHaveLength(writeCount);
          expect(db.samples).toHaveLength(2);
          expect(db.locks).toHaveBeenCalledWith('physical_samples');
     });
     it.each(['collected', 'received', 'accepted', 'planned', 'collection_started'])('does not recollect a specimen in %s', async status => {
          const db = recollectionDatabase(status);
          await expect(db.service.recollect(10, 7)).rejects.toThrow('Only a rejected sample');
          expect(db.writes).toHaveLength(0);
     });
     it('does not create an unlinked replacement', async () => {
          const db = recollectionDatabase('rejected', false);
          await expect(db.service.recollect(10, 7)).rejects.toThrow('no linked tests');
          expect(db.writes).toHaveLength(0);
     });
});

describe('repeated rejection uses the latest required replacement', () => {
     it.each(['collection', 'acceptance'])('ignores all superseded ancestors during %s without requiring an intermediate rejected replacement to be accepted', async stage => {
          const compiler = knex({ client: 'mysql2' });
          const compiled: any[] = [];
          const updates: any[] = [];
          const trx: any = vi.fn((table: string) => {
               const query: any = compiler(table);
               const originalUpdate = query.update.bind(query);
               query.update = (data: any) => { updates.push({ table, data }); return originalUpdate(data); };
               query.then = (resolve: any, reject: any) => {
                    compiled.push({ table, ...query.toSQL() });
                    const result = table === 'physical_samples' && query.toSQL().method === 'first' ? { id: 12, status: 'collected', version: 2 }
                         : table === 'test_ascension_samples' ? [{ ascension_id: 101 }]
                         : table === 'test_ascension_samples as link' ? { count: 0 }
                         : table === 'physical_sample_events' ? [1] : 1;
                    return Promise.resolve(result).then(resolve, reject);
               };
               return query;
          });
          trx.raw = compiler.raw.bind(compiler);
          vi.mocked(KnexConnection).mockResolvedValue({ transaction: async (callback: any) => callback(trx) } as any);
          const service = new PhysicalSampleService(9);
          vi.spyOn(service, 'detail').mockResolvedValue({ id: 12, status: 'accepted' });
          try {
               if (stage === 'collection') await (service as any).synchronizeCollectedAscensions(trx, [101], new Date(), 7);
               else await service.transition(12, 'accepted', 7);
               const outstanding = compiled.find(query => query.table === 'test_ascension_samples as link');
               expect(outstanding.sql).toContain(`replacement.replaces_sample_id = ${stage === 'collection' ? 'sample' : 'linked_sample'}.id`);
               if (stage === 'acceptance') expect(updates.find(update => update.table === 'samplestatus').data).toMatchObject({ approvalstatus: 1, rejectionmessage: null, isRedraw: 0 });
          } finally { await compiler.destroy(); }
          const outstanding = compiled.find(query => query.table === 'test_ascension_samples as link');
          expect(outstanding.sql).toContain('`replacement_link`.`is_required` = ?');
          expect(outstanding.sql).not.toContain('`replacement`.`status`');
     });
});
