import { afterEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../referral/QuickReferralEntityService', () => ({ QuickReferralEntityService: class {} }));
import KnexConnection from '../../database/KnexConnections';
import { ReferralPerformance } from './ReferralPerformance';
let db: any;
afterEach(async () => db?.destroy());
describe('referral report query integrity', () => {
     it('counts cases distinctly, includes paid commission, scopes the marketer portfolio and keeps inactive referrers', async () => {
          db = knex({ client: 'mysql2' }); vi.mocked(KnexConnection).mockResolvedValue(db);
          const queries: any[] = [];
          db.client.acquireConnection = async () => ({}); db.client.releaseConnection = async () => {};
          db.client._query = async (_connection: any, query: any) => {
               queries.push({ sql: query.sql, bindings: query.bindings });
               let rows: any[];
               if (query.sql.includes('from `clinicianbasicinfo`')) rows = [{ id: 11, name: 'Doctor Active', marketer_id: 7 }, { id: 12, name: 'Doctor Inactive', marketer_id: 7 }];
               else if (query.sql.includes('min(')) rows = [{ entity_id: 11, first_referral: '2026-01-01', last_referral: '2026-10-10' }];
               else {
                    const current = query.bindings[query.bindings.length - 2] === '2026-10-01 00:00:00';
                    const grouped = query.sql.includes('group by');
                    rows = grouped ? current ? [{ entity_id: 11, cases: 2, patients: 2, tests: 5, billed: '100', collected: '80', commission: '10' }] : [{ entity_id: 11, cases: 1 }, { entity_id: 12, cases: 1 }] : [{ cases: 2, patients: 2, tests: 5, billed: '100', collected: '80', commission: '10' }];
               }
               query.response = [rows, []]; return query;
          };
          const result = await new ReferralPerformance(1).report({ employeeid: 7, role: 'marketer', branch: 4, tenantId: 1 } as any, { start: '2026-10-01', end: '2026-10-23', type: 'clinician' });
          expect(result.rows.find(row => row.id === 12)).toMatchObject({ attention: 'inactive', current: { cases: 0 }, previous: { cases: 1 } });
          expect(result.totals.current).toMatchObject({ cases: 2, tests: 5, billed: 100, commission: 10 });
          expect(queries[0].sql).toContain('`portfolio`.`marketer_id` = ?');
          for (const query of queries.filter(query => query.sql.includes('COUNT(DISTINCT'))) {
               expect(query.sql).toContain('COUNT(DISTINCT service.billingid)');
               expect(query.sql).toContain('COUNT(DISTINCT bill.patientid)');
               expect(query.sql).not.toContain('commission_batch_payment_services');
               expect(query.sql).toContain('SUM(tracking.final_commission)');
               expect(query.sql).toContain('tracking.status NOT IN (?, ?)');
               expect(query.sql).not.toMatch(/paymentstatus|is_paid|patient\.firstname/);
               expect(query.sql).toContain('`service`.`branchid` = ?');
          }
     });
     it('restricts historical credit to the signed-in owner and recorded timestamp windows', async () => {
          db = knex({ client: 'mysql2' }); vi.mocked(KnexConnection).mockResolvedValue(db); const queries: any[] = [];
          db.client.acquireConnection = async () => ({}); db.client.releaseConnection = async () => {};
          db.client._query = async (_: any, query: any) => {
               queries.push(query);
               const rows = query.sql.includes('from `clinicianbasicinfo`') ? [{ id: 11, name: 'Reassigned doctor', marketer_id: 8 }] : query.sql.includes('from `crm_ownership_history`') ? [{ started: '2026-10-01' }] : [];
               query.response = [rows, []]; return query;
          };
          const result = await new ReferralPerformance(1).report({ employeeid: 7, role: 'marketer', branch: 4, tenantId: 1 } as any, { start: '2026-10-01', end: '2026-10-23', attribution: 'historical', owner: 99 });
          expect(result.attribution).toBe('historical');
          expect(result.definitions.portfolio).toContain('recorded owner');
          const entities = queries.find(q => q.sql.includes('from `clinicianbasicinfo`'));
          expect(entities.sql).toContain('exists');
          expect(entities.sql).not.toContain('`portfolio`.`marketer_id` = ?');
          expect(entities.bindings).toContain(7); expect(entities.bindings).not.toContain(99);
          for (const q of queries.filter(q => q.sql.includes('COUNT(DISTINCT'))) {
               expect(q.sql).toContain('credit.valid_from <= service.serviceAddedOn');
               expect(q.sql).toContain('credit.valid_to > service.serviceAddedOn');
               expect(q.sql).toContain('`credit`.`marketer_id` = ?');
               expect(q.bindings).toContain(7); expect(q.bindings).not.toContain(99);
          }
     });

});
