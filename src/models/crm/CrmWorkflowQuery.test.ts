import { afterEach, describe, expect, it, vi } from 'vitest';
import knex from 'knex';
vi.mock('../../database/KnexConnections', () => ({ default: vi.fn() }));
vi.mock('../referral/QuickReferralEntityService', () => ({ QuickReferralEntityService: class {} }));
vi.mock('../application/appsettings/appset', () => ({ default: class { async getAllAppSettings() { return { commissionRecipientPolicy: 'organization' }; } } }));
import KnexConnection from '../../database/KnexConnections';
import { CrmWorkflowService } from './CrmWorkflowService';
let db: any;
const actor: any = { employeeid: 7, role: 'marketer', tenantId: 1, branch: 4 };
afterEach(async () => db?.destroy());
function database(rows: (query: any) => any[]) {
 db = knex({ client: 'mysql2' }); vi.mocked(KnexConnection).mockResolvedValue(db); const queries: any[] = [];
 db.client.acquireConnection = async () => ({}); db.client.releaseConnection = async () => {};
 db.client._query = async (_: any, query: any) => { queries.push(query); query.response = [query.sql.includes('from `leads`') ? [{ id: 1, assigned_to: 7, branchid: 4, prospect_type: 'clinician', referrer_id: 11 }] : rows(query), []]; return query; };
 return queries;
}
describe('CRM workflow read queries', () => {
 it('previews binding terms and recipient conflicts without writing financial records', async () => {
  const queries = database(q => q.sql.includes('from `commission_configs`') ? [{ id: 10, commission_type: 'percentage', percentage_rate: 10, is_active: true }]
   : q.sql.includes('from `commission_assignments`') ? [{ id: 9, commission_config_id: 12, priority: 100, service_id: 55 }] : []);
  const result = await new CrmWorkflowService(1).preview(actor, 1, { commission_config_id: 10, effective_from: '2026-10-23', amount: 100 });
  expect(result.sample_commission_before_period_limits).toBe(10);
  expect(result.policy).toBe('organization'); expect(result.warnings.join(' ')).toContain('compete');
  expect(result.warnings.join(' ')).toContain('may not be the recipient');
  expect(queries.every(q => q.sql.startsWith('select'))).toBe(true);
 });
 it('checks the first referral against actual tracking without returning patient or case identities', async () => {
  const queries = database(q => q.sql.includes('from `crm_commission_proposals`') ? [{ id: 2, assignment_id: 8, effective_from: '2026-10-01' }]
   : q.sql.includes('from `commission_assignments`') ? [{ id: 8, assigned_to: '2026-10-31' }]
   : q.sql.includes('from `dboservices`') ? [{ serviceid: 55, serviceAddedOn: '2026-10-23' }]
   : q.sql.includes('from `commission_tracking`') ? [{ assignment_id: 99, recipient_type: 'organization', recipient_id: 99, final_commission: 10 }] : []);
  const result = await new CrmWorkflowService(1).reconciliation(actor, 1);
  expect(result.data[0]).toMatchObject({ status: 'different_rule_or_recipient', commission: 0, first_referral_date: '2026-10-23' });
  expect(JSON.stringify(result)).not.toMatch(/serviceid|patientid|recipient_id/);
  const serviceQuery = queries.find(q => q.sql.includes('from `dboservices`'));
  expect(serviceQuery.sql).toContain('`branchid` = ?'); expect(serviceQuery.sql).toContain('DATE_ADD');
 });
 it('paginates beyond the original detail limits with portfolio authorization', async () => {
  const queries = database(q => q.sql.includes('count(') ? [{ count: 126 }] : [{ id: 126, lead_id: 1, action: 'onboarding_updated' }]);
  const result = await new CrmWorkflowService(1).history(actor, 1, { kind: 'activities', page: 6 });
  expect(result).toMatchObject({ total: 126, page: 6, totalPages: 6 });
  const query = queries.find(q => q.sql.includes('from `crm_activities`') && !q.sql.includes('count('));
  expect(query.bindings).toEqual([1, 25, 125]);
  expect(queries[0].sql).toContain('`lead`.`assigned_to` = ?');
 });
});
